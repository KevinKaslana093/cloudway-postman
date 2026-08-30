export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface Vec2 {
  x: number;
  y: number;
}

export interface WorldSize {
  width: number;
  height: number;
}

export type ObstacleKind = "storm" | "rock" | "windmill";

export interface ObstacleMotion {
  axis: "x" | "y";
  amplitude: number;
  /** Full oscillations per second. */
  frequency: number;
}

export interface ObstacleConfig {
  id: string;
  kind: ObstacleKind;
  position: Vec2;
  radius: number;
  damage: number;
  motion?: ObstacleMotion;
}

export type CollectibleKind = "coin" | "stamp";

export interface CollectibleConfig {
  id: string;
  kind: CollectibleKind;
  position: Vec2;
  radius: number;
  value: number;
}

export interface LighthouseConfig {
  shieldDurationSeconds: number;
  cooldownSeconds: number;
}

export interface PathRules {
  inkPerPixel: number;
  minPointSpacing: number;
  maxSegmentLength: number;
}

export interface StarCriteria {
  cargoForTwoStars: number;
  cargoForThreeStars: number;
  minTimeRemainingRatioForThree: number;
}

export interface LevelConfig {
  id: LevelId;
  slug: string;
  title: string;
  subtitle: string;
  difficultyLabel: string;
  world: WorldSize;
  start: Vec2;
  finish: {
    position: Vec2;
    radius: number;
  };
  timeLimitSeconds: number;
  vehicleSpeed: number;
  vehicleRadius: number;
  startingCargoIntegrity: number;
  inkCapacity: number;
  pathRules: PathRules;
  lighthouse: LighthouseConfig;
  relayProgress: number;
  baseCoinReward: number;
  baseStampReward: number;
  starCriteria: StarCriteria;
  obstacles: readonly ObstacleConfig[];
  collectibles: readonly CollectibleConfig[];
}

export type UpgradeId =
  | "tailwind"
  | "reinforced-crate"
  | "cloud-recycler"
  | "lighthouse-lens"
  | "express-bonus";

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
}

export type GameStatus =
  | "ready"
  | "running"
  | "upgrade-choice"
  | "won"
  | "lost";

export type LossReason = "time" | "cargo";

export interface ObstacleSnapshot extends ObstacleConfig {
  runtimePosition: Vec2;
}

export interface CollectibleSnapshot extends CollectibleConfig {
  collected: boolean;
}

export interface RelaySnapshot {
  triggered: boolean;
  choices: readonly UpgradeId[];
  selected: UpgradeId | null;
}

export interface LighthouseSnapshot {
  activeRemaining: number;
  cooldownRemaining: number;
  ready: boolean;
}

export interface LevelResult {
  outcome: "won" | "lost";
  stars: 0 | 1 | 2 | 3;
  coinsEarned: number;
  stampsEarned: number;
  reason: LossReason | null;
}

export interface GameSnapshot {
  status: GameStatus;
  level: LevelConfig;
  vehicle: {
    position: Vec2;
    radius: number;
    speed: number;
    collisionInvulnerabilityRemaining: number;
  };
  path: readonly Vec2[];
  nextPathPointIndex: number;
  ink: {
    current: number;
    capacity: number;
    ratio: number;
  };
  cargo: {
    integrity: number;
    maximum: number;
    ratio: number;
  };
  elapsedSeconds: number;
  remainingSeconds: number;
  distanceTraveled: number;
  progress: number;
  coins: number;
  stamps: number;
  obstacles: readonly ObstacleSnapshot[];
  collectibles: readonly CollectibleSnapshot[];
  relay: RelaySnapshot;
  lighthouse: LighthouseSnapshot;
  result: LevelResult | null;
}

export type PathRejectReason =
  | "not-running"
  | "outside-world"
  | "too-close"
  | "no-ink";

export interface PathAppendResult {
  accepted: boolean;
  pointsAdded: number;
  inkSpent: number;
  endpoint: Vec2 | null;
  truncated: boolean;
  reason: PathRejectReason | null;
}

export type GameEvent =
  | {
      type: "started";
      at: number;
      levelId: LevelId;
    }
  | {
      type: "path-added";
      at: number;
      pointsAdded: number;
      inkSpent: number;
      endpoint: Vec2;
      truncated: boolean;
    }
  | {
      type: "path-rejected";
      at: number;
      reason: PathRejectReason;
    }
  | {
      type: "collision";
      at: number;
      obstacleId: string;
      damage: number;
      cargoIntegrity: number;
    }
  | {
      type: "shield-blocked";
      at: number;
      obstacleId: string;
    }
  | {
      type: "collectible";
      at: number;
      collectibleId: string;
      kind: CollectibleKind;
      value: number;
    }
  | {
      type: "relay";
      at: number;
      choices: readonly UpgradeId[];
    }
  | {
      type: "upgrade";
      at: number;
      upgradeId: UpgradeId;
    }
  | {
      type: "shield-activated";
      at: number;
      duration: number;
    }
  | {
      type: "won";
      at: number;
      result: LevelResult;
    }
  | {
      type: "lost";
      at: number;
      result: LevelResult;
    };

export interface GameCoreOptions {
  levelId?: LevelId | number;
  /** Supplying a level is useful for tests, previews and later live events. */
  level?: LevelConfig;
  seed?: number;
  fixedStepSeconds?: number;
}
