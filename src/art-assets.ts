import type { LevelId } from "./types";

const ART_DIRECTORY = "assets/art/";

const BACKGROUND_FILES = {
  1: "bg-1-morning.webp",
  2: "bg-2-market.webp",
  3: "bg-3-clockwork.webp",
  4: "bg-4-moon.webp",
  5: "bg-5-tempest.webp",
} as const satisfies Readonly<Record<LevelId, string>>;

export const COMMON_SPRITE_FILES = {
  postalVan: "postal-van.webp",
  storm: "obstacle-storm.webp",
  rock: "obstacle-rock.webp",
  rotor: "obstacle-rotor.webp",
  coin: "pickup-coin.webp",
  stamp: "pickup-stamp.webp",
  destination: "destination.webp",
} as const;

export type CommonSpriteKey = keyof typeof COMMON_SPRITE_FILES;
export type ArtAssetStatus = "idle" | "loading" | "ready" | "failed";

export type ArtAssetRef =
  | { readonly kind: "background"; readonly levelId: LevelId }
  | { readonly kind: "common"; readonly key: CommonSpriteKey };

export interface ArtPreloadOptions {
  /** Omit this field to preload all five backgrounds. */
  readonly levels?: readonly LevelId[];
  /** Omit this field to preload all shared sprites. */
  readonly common?: readonly CommonSpriteKey[];
}

export type WeatherKind =
  | "morning-breeze"
  | "crosswind"
  | "clockwork-gust"
  | "moonlit-squall"
  | "tempest";

export interface LevelArtTheme {
  readonly sky: readonly [top: string, middle: string, bottom: string];
  readonly ambientTint: string;
  readonly cloudTint: string;
  readonly vignette: string;
  readonly landmarkGlow: string;
  readonly weather: {
    readonly kind: WeatherKind;
    /** Normalized visual intensity. It must not affect simulation difficulty. */
    readonly intensity: number;
    readonly windX: number;
    readonly windY: number;
    readonly cloudSpeed: number;
    readonly rain: number;
    readonly lightning: number;
    readonly particleColor: string;
  };
}

export const LEVEL_ART_THEMES = {
  1: {
    sky: ["#78d8f2", "#bcecf3", "#fff1be"],
    ambientTint: "#ffcf7a",
    cloudTint: "#fffaf0",
    vignette: "rgba(40, 91, 108, 0.14)",
    landmarkGlow: "#ffb35c",
    weather: {
      kind: "morning-breeze",
      intensity: 0.18,
      windX: 0.18,
      windY: -0.02,
      cloudSpeed: 0.45,
      rain: 0,
      lightning: 0,
      particleColor: "#fff1be",
    },
  },
  2: {
    sky: ["#43c7e8", "#80ddec", "#dff5e8"],
    ambientTint: "#ffc84a",
    cloudTint: "#f6ffff",
    vignette: "rgba(37, 91, 112, 0.18)",
    landmarkGlow: "#ff735e",
    weather: {
      kind: "crosswind",
      intensity: 0.4,
      windX: 0.72,
      windY: -0.04,
      cloudSpeed: 0.95,
      rain: 0.08,
      lightning: 0.05,
      particleColor: "#ffc84a",
    },
  },
  3: {
    sky: ["#70b8c3", "#f6c887", "#fff0cf"],
    ambientTint: "#d99b37",
    cloudTint: "#fff0cf",
    vignette: "rgba(89, 66, 58, 0.2)",
    landmarkGlow: "#ffe19a",
    weather: {
      kind: "clockwork-gust",
      intensity: 0.5,
      windX: 0.5,
      windY: 0,
      cloudSpeed: 0.75,
      rain: 0,
      lightning: 0,
      particleColor: "#e7b55a",
    },
  },
  4: {
    sky: ["#353f86", "#7d62b8", "#d5b6c7"],
    ambientTint: "#ffc857",
    cloudTint: "#c9c6e8",
    vignette: "rgba(35, 35, 86, 0.3)",
    landmarkGlow: "#ffd979",
    weather: {
      kind: "moonlit-squall",
      intensity: 0.66,
      windX: 0.44,
      windY: -0.12,
      cloudSpeed: 1.05,
      rain: 0.28,
      lightning: 0.18,
      particleColor: "#f5e8ca",
    },
  },
  5: {
    sky: ["#172c55", "#225e7a", "#5b9bb1"],
    ambientTint: "#5bc2d9",
    cloudTint: "#7893ae",
    vignette: "rgba(9, 20, 48, 0.46)",
    landmarkGlow: "#ffc94a",
    weather: {
      kind: "tempest",
      intensity: 1,
      windX: 0.88,
      windY: 0.2,
      cloudSpeed: 1.6,
      rain: 0.82,
      lightning: 0.72,
      particleColor: "#b69cff",
    },
  },
} as const satisfies Readonly<Record<LevelId, LevelArtTheme>>;

