export const SAVE_SCHEMA_VERSION = 2 as const;
export const SAVE_STORAGE_KEY = "cloudway-postman.save";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GameSettings {
  muted: boolean;
  reducedMotion: boolean;
}

export interface LevelRecord {
  stars: number;
  bestScore: number;
  completed: boolean;
}

export interface BuildingLevels {
  home: number;
  convenienceStore: number;
  dispatchCenter: number;
}

export interface RewardLedgerEntry {
  providerId: string;
  grantKind: string;
  grantSignature: string;
  grantedAt: number;
}

export interface GameSave {
  version: typeof SAVE_SCHEMA_VERSION;
  coins: number;
  stamps: number;
  xp: number;
  level: number;
  aidTickets: number;
  vehicleLevel: number;
  unlockedCharacters: string[];
  selectedCharacter: string;
  buildings: BuildingLevels;
  levelRecords: Record<string, LevelRecord>;
  settings: GameSettings;
  rewardLedger: Record<string, RewardLedgerEntry>;
  updatedAt: number;
}

export const DEFAULT_SAVE: Readonly<GameSave> = Object.freeze({
  version: SAVE_SCHEMA_VERSION,
  coins: 120,
  stamps: 0,
  xp: 0,
  level: 1,
  aidTickets: 3,
  vehicleLevel: 1,
  unlockedCharacters: Object.freeze(["rookie"]) as unknown as string[],
  selectedCharacter: "rookie",
  buildings: Object.freeze({
    home: 1,
    convenienceStore: 1,
    dispatchCenter: 1,
  }),
  levelRecords: Object.freeze({}),
  settings: Object.freeze({ muted: false, reducedMotion: false }),
  rewardLedger: Object.freeze({}),
  updatedAt: 0,
});

type SaveListener = (save: Readonly<GameSave>) => void;
type SaveMutator = (draft: GameSave) => void | GameSave;

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function freshDefault(): GameSave {
  return {
    version: SAVE_SCHEMA_VERSION,
    coins: DEFAULT_SAVE.coins,
    stamps: DEFAULT_SAVE.stamps,
    xp: DEFAULT_SAVE.xp,
    level: DEFAULT_SAVE.level,
    aidTickets: DEFAULT_SAVE.aidTickets,
    vehicleLevel: DEFAULT_SAVE.vehicleLevel,
    unlockedCharacters: [...DEFAULT_SAVE.unlockedCharacters],
    selectedCharacter: DEFAULT_SAVE.selectedCharacter,
    buildings: { ...DEFAULT_SAVE.buildings },
    levelRecords: {},
    settings: { ...DEFAULT_SAVE.settings },
    rewardLedger: {},
    updatedAt: DEFAULT_SAVE.updatedAt,
  };
}

function cloneSave(save: GameSave): GameSave {
  return JSON.parse(JSON.stringify(save)) as GameSave;
}

function finiteNumber(value: unknown, fallback: number, minimum = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(minimum, value)
    : fallback;
}

function integer(value: unknown, fallback: number, minimum = 0): number {
  return Math.floor(finiteNumber(value, fallback, minimum));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const clean = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return clean.length > 0 ? [...new Set(clean)] : [...fallback];
}

function normalizeLevelRecords(value: unknown): Record<string, LevelRecord> {
  const normalized: Record<string, LevelRecord> = {};
  for (const [id, candidate] of Object.entries(record(value))) {
    const source = record(candidate);
    normalized[id] = {
      stars: Math.min(3, integer(source.stars, 0)),
      bestScore: integer(source.bestScore ?? source.score, 0),
      completed: source.completed === true || integer(source.stars, 0) > 0,
    };
  }
  return normalized;
}

function normalizeLedger(value: unknown): Record<string, RewardLedgerEntry> {
  const normalized: Record<string, RewardLedgerEntry> = {};
  for (const [ticketId, candidate] of Object.entries(record(value))) {
    const source = record(candidate);
    if (
      typeof source.providerId !== "string" ||
      typeof source.grantKind !== "string" ||
      typeof source.grantSignature !== "string"
    ) {
      continue;
    }
    normalized[ticketId] = {
      providerId: source.providerId,
      grantKind: source.grantKind,
      grantSignature: source.grantSignature,
      grantedAt: finiteNumber(source.grantedAt, 0),
    };
  }
  return normalized;
}

