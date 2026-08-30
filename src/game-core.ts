import { getLevelConfig, UPGRADE_IDS } from "./content";
import type {
  GameCoreOptions,
  GameEvent,
  GameSnapshot,
  GameStatus,
  LevelConfig,
  LevelId,
  LevelResult,
  LossReason,
  ObstacleConfig,
  PathAppendResult,
  PathRejectReason,
  UpgradeId,
  Vec2,
} from "./types";

export const FIXED_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.5;
const COLLISION_INVULNERABILITY_SECONDS = 0.9;
const EPSILON = 1e-7;

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }

  integer(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const distance = (a: Vec2, b: Vec2): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const copyPoint = (point: Vec2): Vec2 => ({ x: point.x, y: point.y });

const isFinitePoint = (point: Vec2): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

export class CloudwayGame {
  private level: LevelConfig;
  private readonly seed: number;
  private readonly fixedStepSeconds: number;

  private status: GameStatus = "ready";
  private vehiclePosition: Vec2;
  private path: Vec2[] = [];
  private nextPathPointIndex = 1;
  private inkCurrent = 0;
  private inkCapacity = 0;
  private inkCostMultiplier = 1;
  private cargoIntegrity = 0;
  private cargoMaximum = 0;
  private speedMultiplier = 1;
  private elapsedSeconds = 0;
  private distanceTraveled = 0;
  private coins = 0;
  private stamps = 0;
  private accumulator = 0;
  private collisionInvulnerabilityRemaining = 0;
  private lighthouseActiveRemaining = 0;
  private lighthouseCooldownRemaining = 0;
  private lighthouseCooldownMultiplier = 1;
  private relayTriggered = false;
  private relayChoices: UpgradeId[] = [];
  private relaySelected: UpgradeId | null = null;
  private expressCompletionBonus = false;
  private obstaclePhases: number[] = [];
  private collectedIds = new Set<string>();
  private events: GameEvent[] = [];
  private result: LevelResult | null = null;

  constructor(options: GameCoreOptions = {}) {
    const fixedStep = options.fixedStepSeconds ?? FIXED_STEP_SECONDS;
    if (!Number.isFinite(fixedStep) || fixedStep <= 0 || fixedStep > 0.1) {
      throw new RangeError("fixedStepSeconds must be greater than 0 and at most 0.1");
    }

    this.fixedStepSeconds = fixedStep;
    this.seed = (options.seed ?? 0x1a2b3c4d) >>> 0;
    this.level = options.level ?? getLevelConfig(options.levelId ?? 1);
    this.vehiclePosition = copyPoint(this.level.start);
    this.resetState("ready");
  }

  /** Start the current level, or switch to one of the five built-in levels. */
  start(levelId?: LevelId | number): GameSnapshot {
    if (levelId !== undefined) {
      this.level = getLevelConfig(levelId);
    }
    this.resetState("running");
    this.events.push({
      type: "started",
      at: this.elapsedSeconds,
      levelId: this.level.id,
    });
    return this.getSnapshot();
  }

  restart(): GameSnapshot {
    return this.start();
  }

  appendPath(point: Vec2): PathAppendResult {
    if (this.status !== "running") {
      return this.rejectPath("not-running");
    }
    if (
      !isFinitePoint(point) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > this.level.world.width ||
      point.y > this.level.world.height
    ) {
      return this.rejectPath("outside-world");
    }

    const anchor = this.path[this.path.length - 1];
    if (!anchor) {
      return this.rejectPath("not-running");
    }

    const requestedDistance = distance(anchor, point);
    if (requestedDistance < this.level.pathRules.minPointSpacing) {
      return this.rejectPath("too-close");
    }

    const costPerPixel = this.level.pathRules.inkPerPixel * this.inkCostMultiplier;
    const drawableDistance = this.inkCurrent / costPerPixel;
    if (drawableDistance < this.level.pathRules.minPointSpacing) {
      return this.rejectPath("no-ink");
    }

    const acceptedDistance = Math.min(requestedDistance, drawableDistance);
    const truncated = acceptedDistance + EPSILON < requestedDistance;
    const direction = {
      x: (point.x - anchor.x) / requestedDistance,
      y: (point.y - anchor.y) / requestedDistance,
    };
    const segmentCount = Math.max(
      1,
      Math.ceil(acceptedDistance / this.level.pathRules.maxSegmentLength),
    );
    for (let index = 1; index <= segmentCount; index += 1) {
      const along = (acceptedDistance * index) / segmentCount;
      this.path.push({
        x: anchor.x + direction.x * along,
        y: anchor.y + direction.y * along,
      });
    }

    const inkSpent = acceptedDistance * costPerPixel;
    this.inkCurrent = clamp(this.inkCurrent - inkSpent, 0, this.inkCapacity);
    const endpoint = copyPoint(this.path[this.path.length - 1] ?? point);
    const result: PathAppendResult = {
      accepted: true,
      pointsAdded: segmentCount,
      inkSpent,
      endpoint,
      truncated,
      reason: null,
    };
    this.events.push({
      type: "path-added",
      at: this.elapsedSeconds,
      pointsAdded: segmentCount,
      inkSpent,
      endpoint: copyPoint(endpoint),
      truncated,
    });
    return result;
  }

  /**
   * Advance wall-clock time. Internally this always simulates fixed-size steps.
   * Frames longer than 0.5 s are clamped so returning from a hidden tab is fair.
   */
  advance(deltaSeconds: number): GameSnapshot {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("deltaSeconds must be a finite non-negative number");
    }
    if (this.status !== "running") {
      this.accumulator = 0;
      return this.getSnapshot();
    }

    this.accumulator += Math.min(deltaSeconds, MAX_FRAME_SECONDS);
    while (
      this.accumulator + EPSILON >= this.fixedStepSeconds &&
      this.status === "running"
    ) {
      this.simulateStep(this.fixedStepSeconds);
      this.accumulator -= this.fixedStepSeconds;
    }
    if (this.status !== "running") {
      this.accumulator = 0;
    }
    return this.getSnapshot();
  }

  chooseRelayUpgrade(upgradeId: UpgradeId): boolean {
    if (
      this.status !== "upgrade-choice" ||
      !this.relayChoices.includes(upgradeId)
    ) {
      return false;
    }

    this.applyUpgrade(upgradeId);
    this.relaySelected = upgradeId;
    this.status = "running";
    this.accumulator = 0;
    this.events.push({
      type: "upgrade",
      at: this.elapsedSeconds,
      upgradeId,
    });
    return true;
  }

  activateLighthouse(): boolean {
    if (
      this.status !== "running" ||
      this.lighthouseCooldownRemaining > EPSILON ||
      this.lighthouseActiveRemaining > EPSILON
    ) {
      return false;
    }
    this.lighthouseActiveRemaining =
      this.level.lighthouse.shieldDurationSeconds;
    this.lighthouseCooldownRemaining =
      this.level.lighthouse.cooldownSeconds *
      this.lighthouseCooldownMultiplier;
    this.events.push({
      type: "shield-activated",
      at: this.elapsedSeconds,
      duration: this.lighthouseActiveRemaining,
    });
    return true;
  }

  getSnapshot(): GameSnapshot {
    const obstacleSnapshots = this.level.obstacles.map((obstacle, index) => ({
      ...obstacle,
      position: copyPoint(obstacle.position),
      motion: obstacle.motion ? { ...obstacle.motion } : undefined,
      runtimePosition: this.getObstaclePosition(obstacle, index),
    }));
    const collectibleSnapshots = this.level.collectibles.map((collectible) => ({
      ...collectible,
      position: copyPoint(collectible.position),
      collected: this.collectedIds.has(collectible.id),
    }));
    const remainingSeconds = Math.max(
      0,
      this.level.timeLimitSeconds - this.elapsedSeconds,
    );
    const cargoRatio =
      this.cargoMaximum > 0 ? this.cargoIntegrity / this.cargoMaximum : 0;
    return {
      status: this.status,
      level: this.level,
      vehicle: {
        position: copyPoint(this.vehiclePosition),
        radius: this.level.vehicleRadius,
        speed: this.level.vehicleSpeed * this.speedMultiplier,
        collisionInvulnerabilityRemaining:
          this.collisionInvulnerabilityRemaining,
      },
      path: this.path.map(copyPoint),
      nextPathPointIndex: this.nextPathPointIndex,
      ink: {
        current: this.inkCurrent,
        capacity: this.inkCapacity,
        ratio: this.inkCapacity > 0 ? this.inkCurrent / this.inkCapacity : 0,
      },
      cargo: {
        integrity: this.cargoIntegrity,
        maximum: this.cargoMaximum,
        ratio: cargoRatio,
      },
      elapsedSeconds: this.elapsedSeconds,
      remainingSeconds,
      distanceTraveled: this.distanceTraveled,
      progress: this.calculateProgress(),
      coins: this.coins,
      stamps: this.stamps,
      obstacles: obstacleSnapshots,
      collectibles: collectibleSnapshots,
      relay: {
        triggered: this.relayTriggered,
        choices: [...this.relayChoices],
        selected: this.relaySelected,
      },
      lighthouse: {
        activeRemaining: this.lighthouseActiveRemaining,
        cooldownRemaining: this.lighthouseCooldownRemaining,
        ready:
          this.status === "running" &&
          this.lighthouseCooldownRemaining <= EPSILON &&
          this.lighthouseActiveRemaining <= EPSILON,
      },
      result: this.result ? { ...this.result } : null,
    };
  }

  consumeEvents(): GameEvent[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }

  private resetState(status: GameStatus): void {
    const random = new SeededRandom((this.seed + this.level.id * 0x9e3779b9) >>> 0);
    this.status = status;
    this.vehiclePosition = copyPoint(this.level.start);
    this.path = [copyPoint(this.level.start)];
    this.nextPathPointIndex = 1;
    this.inkCapacity = this.level.inkCapacity;
    this.inkCurrent = this.inkCapacity;
    this.inkCostMultiplier = 1;
    this.cargoMaximum = this.level.startingCargoIntegrity;
    this.cargoIntegrity = this.cargoMaximum;
    this.speedMultiplier = 1;
    this.elapsedSeconds = 0;
    this.distanceTraveled = 0;
    this.coins = 0;
    this.stamps = 0;
    this.accumulator = 0;
    this.collisionInvulnerabilityRemaining = 0;
    this.lighthouseActiveRemaining = 0;
    this.lighthouseCooldownRemaining = 0;
    this.lighthouseCooldownMultiplier = 1;
    this.relayTriggered = false;
    this.relaySelected = null;
    this.expressCompletionBonus = false;
    this.collectedIds = new Set<string>();
    this.result = null;
    this.events = [];
    this.obstaclePhases = this.level.obstacles.map(() => random.next() * Math.PI * 2);
    this.relayChoices = this.pickUpgradeChoices(random);
  }

  private pickUpgradeChoices(random: SeededRandom): UpgradeId[] {
    const pool = [...UPGRADE_IDS];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = random.integer(index + 1);
      const value = pool[index];
      const swapValue = pool[swapIndex];
      if (value !== undefined && swapValue !== undefined) {
        pool[index] = swapValue;
        pool[swapIndex] = value;
      }
    }
    return pool.slice(0, 3);
  }

  private rejectPath(reason: PathRejectReason): PathAppendResult {
    this.events.push({
      type: "path-rejected",
      at: this.elapsedSeconds,
      reason,
    });
    return {
      accepted: false,
      pointsAdded: 0,
      inkSpent: 0,
      endpoint: null,
      truncated: false,
      reason,
    };
  }

  private simulateStep(stepSeconds: number): void {
    this.elapsedSeconds += stepSeconds;
    this.collisionInvulnerabilityRemaining = Math.max(
      0,
      this.collisionInvulnerabilityRemaining - stepSeconds,
    );
    this.lighthouseActiveRemaining = Math.max(
      0,
      this.lighthouseActiveRemaining - stepSeconds,
    );
    this.lighthouseCooldownRemaining = Math.max(
      0,
      this.lighthouseCooldownRemaining - stepSeconds,
    );

    this.moveVehicle(stepSeconds);
    this.collectNearbyItems();
    this.resolveObstacleCollision();

    if (this.cargoIntegrity <= EPSILON) {
      this.finishLoss("cargo");
      return;
    }
    if (
      distance(this.vehiclePosition, this.level.finish.position) <=
      this.level.finish.radius + this.level.vehicleRadius
    ) {
      this.finishWin();
      return;
    }
    if (!this.relayTriggered && this.calculateProgress() >= this.level.relayProgress) {
      this.relayTriggered = true;
      this.status = "upgrade-choice";
      this.events.push({
        type: "relay",
        at: this.elapsedSeconds,
        choices: [...this.relayChoices],
      });
      return;
    }
    if (this.elapsedSeconds + EPSILON >= this.level.timeLimitSeconds) {
      this.finishLoss("time");
    }
  }

  private moveVehicle(stepSeconds: number): void {
    let movementRemaining =
      this.level.vehicleSpeed * this.speedMultiplier * stepSeconds;
    while (
      movementRemaining > EPSILON &&
      this.nextPathPointIndex < this.path.length
    ) {
      const target = this.path[this.nextPathPointIndex];
      if (!target) {
        break;
      }
      const targetDistance = distance(this.vehiclePosition, target);
      if (targetDistance <= movementRemaining + EPSILON) {
        this.vehiclePosition = copyPoint(target);
        this.nextPathPointIndex += 1;
        this.distanceTraveled += targetDistance;
        movementRemaining -= targetDistance;
      } else {
        const ratio = movementRemaining / targetDistance;
        this.vehiclePosition = {
          x:
            this.vehiclePosition.x +
            (target.x - this.vehiclePosition.x) * ratio,
          y:
            this.vehiclePosition.y +
            (target.y - this.vehiclePosition.y) * ratio,
        };
        this.distanceTraveled += movementRemaining;
        movementRemaining = 0;
      }
    }
  }

  private collectNearbyItems(): void {
    for (const collectible of this.level.collectibles) {
      if (this.collectedIds.has(collectible.id)) {
        continue;
      }
      if (
        distance(this.vehiclePosition, collectible.position) >
        this.level.vehicleRadius + collectible.radius
      ) {
        continue;
      }
      this.collectedIds.add(collectible.id);
      if (collectible.kind === "coin") {
        this.coins += collectible.value;
      } else {
        this.stamps += collectible.value;
      }
      this.events.push({
        type: "collectible",
        at: this.elapsedSeconds,
        collectibleId: collectible.id,
        kind: collectible.kind,
        value: collectible.value,
      });
    }
  }

  private resolveObstacleCollision(): void {
    if (this.collisionInvulnerabilityRemaining > EPSILON) {
      return;
    }
    for (let index = 0; index < this.level.obstacles.length; index += 1) {
      const obstacle = this.level.obstacles[index];
      if (!obstacle) {
        continue;
      }
      const obstaclePosition = this.getObstaclePosition(obstacle, index);
      if (
        distance(this.vehiclePosition, obstaclePosition) >
        this.level.vehicleRadius + obstacle.radius
      ) {
        continue;
      }

      this.collisionInvulnerabilityRemaining =
        COLLISION_INVULNERABILITY_SECONDS;
      if (this.lighthouseActiveRemaining > EPSILON) {
        this.lighthouseActiveRemaining = 0;
        this.events.push({
          type: "shield-blocked",
          at: this.elapsedSeconds,
          obstacleId: obstacle.id,
        });
      } else {
        this.cargoIntegrity = Math.max(
          0,
          this.cargoIntegrity - obstacle.damage,
        );
        this.events.push({
          type: "collision",
          at: this.elapsedSeconds,
          obstacleId: obstacle.id,
          damage: obstacle.damage,
          cargoIntegrity: this.cargoIntegrity,
        });
      }
      break;
    }
  }

  private getObstaclePosition(
    obstacle: ObstacleConfig,
    index: number,
  ): Vec2 {
    if (!obstacle.motion) {
      return copyPoint(obstacle.position);
    }
    const phase = this.obstaclePhases[index] ?? 0;
    const offset =
      Math.sin(
        phase +
          this.elapsedSeconds * Math.PI * 2 * obstacle.motion.frequency,
      ) * obstacle.motion.amplitude;
    const position = copyPoint(obstacle.position);
    position[obstacle.motion.axis] += offset;
    position.x = clamp(
      position.x,
      obstacle.radius,
      this.level.world.width - obstacle.radius,
    );
    position.y = clamp(
      position.y,
      obstacle.radius,
      this.level.world.height - obstacle.radius,
    );
    return position;
  }

  private calculateProgress(): number {
    const start = this.level.start;
    const finish = this.level.finish.position;
    const routeX = finish.x - start.x;
    const routeY = finish.y - start.y;
    const routeLengthSquared = routeX * routeX + routeY * routeY;
    if (routeLengthSquared <= EPSILON) {
      return 1;
    }
    const fromStartX = this.vehiclePosition.x - start.x;
    const fromStartY = this.vehiclePosition.y - start.y;
    const projection =
      (fromStartX * routeX + fromStartY * routeY) / routeLengthSquared;
    return clamp(projection, 0, 1);
  }

  private applyUpgrade(upgradeId: UpgradeId): void {
    switch (upgradeId) {
      case "tailwind":
        this.speedMultiplier *= 1.18;
        break;
      case "reinforced-crate":
        this.cargoMaximum += 20;
        this.cargoIntegrity = Math.min(
          this.cargoMaximum,
          this.cargoIntegrity + 20,
        );
        break;
      case "cloud-recycler":
        this.inkCurrent = Math.min(
          this.inkCapacity,
          this.inkCurrent + this.inkCapacity * 0.3,
        );
        this.inkCostMultiplier *= 0.82;
        break;
      case "lighthouse-lens":
        this.lighthouseCooldownMultiplier *= 0.7;
        this.lighthouseCooldownRemaining = 0;
        break;
      case "express-bonus":
        this.coins += 12;
        this.expressCompletionBonus = true;
        break;
    }
  }

  private finishWin(): void {
    const remainingRatio =
      Math.max(0, this.level.timeLimitSeconds - this.elapsedSeconds) /
      this.level.timeLimitSeconds;
    let stars: 1 | 2 | 3 = 1;
    if (this.cargoIntegrity >= this.level.starCriteria.cargoForTwoStars) {
      stars = 2;
    }
    if (
      this.cargoIntegrity >= this.level.starCriteria.cargoForThreeStars &&
      remainingRatio >=
        this.level.starCriteria.minTimeRemainingRatioForThree
    ) {
      stars = 3;
    }

    this.coins +=
      this.level.baseCoinReward +
      stars * 4 +
      (this.expressCompletionBonus ? 10 : 0);
    this.stamps += this.level.baseStampReward + (stars === 3 ? 1 : 0);
    this.result = {
      outcome: "won",
      stars,
      coinsEarned: this.coins,
      stampsEarned: this.stamps,
      reason: null,
    };
    this.status = "won";
    this.events.push({
      type: "won",
      at: this.elapsedSeconds,
      result: { ...this.result },
    });
  }

  private finishLoss(reason: LossReason): void {
    this.result = {
      outcome: "lost",
      stars: 0,
      coinsEarned: this.coins,
      stampsEarned: this.stamps,
      reason,
    };
    this.status = "lost";
    this.events.push({
      type: "lost",
      at: this.elapsedSeconds,
      result: { ...this.result },
    });
  }
}

export const createGame = (options?: GameCoreOptions): CloudwayGame =>
  new CloudwayGame(options);

export type {
  GameCoreOptions,
  GameEvent,
  GameSnapshot,
  LevelConfig,
  LevelId,
  PathAppendResult,
  UpgradeId,
  Vec2,
} from "./types";
