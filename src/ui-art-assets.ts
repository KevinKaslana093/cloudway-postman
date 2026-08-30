const ART_DIRECTORY = "assets/art/";

export const UI_ART_FILES = {
  title: "ui/title-v2.webp",
  town: "ui/town-v2.webp",
  map: "ui/map-v2.webp",
  characterRookie: "ui/character-rookie-v2.webp",
  characterRainwing: "ui/character-rainwing-v2.webp",
  characterOldcloth: "ui/character-oldcloth-v2.webp",
  characterMico: "ui/character-mico-v2.webp",
  branchGarage: "ui/branch-garage-v2.webp",
  branchWeather: "ui/branch-weather-v2.webp",
  branchLogistics: "ui/branch-logistics-v2.webp",
  companyEmblem: "ui/company-emblem-v2.webp",
  dailyBoard: "ui/daily-board-v2.webp",
  buildingPostOffice: "ui/building-post-office-v2.webp",
  buildingShop: "ui/building-shop-v2.webp",
  buildingHome: "ui/building-home-v2.webp",
} as const;

export type UiArtKey = keyof typeof UI_ART_FILES;

const LEVEL_PREVIEW_FILES: Readonly<Record<number, string>> = {
  1: "bg-1-morning.webp",
  2: "bg-2-market.webp",
  3: "bg-3-clockwork.webp",
  4: "bg-4-moon.webp",
  5: "bg-5-tempest.webp",
};

const CHARACTER_ART_BY_ID: Readonly<Record<string, UiArtKey>> = {
  rookie: "characterRookie",
  xiaoyou: "characterRookie",
  rainwing: "characterRainwing",
  leiyu: "characterRainwing",
  oldcloth: "characterOldcloth",
  laobu: "characterOldcloth",
  mico: "characterMico",
  mike: "characterMico",
};

const CHARACTER_ART_BY_ROLE: Readonly<Record<string, UiArtKey>> = {
  balanced: "characterRookie",
  agile: "characterRainwing",
  heavy: "characterOldcloth",
  rescue: "characterMico",
};

const BRANCH_ART_BY_ID: Readonly<Record<string, UiArtKey>> = {
  garage: "branchGarage",
  weather: "branchWeather",
  logistics: "branchLogistics",
};

const BUILDING_ART_BY_ID: Readonly<Record<string, UiArtKey>> = {
  dispatchCenter: "buildingPostOffice",
  convenienceStore: "buildingShop",
  home: "buildingHome",
  garage: "branchGarage",
};

const VIEW_ART: Readonly<Record<string, readonly UiArtKey[]>> = {
  title: ["title"],
  town: ["town", "dailyBoard", "buildingPostOffice", "buildingShop", "buildingHome", "branchGarage"],
  map: ["map"],
  characters: ["title", "characterRookie", "characterRainwing", "characterOldcloth", "characterMico"],
  company: ["town", "companyEmblem", "branchGarage", "branchWeather", "branchLogistics"],
  settings: ["title"],
};

const preloadPromises = new Map<string, Promise<void>>();

/** Resolve from document.baseURI so GitHub Pages keeps the repository subpath. */
export function resolveUiArtUrl(fileName: string): string {
  const relativeUrl = `./${ART_DIRECTORY}${fileName}`;
  if (typeof document === "undefined") return relativeUrl;

  try {
    return new URL(relativeUrl, document.baseURI).href;
  } catch {
    return relativeUrl;
  }
}

export function uiArtUrl(key: UiArtKey): string {
  return resolveUiArtUrl(UI_ART_FILES[key]);
}

export function characterArtUrl(id: string, role: string): string {
  const key = CHARACTER_ART_BY_ID[id] ?? CHARACTER_ART_BY_ROLE[role] ?? "characterRookie";
  return uiArtUrl(key);
}

export function branchArtUrl(id: string): string {
  return uiArtUrl(BRANCH_ART_BY_ID[id] ?? "branchLogistics");
}

export function buildingArtUrl(id: string): string {
  return uiArtUrl(BUILDING_ART_BY_ID[id] ?? "buildingPostOffice");
}

export function levelPreviewArtUrl(id: string | number | null | undefined): string {
  const numericId = Number(id);
  const fileName = LEVEL_PREVIEW_FILES[numericId] ?? "bg-1-morning.webp";
  return resolveUiArtUrl(fileName);
}

function preloadUrl(url: string): Promise<void> {
  const existing = preloadPromises.get(url);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    if (typeof Image === "undefined") {
      resolve();
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
  preloadPromises.set(url, promise);
  return promise;
}

export async function preloadUiArtForView(view: string): Promise<void> {
  const keys = VIEW_ART[view] ?? [];
  await Promise.all(keys.map((key) => preloadUrl(uiArtUrl(key))));
}
