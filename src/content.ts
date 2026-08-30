import type {
  CollectibleConfig,
  LevelConfig,
  LevelId,
  UpgradeDefinition,
  UpgradeId,
} from "./types";

const WORLD = { width: 390, height: 844 } as const;
const START = { x: 195, y: 752 } as const;
const FINISH = { position: { x: 195, y: 104 }, radius: 34 } as const;

const coins = (
  entries: ReadonlyArray<readonly [string, number, number, number?]>,
): CollectibleConfig[] =>
  entries.map(([id, x, y, value = 3]) => ({
    id,
    kind: "coin",
    position: { x, y },
    radius: 15,
    value,
  }));

const stamp = (id: string, x: number, y: number): CollectibleConfig => ({
  id,
  kind: "stamp",
  position: { x, y },
  radius: 18,
  value: 1,
});

const sharedRules = {
  world: WORLD,
  start: START,
  finish: FINISH,
  vehicleRadius: 13,
  startingCargoIntegrity: 100,
  pathRules: {
    inkPerPixel: 0.82,
    minPointSpacing: 5,
    maxSegmentLength: 52,
  },
  lighthouse: {
    shieldDurationSeconds: 3.2,
    cooldownSeconds: 16,
  },
  relayProgress: 0.5,
  starCriteria: {
    cargoForTwoStars: 70,
    cargoForThreeStars: 90,
    minTimeRemainingRatioForThree: 0.18,
  },
} as const;