interface CacheEntry {
  status: ArtAssetStatus;
  image: HTMLImageElement | null;
  promise: Promise<HTMLImageElement | null> | null;
}

const LEVEL_IDS = [1, 2, 3, 4, 5] as const satisfies readonly LevelId[];
const COMMON_KEYS = Object.freeze(
  Object.keys(COMMON_SPRITE_FILES) as CommonSpriteKey[],
);

function refId(ref: ArtAssetRef): string {
  return ref.kind === "background" ? `background:${ref.levelId}` : `common:${ref.key}`;
}

function fileFor(ref: ArtAssetRef): string {
  return ref.kind === "background"
    ? BACKGROUND_FILES[ref.levelId]
    : COMMON_SPRITE_FILES[ref.key];
}

/** Resolve from the document itself so relative Vite builds keep their Pages subpath. */
export function resolveArtAssetUrl(fileName: string): string {
  const relativeUrl = `./${ART_DIRECTORY}${fileName}`;
  if (typeof document === "undefined") return relativeUrl;

  try {
    return new URL(relativeUrl, document.baseURI).href;
  } catch {
    return relativeUrl;
  }
}

export function getLevelArtTheme(levelId: LevelId): LevelArtTheme {
  return LEVEL_ART_THEMES[levelId];
}

export class ArtAssetCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(ref: ArtAssetRef): HTMLImageElement | null {
    return this.entries.get(refId(ref))?.image ?? null;
  }

  getBackground(levelId: LevelId): HTMLImageElement | null {
    return this.get({ kind: "background", levelId });
  }

  getCommon(key: CommonSpriteKey): HTMLImageElement | null {
    return this.get({ kind: "common", key });
  }

  status(ref: ArtAssetRef): ArtAssetStatus {
    return this.entries.get(refId(ref))?.status ?? "idle";
  }

  ready(ref?: ArtAssetRef): boolean {
    if (ref) return this.status(ref) === "ready";
    return this.allRefs().every((candidate) => this.status(candidate) === "ready");
  }

  backgroundReady(levelId: LevelId): boolean {
    return this.ready({ kind: "background", levelId });
  }

  commonReady(key: CommonSpriteKey): boolean {
    return this.ready({ kind: "common", key });
  }

  /** Resolves even when one or more files fail, allowing procedural fallbacks. */
  async preload(options: ArtPreloadOptions = {}): Promise<void> {
    const levels = options.levels ?? LEVEL_IDS;
    const common = options.common ?? COMMON_KEYS;
    const refs: ArtAssetRef[] = [
      ...levels.map((levelId): ArtAssetRef => ({ kind: "background", levelId })),
      ...common.map((key): ArtAssetRef => ({ kind: "common", key })),
    ];

    await Promise.all(refs.map((ref) => this.load(ref).catch(() => null)));
  }

  async preloadLevel(levelId: LevelId, includeCommon = true): Promise<void> {
    await this.preload({
      levels: [levelId],
      common: includeCommon ? COMMON_KEYS : [],
    });
  }

  private allRefs(): ArtAssetRef[] {
    return [
      ...LEVEL_IDS.map((levelId): ArtAssetRef => ({ kind: "background", levelId })),
      ...COMMON_KEYS.map((key): ArtAssetRef => ({ kind: "common", key })),
    ];
  }

  private load(ref: ArtAssetRef): Promise<HTMLImageElement | null> {
    const id = refId(ref);
    const cached = this.entries.get(id);
    if (cached?.status === "ready" || cached?.status === "failed") {
      return Promise.resolve(cached.image);
    }
    if (cached?.promise) return cached.promise;

    const entry: CacheEntry = { status: "loading", image: null, promise: null };
    this.entries.set(id, entry);

    if (typeof Image === "undefined") {
      entry.status = "failed";
      return Promise.resolve(null);
    }

    try {
      const image = new Image();
      image.decoding = "async";
      const promise = new Promise<HTMLImageElement | null>((resolve) => {
        let settled = false;
        const finish = (loaded: boolean): void => {
          if (settled) return;
          settled = true;
          image.onload = null;
          image.onerror = null;
          entry.status = loaded ? "ready" : "failed";
          entry.image = loaded ? image : null;
          entry.promise = null;
          resolve(entry.image);
        };

        image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => finish(false);
        try {
          image.src = resolveArtAssetUrl(fileFor(ref));
        } catch {
          finish(false);
          return;
        }

        if (image.complete) {
          queueMicrotask(() => finish(image.naturalWidth > 0 && image.naturalHeight > 0));
        }
      });
      entry.promise = promise;
      return promise;
    } catch {
      entry.status = "failed";
      entry.promise = null;
      return Promise.resolve(null);
    }
  }
}

export const artAssets = new ArtAssetCache();
