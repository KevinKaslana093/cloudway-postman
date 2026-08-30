import { describe, expect, it } from "vitest";

import { LEVELS } from "../src/content";
import { createGame } from "../src/game-core";
import type { LevelConfig } from "../src/types";

const makeTestLevel = (
  overrides: Partial<LevelConfig> = {},
): LevelConfig => {
  const base = LEVELS[0];
  if (!base) {
    throw new Error("Built-in level 1 is missing");
  }
  return {
    ...base,
    title: "Test Route",
    subtitle: "Deterministic test level",
    timeLimitSeconds: 20,
    inkCapacity: 2_000,
    vehicleSpeed: 100,
    relayProgress: 2,
    obstacles: [],
    collectibles: [],
    ...overrides,
  };
};

describe("data-driven campaign", () => {
  it("ships five increasingly labelled levels", () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(LEVELS.map((level) => level.slug)).size).toBe(5);
    expect(LEVELS[4]?.obstacles.length).toBeGreaterThan(
      LEVELS[0]?.obstacles.length ?? 0,
    );
  });
});

describe("CloudwayGame", () => {
  it("spends cloud ink, subdivides long strokes and follows the polyline", () => {
    const level = makeTestLevel();
    const game = createGame({ level, seed: 11 });
    game.start();

    const before = game.getSnapshot();
    const added = game.appendPath({ x: 275, y: 672 });
    const afterDraw = game.getSnapshot();

    expect(added.accepted).toBe(true);
    expect(added.pointsAdded).toBeGreaterThan(1);
    expect(afterDraw.ink.current).toBeLessThan(before.ink.current);
    expect(afterDraw.path.at(-1)).toEqual({ x: 275, y: 672 });

    const afterMove = game.advance(0.5);
    expect(afterMove.distanceTraveled).toBeCloseTo(50, 4);
    expect(afterMove.vehicle.position.x).toBeGreaterThan(level.start.x);
    expect(afterMove.vehicle.position.y).toBeLessThan(level.start.y);
  });

  it("truncates a stroke exactly when cloud ink runs out", () => {
    const level = makeTestLevel({
      inkCapacity: 41,
      pathRules: {
        inkPerPixel: 1,
        minPointSpacing: 5,
        maxSegmentLength: 20,
      },
    });
    const game = createGame({ level });
    game.start();
    const result = game.appendPath({ x: 195, y: 650 });

    expect(result.accepted).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.inkSpent).toBeCloseTo(41, 5);
    expect(result.endpoint?.y).toBeCloseTo(711, 5);
    expect(game.getSnapshot().ink.current).toBeCloseTo(0, 5);
    expect(game.appendPath({ x: 195, y: 650 }).reason).toBe("no-ink");
  });

  it("uses a fixed seed for obstacle phases and relay choices", () => {
    const first = createGame({ levelId: 2, seed: 4242 });
    const second = createGame({ levelId: 2, seed: 4242 });
    const different = createGame({ levelId: 2, seed: 4243 });
    first.start();
    second.start();
    different.start();

    const firstSnapshot = first.getSnapshot();
    const secondSnapshot = second.getSnapshot();
    const differentSnapshot = different.getSnapshot();
    expect(firstSnapshot.obstacles).toEqual(secondSnapshot.obstacles);
    expect(firstSnapshot.relay.choices).toEqual(secondSnapshot.relay.choices);
    expect(firstSnapshot.obstacles[0]?.runtimePosition).not.toEqual(
      differentSnapshot.obstacles[0]?.runtimePosition,
    );
  });

  it("lets the lighthouse absorb one collision before cargo is damaged", () => {
    const obstacle = {
      id: "test-storm",
      kind: "storm" as const,
      position: { x: 195, y: 752 },
      radius: 30,
      damage: 35,
    };
    const level = makeTestLevel({ obstacles: [obstacle] });
    const shielded = createGame({ level });
    shielded.start();

    expect(shielded.activateLighthouse()).toBe(true);
    const protectedSnapshot = shielded.advance(1 / 60);
    expect(protectedSnapshot.cargo.integrity).toBe(100);
    expect(protectedSnapshot.lighthouse.activeRemaining).toBe(0);
    expect(
      shielded.consumeEvents().some((event) => event.type === "shield-blocked"),
    ).toBe(true);

    const exposed = createGame({ level });
    exposed.start();
    const damagedSnapshot = exposed.advance(1 / 60);
    expect(damagedSnapshot.cargo.integrity).toBe(65);
    expect(
      exposed.consumeEvents().some((event) => event.type === "collision"),
    ).toBe(true);
  });

  it("pauses at the halfway relay until a seeded upgrade is selected", () => {
    const level = makeTestLevel({
      vehicleSpeed: 500,
      relayProgress: 0.3,
    });
    const game = createGame({ level, seed: 77 });
    game.start();
    game.appendPath({ x: 195, y: 104 });

    const atRelay = game.advance(0.5);
    expect(atRelay.status).toBe("upgrade-choice");
    expect(atRelay.relay.triggered).toBe(true);
    expect(atRelay.relay.choices).toHaveLength(3);

    const selected = atRelay.relay.choices[0];
    expect(selected).toBeDefined();
    if (!selected) {
      throw new Error("No relay upgrade was offered");
    }
    expect(game.chooseRelayUpgrade(selected)).toBe(true);
    const resumed = game.getSnapshot();
    expect(resumed.status).toBe("running");
    expect(resumed.relay.selected).toBe(selected);
  });

  it("wins at the lighthouse and produces stars, coins and stamps", () => {
    const level = makeTestLevel({
      finish: { position: { x: 195, y: 690 }, radius: 14 },
      vehicleSpeed: 150,
      baseCoinReward: 20,
      baseStampReward: 1,
    });
    const game = createGame({ level });
    game.start();
    game.appendPath(level.finish.position);
    const finished = game.advance(0.5);

    expect(finished.status).toBe("won");
    expect(finished.result).toMatchObject({
      outcome: "won",
      stars: 3,
      reason: null,
    });
    expect(finished.result?.coinsEarned).toBeGreaterThan(20);
    expect(finished.result?.stampsEarned).toBeGreaterThanOrEqual(2);
  });

  it("loses when time expires without a route", () => {
    const level = makeTestLevel({ timeLimitSeconds: 0.1 });
    const game = createGame({ level });
    game.start();
    const finished = game.advance(0.2);

    expect(finished.status).toBe("lost");
    expect(finished.result).toMatchObject({
      outcome: "lost",
      stars: 0,
      reason: "time",
    });
  });
});