export const LEVELS: readonly LevelConfig[] = [
  {
    ...sharedRules,
    id: 1,
    slug: "morning-mail",
    title: "晨风第一投",
    subtitle: "绕过两团静云，把早餐信送到灯塔。",
    difficultyLabel: "入门",
    timeLimitSeconds: 78,
    vehicleSpeed: 76,
    inkCapacity: 760,
    baseCoinReward: 24,
    baseStampReward: 1,
    obstacles: [
      {
        id: "cloud-1-a",
        kind: "storm",
        position: { x: 195, y: 540 },
        radius: 36,
        damage: 18,
      },
      {
        id: "rock-1-b",
        kind: "rock",
        position: { x: 118, y: 330 },
        radius: 30,
        damage: 22,
      },
    ],
    collectibles: [
      ...coins([
        ["coin-1-a", 140, 620],
        ["coin-1-b", 245, 440],
        ["coin-1-c", 205, 230, 5],
      ]),
      stamp("stamp-1", 282, 315),
    ],
  },
  {
    ...sharedRules,
    id: 2,
    slug: "crosswind-market",
    title: "横风集市",
    subtitle: "风暴会横向巡游，观察节奏再下笔。",
    difficultyLabel: "轻风",
    timeLimitSeconds: 76,
    vehicleSpeed: 80,
    inkCapacity: 735,
    baseCoinReward: 30,
    baseStampReward: 1,
    obstacles: [
      {
        id: "storm-2-a",
        kind: "storm",
        position: { x: 195, y: 560 },
        radius: 34,
        damage: 20,
        motion: { axis: "x", amplitude: 112, frequency: 0.105 },
      },
      {
        id: "rock-2-b",
        kind: "rock",
        position: { x: 285, y: 370 },
        radius: 35,
        damage: 24,
      },
      {
        id: "storm-2-c",
        kind: "storm",
        position: { x: 130, y: 225 },
        radius: 28,
        damage: 18,
      },
    ],
    collectibles: [
      ...coins([
        ["coin-2-a", 92, 550, 4],
        ["coin-2-b", 300, 470, 4],
        ["coin-2-c", 88, 290, 5],
      ]),
      stamp("stamp-2", 280, 190),
    ],
  },
  {
    ...sharedRules,
    id: 3,
    slug: "clockwork-gate",
    title: "钟摆云门",
    subtitle: "两座风车交错摆动，路线和时机同样重要。",
    difficultyLabel: "进阶",
    timeLimitSeconds: 73,
    vehicleSpeed: 84,
    inkCapacity: 715,
    baseCoinReward: 38,
    baseStampReward: 1,
    obstacles: [
      {
        id: "windmill-3-a",
        kind: "windmill",
        position: { x: 120, y: 555 },
        radius: 34,
        damage: 24,
        motion: { axis: "x", amplitude: 92, frequency: 0.14 },
      },
      {
        id: "windmill-3-b",
        kind: "windmill",
        position: { x: 270, y: 390 },
        radius: 36,
        damage: 24,
        motion: { axis: "x", amplitude: 90, frequency: 0.13 },
      },
      {
        id: "rock-3-c",
        kind: "rock",
        position: { x: 195, y: 235 },
        radius: 38,
        damage: 26,
      },
    ],
    collectibles: [
      ...coins([
        ["coin-3-a", 310, 610, 5],
        ["coin-3-b", 78, 455, 5],
        ["coin-3-c", 305, 275, 6],
      ]),
      stamp("stamp-3", 112, 185),
    ],
  },
  {
    ...sharedRules,
    id: 4,
    slug: "fragile-mooncakes",
    title: "易碎月饼箱",
    subtitle: "货箱更脆、云墨更少；灯塔护盾要留在刀口。",
    difficultyLabel: "困难",
    timeLimitSeconds: 70,
    vehicleSpeed: 87,
    startingCargoIntegrity: 85,
    inkCapacity: 690,
    baseCoinReward: 48,
    baseStampReward: 2,
    starCriteria: {
      cargoForTwoStars: 58,
      cargoForThreeStars: 76,
      minTimeRemainingRatioForThree: 0.16,
    },
    obstacles: [
      {
        id: "storm-4-a",
        kind: "storm",
        position: { x: 115, y: 610 },
        radius: 34,
        damage: 24,
        motion: { axis: "x", amplitude: 72, frequency: 0.16 },
      },
      {
        id: "rock-4-b",
        kind: "rock",
        position: { x: 250, y: 510 },
        radius: 39,
        damage: 28,
      },
      {
        id: "storm-4-c",
        kind: "storm",
        position: { x: 120, y: 365 },
        radius: 36,
        damage: 25,
        motion: { axis: "y", amplitude: 62, frequency: 0.12 },
      },
      {
        id: "windmill-4-d",
        kind: "windmill",
        position: { x: 270, y: 235 },
        radius: 34,
        damage: 26,
        motion: { axis: "x", amplitude: 65, frequency: 0.15 },
      },
    ],
    collectibles: [
      ...coins([
        ["coin-4-a", 315, 630, 6],
        ["coin-4-b", 78, 495, 6],
        ["coin-4-c", 302, 345, 7],
      ]),
      stamp("stamp-4", 108, 225),
    ],
  },
  {
    ...sharedRules,
    id: 5,
    slug: "tempest-express",
    title: "暴风特快",
    subtitle: "移动风暴、窄路与限时合同的终极组合。",
    difficultyLabel: "车队考验",
    timeLimitSeconds: 66,
    vehicleSpeed: 92,
    inkCapacity: 675,
    baseCoinReward: 65,
    baseStampReward: 2,
    lighthouse: {
      shieldDurationSeconds: 2.8,
      cooldownSeconds: 18,
    },
    obstacles: [
      {
        id: "storm-5-a",
        kind: "storm",
        position: { x: 195, y: 650 },
        radius: 35,
        damage: 26,
        motion: { axis: "x", amplitude: 125, frequency: 0.18 },
      },
      {
        id: "windmill-5-b",
        kind: "windmill",
        position: { x: 95, y: 520 },
        radius: 34,
        damage: 27,
        motion: { axis: "y", amplitude: 52, frequency: 0.16 },
      },
      {
        id: "rock-5-c",
        kind: "rock",
        position: { x: 258, y: 430 },
        radius: 42,
        damage: 30,
      },
      {
        id: "storm-5-d",
        kind: "storm",
        position: { x: 112, y: 300 },
        radius: 35,
        damage: 27,
        motion: { axis: "x", amplitude: 78, frequency: 0.2 },
      },
      {
        id: "windmill-5-e",
        kind: "windmill",
        position: { x: 268, y: 195 },
        radius: 31,
        damage: 26,
        motion: { axis: "x", amplitude: 70, frequency: 0.17 },
      },
    ],
    collectibles: [
      ...coins([
        ["coin-5-a", 65, 640, 7],
        ["coin-5-b", 314, 540, 7],
        ["coin-5-c", 76, 405, 8],
        ["coin-5-d", 310, 285, 8],
      ]),
      stamp("stamp-5", 108, 175),
    ],
  },
] as const;

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
  tailwind: {
    id: "tailwind",
    title: "顺风快递",
    description: "本局邮车速度提高 18%。",
  },
  "reinforced-crate": {
    id: "reinforced-crate",
    title: "加固货箱",
    description: "货物上限与当前完整度各提高 20 点。",
  },
  "cloud-recycler": {
    id: "cloud-recycler",
    title: "云墨回收",
    description: "恢复 30% 云墨，并让后续画路节省 18%。",
  },
  "lighthouse-lens": {
    id: "lighthouse-lens",
    title: "聚光镜片",
    description: "立即刷新护盾，并缩短 30% 冷却。",
  },
  "express-bonus": {
    id: "express-bonus",
    title: "特快小费",
    description: "立即获得 12 金币，准时送达再追加 10 金币。",
  },
};

export const UPGRADE_IDS = Object.freeze(
  Object.keys(UPGRADES) as UpgradeId[],
);

export function getLevelConfig(levelId: LevelId | number): LevelConfig {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) {
    throw new RangeError(`Unknown level: ${levelId}`);
  }
  return level;
}