function migrate(raw: unknown): GameSave | null {
  const source = record(raw);
  if (Object.keys(source).length === 0) return null;

  const sourceVersion = integer(source.version, 0);
  if (sourceVersion > SAVE_SCHEMA_VERSION) return null;

  const defaults = freshDefault();
  const legacyTown = record(source.town);
  const buildings = record(source.buildings ?? legacyTown.buildings ?? legacyTown);
  const settings = record(source.settings);
  const unlockedCharacters = stringList(
    source.unlockedCharacters ?? source.characters,
    defaults.unlockedCharacters,
  );
  const selectedCandidate = source.selectedCharacter ?? source.selectedCourier;
  const selectedCharacter =
    typeof selectedCandidate === "string" && unlockedCharacters.includes(selectedCandidate)
      ? selectedCandidate
      : unlockedCharacters[0] ?? defaults.selectedCharacter;

  return {
    version: SAVE_SCHEMA_VERSION,
    coins: integer(source.coins ?? source.gold, defaults.coins),
    stamps: integer(source.stamps, defaults.stamps),
    xp: integer(source.xp ?? source.experience, defaults.xp),
    level: integer(source.level ?? source.playerLevel, defaults.level, 1),
    aidTickets: integer(source.aidTickets ?? source.tickets, defaults.aidTickets),
    vehicleLevel: integer(source.vehicleLevel ?? source.cartLevel, defaults.vehicleLevel, 1),
    unlockedCharacters,
    selectedCharacter,
    buildings: {
      home: integer(buildings.home, defaults.buildings.home, 1),
      convenienceStore: integer(
        buildings.convenienceStore ?? buildings.shop,
        defaults.buildings.convenienceStore,
        1,
      ),
      dispatchCenter: integer(
        buildings.dispatchCenter ?? buildings.postOffice,
        defaults.buildings.dispatchCenter,
        1,
      ),
    },
    levelRecords: normalizeLevelRecords(source.levelRecords ?? source.progress),
    settings: {
      muted: typeof settings.muted === "boolean" ? settings.muted : defaults.settings.muted,
      reducedMotion:
        typeof settings.reducedMotion === "boolean"
          ? settings.reducedMotion
          : defaults.settings.reducedMotion,
    },
    rewardLedger: normalizeLedger(source.rewardLedger),
    updatedAt: finiteNumber(source.updatedAt, defaults.updatedAt),
  };
}

function browserStorage(): StorageLike {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      const probeKey = `${SAVE_STORAGE_KEY}.probe`;
      globalThis.localStorage.setItem(probeKey, "1");
      globalThis.localStorage.removeItem(probeKey);
      return globalThis.localStorage;
    }
  } catch {
    // Private browsing and embedded webviews may deny storage access.
  }
  return new MemoryStorage();
}

export class GameSaveStore {
  private readonly listeners = new Set<SaveListener>();

  constructor(
    private readonly storage: StorageLike = browserStorage(),
    private readonly key = SAVE_STORAGE_KEY,
  ) {}

  load(): GameSave {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
      if (raw === null) return freshDefault();
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrate(parsed);
      if (migrated === null) {
        this.backUpCorrupt(raw);
        return freshDefault();
      }
      if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
        this.persist(migrated);
      }
      return cloneSave(migrated);
    } catch {
      if (raw !== null) this.backUpCorrupt(raw);
      return freshDefault();
    }
  }

  save(candidate: GameSave): GameSave {
    const normalized = migrate(candidate) ?? freshDefault();
    normalized.updatedAt = Date.now();
    this.persist(normalized);
    const snapshot = cloneSave(normalized);
    for (const listener of this.listeners) listener(snapshot);
    return snapshot;
  }

  update(mutator: SaveMutator): GameSave {
    const draft = this.load();
    const returned = mutator(draft);
    return this.save(returned ?? draft);
  }

  reset(): GameSave {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Reset still returns a usable in-memory default if storage is unavailable.
    }
    const reset = freshDefault();
    for (const listener of this.listeners) listener(cloneSave(reset));
    return reset;
  }

  subscribe(listener: SaveListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private persist(save: GameSave): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(save));
    } catch {
      // Full quotas or blocked storage must never stop the game loop.
    }
  }

  private backUpCorrupt(raw: string): void {
    try {
      this.storage.setItem(`${this.key}.corrupt`, raw);
      this.storage.removeItem(this.key);
    } catch {
      // Best effort only; the caller still receives a safe default.
    }
  }
}

export const gameSaveStore = new GameSaveStore();

export function loadGameSave(): GameSave {
  return gameSaveStore.load();
}

export function saveGameSave(save: GameSave): GameSave {
  return gameSaveStore.save(save);
}

export function updateGameSave(mutator: SaveMutator): GameSave {
  return gameSaveStore.update(mutator);
}

export function resetGameSave(): GameSave {
  return gameSaveStore.reset();
}
