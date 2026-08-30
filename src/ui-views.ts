import {
  branchArtUrl,
  characterArtUrl,
  levelPreviewArtUrl,
  uiArtUrl,
} from "./ui-art-assets";

/**
 * UI-only HTML templates for Cloudway Postman.
 *
 * The module deliberately owns no game state and binds no listeners. The host
 * controller can render any template, then handle the semantic `data-action`,
 * `data-id`, `data-value` and `data-setting` attributes through delegation.
 */

export type UiIconName =
  | "arrow"
  | "back"
  | "bag"
  | "check"
  | "close"
  | "cloud"
  | "coin"
  | "company"
  | "energy"
  | "garage"
  | "gem"
  | "gift"
  | "heart"
  | "home"
  | "ink"
  | "level"
  | "lock"
  | "logistics"
  | "mail"
  | "map"
  | "pause"
  | "play"
  | "route"
  | "settings"
  | "shield"
  | "shop"
  | "sound"
  | "speed"
  | "stamp"
  | "star"
  | "town"
  | "user"
  | "video"
  | "weather";

export type NavKey = "town" | "map" | "characters" | "company";

export interface ResourceBarModel {
  coins?: number;
  gems?: number;
  energy?: number;
  energyMax?: number;
  unlimitedEnergy?: boolean;
  stamps?: number;
  playerLevel?: number;
  playerXp?: number;
  playerXpMax?: number;
}

export interface TitleViewModel {
  subtitle?: string;
  canContinue?: boolean;
  completedLevels?: number;
  audioEnabled?: boolean;
  versionLabel?: string;
}

export interface TownBuildingModel {
  id: string;
  name: string;
  description?: string;
  level?: number;
  icon?: UiIconName;
  state?: "ready" | "upgrade" | "locked";
  progress?: number;
  badge?: string;
}

export interface TownContractModel {
  stageLabel?: string;
  title?: string;
  destination?: string;
  rewardCoins?: number;
  rewardStamps?: number;
  unlocked?: boolean;
}

export interface TownViewModel {
  resources?: ResourceBarModel;
  greeting?: string;
  townName?: string;
  townLevel?: number;
  townXp?: number;
  townXpMax?: number;
  buildings?: readonly TownBuildingModel[];
  nextContract?: TownContractModel;
  noticeCount?: number;
}

export interface MapStageModel {
  id: string | number;
  label: string;
  title: string;
  stars?: 0 | 1 | 2 | 3;
  locked?: boolean;
  current?: boolean;
  difficulty?: string;
}

export interface MapViewModel {
  resources?: ResourceBarModel;
  chapter?: number;
  chapterTitle?: string;
  stages?: readonly MapStageModel[];
  selectedStageId?: string | number | null;
}

export interface ContractGoalModel {
  id: string;
  label: string;
  current?: number;
  target?: number;
  complete?: boolean;
}

export interface ContractViewModel {
  resources?: ResourceBarModel;
  levelId?: string | number;
  stageLabel?: string;
  title?: string;
  subtitle?: string;
  destination?: string;
  weather?: string;
  difficulty?: string;
  goals?: readonly ContractGoalModel[];
  postmanName?: string;
  vehicleName?: string;
  rewardCoins?: number;
  rewardStamps?: number;
  rewardXp?: number;
  energyCost?: number;
  canStart?: boolean;
}

export interface CharacterCardModel {
  id: string;
  name: string;
  role: "agile" | "heavy" | "rescue" | "balanced";
  roleLabel?: string;
  level?: number;
  perk?: string;
  locked?: boolean;
  selected?: boolean;
  trialRuns?: number;
  unlockHint?: string;
}

export interface RosterViewModel {
  resources?: ResourceBarModel;
  activeFilter?: "all" | CharacterCardModel["role"];
  characters?: readonly CharacterCardModel[];
}

export interface CompanyBranchModel {
  id: string;
  name: string;
  description: string;
  icon?: UiIconName;
  level?: number;
  maxLevel?: number;
  progress?: number;
  cost?: number;
  locked?: boolean;
}

export interface CompanyViewModel {
  resources?: ResourceBarModel;
  companyName?: string;
  companyLevel?: number;
  reputation?: number;
  reputationMax?: number;
  branches?: readonly CompanyBranchModel[];
}

export interface SettingsViewModel {
  music?: boolean;
  sound?: boolean;
  vibration?: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
  leftHanded?: boolean;
  quality?: "low" | "medium" | "high";
  frameRate?: 30 | 60;
}

export interface HudViewModel {
  stageLabel?: string;
  progress?: number;
  remainingSeconds?: number;
  ink?: number;
  inkMax?: number;
  cargo?: number;
  cargoMax?: number;
  combo?: number;
  coins?: number;
  abilityReady?: boolean;
  abilityCooldown?: number;
  abilityLabel?: string;
  abilityStatus?: string;
  paused?: boolean;
}

export interface ModalActionModel {
  action: string;
  label: string;
  value?: string;
  tone?: "primary" | "secondary" | "success" | "danger" | "video";
  disabled?: boolean;
}

export interface ModalViewModel {
  kind?: "info" | "pause" | "reward" | "rescue" | "result" | "error";
  eyebrow?: string;
  title: string;
  body?: string;
  artSrc?: string;
  icon?: UiIconName;
  stats?: readonly { label: string; value: string; icon?: UiIconName }[];
  actions?: readonly ModalActionModel[];
  dismissAction?: string;
}

const MODAL_ICONS: Record<NonNullable<ModalViewModel["kind"]>, UiIconName> = {
  info: "mail",
  pause: "pause",
  reward: "gift",
  rescue: "video",
  result: "star",
  error: "cloud",
};

const ICON_CONTENT: Record<UiIconName, string> = {
  arrow: '<path d="m8 5 7 7-7 7"/>',
  back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h10"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.3 8.4 4.8 4.8 0 0 0 7 18Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.2c1.8-1.4 5-.4 5 1.4 0 2.4-5 1.2-5 3.6 0 1.7 3.1 2.7 5 1.3"/>',
  company: '<path d="M4 20V9l8-5 8 5v11"/><path d="M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/>',
  energy: '<path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/>',
  garage: '<path d="M3 20V8l9-5 9 5v12"/><path d="M6 20v-8h12v8M8 16h8"/>',
  gem: '<path d="m12 21-9-11 4-6h10l4 6-9 11Z"/><path d="m3 10 9 11 9-11M7 4l5 17 5-17M3 10h18"/>',
  gift: '<path d="M3 10h18v10H3zM2 6h20v4H2zM12 6v14"/><path d="M12 6c-1-4-6-4-6-1 0 2 3 2 6 1Zm0 0c1-4 6-4 6-1 0 2-3 2-6 1Z"/>',
  heart: '<path d="M20.8 5.7c-1.8-2.2-5.2-2.2-7.1-.2L12 7.3l-1.7-1.8a4.8 4.8 0 0 0-7.1.2C1.4 8 1.8 11.3 4 13.4L12 21l8-7.6c2.2-2.1 2.6-5.4.8-7.7Z"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  ink: '<path d="M12 2S5.5 9.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2 12 2Z"/><path d="M9 16c.6 1.4 1.6 2 3 2"/>',
  level: '<circle cx="12" cy="12" r="9"/><path d="M9 8h3v8m-3 0h6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>',
  logistics: '<path d="M3 6h12v11H3zM15 10h3l3 4v3h-6z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7.5 16.5c5-1 1.5-6 5.5-7.5 1.5-.6 2.6-.9 3.5-1.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 7.5 7.5 9.5 4.5-2 7.5-5 7.5-9.5V6L12 3Z"/>',
  shop: '<path d="M4 9v11h16V9M3 9l2-5h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  speed: '<circle cx="12" cy="13" r="8"/><path d="m12 13 4-4M8 4h8M12 5V3"/>',
  stamp: '<path d="M5 4h14v16H5z"/><path d="M8 8h8v8H8z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  town: '<path d="M3 20h18M5 20v-9l5-4 4 3 3-2 2 2v10"/><path d="M8 20v-5h4v5M15 13h2v2h-2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>',
  weather: '<path d="M7 15h10a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 8 7a4 4 0 0 0-1 8Z"/><path d="m9 18-1 3M14 18l-1 3M19 17l-1 3"/>',
};

const escapeHtml = (value: string | number): string =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const percent = (value = 0, maximum = 100): number => {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / maximum) * 100));
};

const selected = (left: string | number | null | undefined, right: string | number): boolean =>
  left !== null && left !== undefined && String(left) === String(right);

const DAILY_REFRESH_COPY = "完成今日清单，还能为小镇积攒新的声望。";

const PLAYER_FACING_COPY: Readonly<Record<string, string>> = {
  "正式版可接入每日刷新与服务端校验。": DAILY_REFRESH_COPY,
  "试玩版不限体力": "云能补给充足",
  "界面保留体力位，方便以后做恢复、活动或商业化；当前所有关卡都可反复游玩，不会消耗真实资源。":
    "今日云能补给充足，所有航线都可以自由练习和反复挑战。",
  "每次通关都会增加经验与声望。试玩版已实现部门成长和实际关卡加成，阶段宝箱将在后续版本开放。":
    "每次通关都会增加经验与声望，提升部门等级也会强化实际配送能力。",
  "重新规划路线即可再试；援助券只是未来激励视频接口的本地替代，不会触发真实广告。":
    "重新规划路线即可再试，也可以使用援助券获得一次护盾援助。",
  "商业化接口预览": "邮局特别援助",
  "当前不会播放真实广告，而是消耗 1 张本地援助券完成解锁。未来可把同一按钮替换为 30 秒激励视频，成功回调后再发放角色。":
    "使用 1 张援助券，即可邀请这位伙伴加入车队并永久出战。",
  "重置全部本地进度？": "重置全部配送进度？",
};

const playerFacingCopy = (value: string): string =>
  PLAYER_FACING_COPY[value] ??
  value.replace("正式版可接入每日刷新与服务端校验。", DAILY_REFRESH_COPY);

export function icon(name: UiIconName, className = ""): string {
  const safeClass = className ? ` ${escapeHtml(className)}` : "";
  return `<svg class="ui-icon${safeClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON_CONTENT[name]}</svg>`;
}

const wingedTitle = (title: string, eyebrow = "云路邮差"): string => `
  <header class="winged-heading">
    <span class="winged-heading__eyebrow">${escapeHtml(eyebrow)}</span>
    <div class="winged-heading__row" aria-label="${escapeHtml(title)}">
      <span class="wing wing--left" aria-hidden="true"></span>
      <h1>${escapeHtml(title)}</h1>
      <span class="wing wing--right" aria-hidden="true"></span>
    </div>
  </header>`;

const backButton = (action = "back"): string => `
  <button class="icon-button screen-back" type="button" data-action="${escapeHtml(action)}" aria-label="返回">
    ${icon("back")}
  </button>`;

const settingsButton = (): string => `
  <button class="icon-button screen-settings" type="button" data-action="open-settings" aria-label="打开设置">
    ${icon("settings")}
  </button>`;

const primaryButton = (
  label: string,
  action: string,
  options: { value?: string; iconName?: UiIconName; disabled?: boolean; tone?: string } = {},
): string => {
  const value = options.value === undefined ? "" : ` data-value="${escapeHtml(options.value)}"`;
  const disabled = options.disabled ? " disabled aria-disabled=\"true\"" : "";
  const tone = options.tone ? ` button--${escapeHtml(options.tone)}` : "";
  return `<button class="button button--primary${tone}" type="button" data-action="${escapeHtml(action)}"${value}${disabled}>${options.iconName ? icon(options.iconName) : ""}<span>${escapeHtml(label)}</span></button>`;
};

export function renderResourceBar(model: ResourceBarModel = {}): string {
  const energy = model.energy ?? 5;
  const energyMax = model.energyMax ?? 5;
  const level = model.playerLevel ?? 1;
  const xp = model.playerXp ?? 0;
  const xpMax = model.playerXpMax ?? 100;
  return `
    <section class="resource-bar" aria-label="玩家资源">
      <div class="level-chip" title="邮差等级 ${level}">
        ${icon("level")}
        <span>${escapeHtml(level)}</span>
        <i style="--progress:${percent(xp, xpMax)}%" aria-hidden="true"></i>
      </div>
      <div class="resource-chip resource-chip--coin" title="金币">
        ${icon("coin")}<strong>${escapeHtml(model.coins ?? 0)}</strong>
      </div>
      <div class="resource-chip resource-chip--gem" title="援助券">
        ${icon("gift")}<strong>${escapeHtml(model.gems ?? 0)}</strong>
      </div>
      <button class="resource-chip resource-chip--energy" type="button" data-action="open-energy" aria-label="${model.unlimitedEnergy ? "云能充足，无需消耗体力" : `体力 ${energy} / ${energyMax}`}">
        ${icon("heart")}<strong>${model.unlimitedEnergy ? "∞" : escapeHtml(energy)}</strong>${model.unlimitedEnergy ? "" : `<small>/${escapeHtml(energyMax)}</small>`}
      </button>
      ${model.stamps === undefined ? "" : `<div class="resource-chip resource-chip--stamp" title="邮票">${icon("stamp")}<strong>${escapeHtml(model.stamps)}</strong></div>`}
    </section>`;
}

const NAV_ITEMS: readonly { key: NavKey; label: string; iconName: UiIconName }[] = [
  { key: "town", label: "小镇", iconName: "town" },
  { key: "map", label: "关卡", iconName: "map" },
  { key: "characters", label: "角色", iconName: "user" },
  { key: "company", label: "公司", iconName: "company" },
];

export function renderBottomNav(active: NavKey): string {
  return `
    <nav class="bottom-nav" aria-label="主要页面">
      ${NAV_ITEMS.map(
        (item) => `
          <button class="bottom-nav__item${active === item.key ? " is-active" : ""}" type="button" data-action="navigate" data-value="${item.key}" ${active === item.key ? 'aria-current="page"' : ""}>
            <span class="bottom-nav__icon">${icon(item.iconName)}</span>
            <span>${item.label}</span>
          </button>`,
      ).join("")}
    </nav>`;
}

export function renderTitleView(model: TitleViewModel = {}): string {
  const continueLabel = model.completedLevels ? `继续配送 · 第 ${model.completedLevels + 1} 关` : "继续配送";
  return `
    <main class="screen screen--title" data-view="title">
      <div class="title-sky" aria-hidden="true">
        <img class="ui-scene-art title-scene-art" src="${uiArtUrl("title")}" alt="" draggable="false" decoding="async">
        <span class="cloud cloud--one"></span><span class="cloud cloud--two"></span><span class="cloud cloud--three"></span>
        <span class="floating-island floating-island--far"></span>
      </div>
      <div class="title-actions-top">
        <button class="icon-button" type="button" data-action="toggle-audio" aria-label="${model.audioEnabled === false ? "开启声音" : "关闭声音"}">${icon(model.audioEnabled === false ? "sound" : "sound")}</button>
        ${settingsButton()}
      </div>
      <section class="title-lockup">
        <div class="logo-emblem" aria-hidden="true">${icon("mail")}</div>
        <p class="title-kicker">一笔画路 · 准时送达</p>
        <h1>云路邮差</h1>
        <p>${escapeHtml(model.subtitle ?? "在会呼吸的云海上画出道路，重建你的浮空小镇。")}</p>
      </section>
      <div class="title-island" aria-hidden="true">
        <span class="town-silhouette"></span>
        <span class="post-van">${icon("mail")}</span>
      </div>
      <section class="title-cta" aria-label="开始游戏">
        ${model.canContinue ? primaryButton(continueLabel, "continue-game", { iconName: "play" }) : ""}
        ${primaryButton(model.canContinue ? "重新开始" : "开始配送", "start-game", { iconName: "route", tone: model.canContinue ? "secondary" : undefined })}
        <p>单指画路 · 每局约 60–90 秒 · 旅程自动记录</p>
      </section>
      <span class="version-label">晨风邮局 · 云路常开</span>
    </main>`;
}

const defaultBuildings: readonly TownBuildingModel[] = [
  { id: "post-office", name: "云端邮局", description: "管理合同与派送", level: 1, icon: "mail", state: "ready" },
  { id: "shop", name: "云端便利站", description: "经营店铺获取补给", level: 1, icon: "shop", state: "ready", badge: "可营业" },
  { id: "home", name: "邮差之家", description: "休息、换装与装饰", level: 1, icon: "home", state: "ready" },
  { id: "garage", name: "浮空车库", description: "解锁不同邮车", level: 0, icon: "garage", state: "locked" },
];

export function renderTownView(model: TownViewModel = {}): string {
  const buildings = model.buildings ?? defaultBuildings;
  const contract = model.nextContract ?? {};
  return `
    <main class="screen screen--town has-bottom-nav" data-view="town">
      <div class="screen-sky" aria-hidden="true"><img class="ui-scene-art town-scene-art" src="${uiArtUrl("town")}" alt="" draggable="false" decoding="async"><span class="cloud cloud--one"></span><span class="cloud cloud--two"></span></div>
      ${renderResourceBar(model.resources)}
      ${settingsButton()}
      <section class="town-heading">
        <p>${escapeHtml(model.greeting ?? "欢迎回来，邮差")}</p>
        <h1>${escapeHtml(model.townName ?? "晨风小镇")}</h1>
        <div class="town-level">
          <span>小镇 Lv.${escapeHtml(model.townLevel ?? 1)}</span>
          <span class="progress-track"><i style="--progress:${percent(model.townXp ?? 0, model.townXpMax ?? 100)}%"></i></span>
        </div>
      </section>
      <button class="mail-notice" type="button" data-action="open-tasks" aria-label="今日任务${model.noticeCount ? `，${model.noticeCount} 条未读` : ""}">
        ${icon("mail")}${model.noticeCount ? `<b>${escapeHtml(model.noticeCount)}</b>` : ""}
      </button>
      <section class="town-islands" aria-label="小镇建筑">
        <div class="town-islands__paths" aria-hidden="true"></div>
        ${buildings.map((building, index) => `
          <button class="town-building town-building--${(index % 4) + 1} is-${building.state ?? "ready"}" type="button" data-action="open-building" data-id="${escapeHtml(building.id)}" ${building.state === "locked" ? 'aria-label="' + escapeHtml(building.name) + '，尚未解锁"' : ""}>
            <span class="town-building__island" aria-hidden="true"></span>
            <span class="town-building__house">${icon(building.icon ?? "home")}</span>
            <strong>${escapeHtml(building.name)}</strong>
            <small>${building.state === "locked" ? `${icon("lock")} 待解锁` : `Lv.${escapeHtml(building.level ?? 1)} · ${escapeHtml(building.description ?? "")}`}</small>
            ${building.badge ? `<em>${escapeHtml(building.badge)}</em>` : ""}
            ${building.progress === undefined ? "" : `<span class="micro-progress"><i style="--progress:${percent(building.progress)}%"></i></span>`}
          </button>`).join("")}
        <div class="town-statue" aria-hidden="true">${icon("mail")}</div>
      </section>
      <section class="next-contract ${contract.unlocked === false ? "is-locked" : ""}" aria-label="下一份合同">
        <div class="next-contract__stamp">${icon(contract.unlocked === false ? "lock" : "route")}</div>
        <div>
          <span>${escapeHtml(contract.stageLabel ?? "下一站 · 1-1")}</span>
          <strong>${escapeHtml(contract.title ?? "晨风第一投")}</strong>
          <small>${escapeHtml(contract.destination ?? "送往灯塔岛")}</small>
        </div>
        <div class="next-contract__reward"><span>${icon("coin")} ${escapeHtml(contract.rewardCoins ?? 24)}</span><span>${icon("stamp")} ${escapeHtml(contract.rewardStamps ?? 1)}</span></div>
        <button class="round-action" type="button" data-action="open-contract" ${contract.unlocked === false ? "disabled" : ""} aria-label="查看合同">${icon("arrow")}</button>
      </section>
      ${renderBottomNav("town")}
    </main>`;
}

const defaultStages: readonly MapStageModel[] = [
  { id: 1, label: "1-1", title: "晨风第一投", stars: 0, current: true, difficulty: "入门" },
  { id: 2, label: "1-2", title: "横风集市", stars: 0, difficulty: "轻风" },
  { id: 3, label: "1-3", title: "钟摆云门", stars: 0, difficulty: "进阶" },
  { id: 4, label: "1-4", title: "易碎月饼箱", stars: 0, difficulty: "困难" },
  { id: 5, label: "1-5", title: "暴风特快", stars: 0, difficulty: "车队考验" },
];

const starRow = (stars = 0): string => `<span class="stars" aria-label="${stars} 星">${[1, 2, 3].map((value) => `<span class="${value <= stars ? "is-earned" : ""}">${icon("star")}</span>`).join("")}</span>`;

export function renderMapView(model: MapViewModel = {}): string {
  const stages = model.stages ?? defaultStages;
  const selectedStage = stages.find((stage) => selected(model.selectedStageId, stage.id)) ?? stages.find((stage) => stage.current) ?? stages[0];
  return `
    <main class="screen screen--map has-bottom-nav" data-view="map">
      <div class="screen-sky map-sky" aria-hidden="true"><img class="ui-scene-art map-scene-art" src="${uiArtUrl("map")}" alt="" draggable="false" decoding="async"><span class="cloud cloud--one"></span><span class="cloud cloud--two"></span></div>
      ${renderResourceBar(model.resources)}
      ${wingedTitle(model.chapterTitle ?? "晨风航线", `第 ${model.chapter ?? 1} 章`)}
      <section class="route-map" aria-label="关卡地图">
        <svg class="route-map__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M48 96 C18 82, 82 74, 52 61 S25 40, 55 29 S78 16, 50 4"/></svg>
        ${stages.map((stage, index) => {
          const isSelected = selected(model.selectedStageId, stage.id) || (model.selectedStageId == null && stage.current);
          return `<button class="stage-node stage-node--${(index % 5) + 1}${isSelected ? " is-selected" : ""}${stage.locked ? " is-locked" : ""}" type="button" data-action="select-stage" data-id="${escapeHtml(stage.id)}" ${stage.locked ? "disabled" : ""} aria-label="${escapeHtml(stage.label)} ${escapeHtml(stage.title)}${stage.locked ? "，未解锁" : ""}">
            <span class="stage-node__island" aria-hidden="true"></span>
            <span class="stage-node__badge">${stage.locked ? icon("lock") : escapeHtml(stage.label)}</span>
            ${starRow(stage.stars)}
          </button>`;
        }).join("")}
      </section>
      ${selectedStage ? `<section class="stage-preview">
        <div class="stage-preview__art" aria-hidden="true"><img class="stage-preview__image" src="${levelPreviewArtUrl(selectedStage.id)}" alt="" draggable="false" loading="lazy" decoding="async"><span class="preview-island"></span>${icon("route")}</div>
        <div class="stage-preview__copy"><span>${escapeHtml(selectedStage.label)} · ${escapeHtml(selectedStage.difficulty ?? "普通")}</span><strong>${escapeHtml(selectedStage.title)}</strong>${starRow(selectedStage.stars)}</div>
        ${primaryButton(selectedStage.locked ? "尚未解锁" : "查看合同", "open-contract", { value: String(selectedStage.id), iconName: selectedStage.locked ? "lock" : "arrow", disabled: selectedStage.locked })}
      </section>` : ""}
      ${renderBottomNav("map")}
    </main>`;
}

const defaultGoals: readonly ContractGoalModel[] = [
  { id: "deliver", label: "把全部包裹送到终点", current: 0, target: 1 },
  { id: "cargo", label: "货物完整度不低于 70%", current: 100, target: 70, complete: true },
  { id: "stamp", label: "收集沿途纪念邮票", current: 0, target: 1 },
];

export function renderContractView(model: ContractViewModel = {}): string {
  const goals = model.goals ?? defaultGoals;
  return `
    <main class="screen screen--contract" data-view="contract">
      <div class="screen-sky" aria-hidden="true"><span class="cloud cloud--one"></span></div>
      ${renderResourceBar(model.resources)}
      ${backButton("back-to-map")}
      ${wingedTitle("合同准备", model.stageLabel ?? "航线 1-1")}
      <article class="paper-sheet contract-sheet">
        <div class="contract-stamp" aria-hidden="true">${icon("stamp")}</div>
        <section class="contract-hero">
          <span class="contract-hero__island" aria-hidden="true"><img class="contract-hero__image" src="${levelPreviewArtUrl(model.levelId)}" alt="" draggable="false" decoding="async">${icon("home")}</span>
          <div><span>${escapeHtml(model.difficulty ?? "入门合同")}</span><h2>${escapeHtml(model.title ?? "晨风第一投")}</h2><p>${escapeHtml(model.subtitle ?? "绕过风暴云，把早餐信准时送到灯塔。")}</p></div>
        </section>
        <dl class="contract-meta">
          <div><dt>${icon("route")} 目的地</dt><dd>${escapeHtml(model.destination ?? "晨风灯塔")}</dd></div>
          <div><dt>${icon("weather")} 天气</dt><dd>${escapeHtml(model.weather ?? "晴转多云")}</dd></div>
        </dl>
        <section class="contract-goals" aria-label="合同目标">
          <h3>配送目标</h3>
          ${goals.map((goal) => {
            const done = goal.complete ?? ((goal.current ?? 0) >= (goal.target ?? 1));
            return `<div class="contract-goal ${done ? "is-complete" : ""}">
              <span class="goal-check">${done ? icon("check") : icon("star")}</span>
              <span>${escapeHtml(goal.label)}</span>
              ${goal.target === undefined ? "" : `<strong>${escapeHtml(goal.current ?? 0)}/${escapeHtml(goal.target)}</strong>`}
            </div>`;
          }).join("")}
        </section>
        <section class="loadout-row" aria-label="出发配置">
          <button type="button" data-action="select-character"><span>${icon("user")}</span><small>邮差</small><strong>${escapeHtml(model.postmanName ?? "小邮")}</strong></button>
          <button type="button" data-action="select-vehicle"><span>${icon("logistics")}</span><small>邮车</small><strong>${escapeHtml(model.vehicleName ?? "经典邮车")}</strong></button>
        </section>
        <section class="contract-reward" aria-label="完成奖励">
          <span>完成奖励</span>
          <strong>${icon("coin")} ${escapeHtml(model.rewardCoins ?? 24)}</strong>
          <strong>${icon("stamp")} ${escapeHtml(model.rewardStamps ?? 1)}</strong>
          <strong>${icon("level")} ${escapeHtml(model.rewardXp ?? 40)} XP</strong>
        </section>
      </article>
      <div class="contract-cta">
        ${primaryButton((model.energyCost ?? 1) === 0 ? "整装出发" : `消耗 ${model.energyCost ?? 1} 体力 · 开始配送`, "start-level", { iconName: "energy", disabled: model.canStart === false })}
        <p>画出云路，邮车会自动沿路线前进</p>
      </div>
    </main>`;
}

const defaultCharacters: readonly CharacterCardModel[] = [
  { id: "xiaoyou", name: "小邮", role: "balanced", roleLabel: "均衡", level: 1, perk: "首次碰撞损失降低", selected: true },
  { id: "leiyu", name: "雷羽", role: "agile", roleLabel: "灵活", level: 1, perk: "转弯时云墨消耗降低", trialRuns: 3 },
  { id: "laobu", name: "老布", role: "heavy", roleLabel: "重载", level: 1, perk: "货物完整度上限提高", locked: true, unlockHint: "公司等级 3" },
  { id: "mike", name: "米可", role: "rescue", roleLabel: "救援", level: 1, perk: "灯塔护盾持续更久", locked: true, unlockHint: "完成 10 次配送" },
];

const roleLabel = (role: CharacterCardModel["role"]): string => ({ agile: "灵活", heavy: "重载", rescue: "救援", balanced: "均衡" })[role];

export function renderRosterView(model: RosterViewModel = {}): string {
  const characters = model.characters ?? defaultCharacters;
  const activeFilter = model.activeFilter ?? "all";
  const filters: readonly { id: RosterViewModel["activeFilter"]; label: string }[] = [
    { id: "all", label: "全部" }, { id: "agile", label: "灵活" }, { id: "heavy", label: "重载" }, { id: "rescue", label: "救援" },
  ];
  const visibleCharacters = characters.filter((character) => activeFilter === "all" || character.role === activeFilter);
  return `
    <main class="screen screen--roster has-bottom-nav" data-view="characters">
      <div class="screen-sky" aria-hidden="true"><img class="ui-scene-art ambient-scene-art" src="${uiArtUrl("title")}" alt="" draggable="false" loading="lazy" decoding="async"><span class="cloud cloud--one"></span></div>
      ${renderResourceBar(model.resources)}
      ${wingedTitle("伙伴名册", "选择本次配送邮差")}
      <div class="filter-chips" role="group" aria-label="角色筛选">
        ${filters.map((filter) => `<button type="button" class="filter-chip ${activeFilter === filter.id ? "is-active" : ""}" data-action="filter-roster" data-value="${filter.id}">${filter.label}</button>`).join("")}
      </div>
      <section class="roster-grid" aria-label="邮差角色">
        ${visibleCharacters.map((character) => `
          <article class="character-card role-${character.role}${character.selected ? " is-selected" : ""}${character.locked ? " is-locked" : ""}">
            <div class="character-card__portrait" aria-hidden="true"><img class="character-card__image" src="${characterArtUrl(character.id, character.role)}" alt="" draggable="false" loading="lazy" decoding="async"><span class="portrait-hat">${icon("mail")}</span><span class="portrait-face"></span></div>
            ${character.selected ? `<span class="selected-badge">${icon("check")}</span>` : ""}
            ${character.locked ? `<span class="locked-overlay">${icon("lock")}<small>${escapeHtml(character.unlockHint ?? "尚未解锁")}</small></span>` : ""}
            <div class="character-card__copy"><span>${escapeHtml(character.roleLabel ?? roleLabel(character.role))} · Lv.${escapeHtml(character.level ?? 1)}</span><h2>${escapeHtml(character.name)}</h2><p>${escapeHtml(character.perk ?? "可靠的云路伙伴")}</p></div>
            ${character.locked ? `<button type="button" class="button button--video" data-action="trial-character" data-id="${escapeHtml(character.id)}">${icon("gift")} 援助解锁</button>` : `<button type="button" class="button button--small ${character.selected ? "button--success" : "button--secondary"}" data-action="select-character" data-id="${escapeHtml(character.id)}">${character.selected ? "已出战" : "设为出战"}${character.trialRuns ? ` · 余 ${escapeHtml(character.trialRuns)} 局` : ""}</button>`}
          </article>`).join("")}
      </section>
      ${renderBottomNav("characters")}
    </main>`;
}

const defaultBranches: readonly CompanyBranchModel[] = [
  { id: "garage", name: "车库", description: "解锁车辆，提升灵活与载重", icon: "garage", level: 1, maxLevel: 5, progress: 35, cost: 300 },
  { id: "weather", name: "气象", description: "提前预报风暴与移动危险", icon: "weather", level: 1, maxLevel: 5, progress: 20, cost: 420 },
  { id: "logistics", name: "物流", description: "增加合同奖励与便利店货源", icon: "logistics", level: 0, maxLevel: 5, progress: 0, cost: 600, locked: true },
];

export function renderCompanyView(model: CompanyViewModel = {}): string {
  const branches = model.branches ?? defaultBranches;
  const companyLevel = model.companyLevel ?? 1;
  return `
    <main class="screen screen--company has-bottom-nav" data-view="company">
      <div class="screen-sky" aria-hidden="true"><img class="ui-scene-art ambient-scene-art" src="${uiArtUrl("town")}" alt="" draggable="false" loading="lazy" decoding="async"><span class="cloud cloud--one"></span></div>
      ${renderResourceBar(model.resources)}
      ${wingedTitle(model.companyName ?? "云路邮政公司", "经营成长")}
      <section class="company-emblem">
        <div><img class="company-emblem__image" src="${uiArtUrl("companyEmblem")}" alt="" aria-hidden="true" draggable="false" decoding="async">${icon("mail")}</div><span>公司等级</span><strong>${escapeHtml(companyLevel)}</strong>
        <p>升级部门，让每次配送都带回新的可能。</p>
      </section>
      <section class="company-branches" aria-label="公司部门">
        ${branches.map((branch) => `
          <article class="branch-card branch-${escapeHtml(branch.id)} ${branch.locked ? "is-locked" : ""}">
            <div class="branch-card__icon"><img class="branch-card__image" src="${branchArtUrl(branch.id)}" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async">${icon(branch.icon ?? "company")}</div>
            <div class="branch-card__copy"><span>Lv.${escapeHtml(branch.level ?? 0)} / ${escapeHtml(branch.maxLevel ?? 5)}</span><h2>${escapeHtml(branch.name)}</h2><p>${escapeHtml(branch.description)}</p><span class="progress-track"><i style="--progress:${percent(branch.progress ?? 0)}%"></i></span></div>
            <button type="button" class="round-action" data-action="upgrade-branch" data-id="${escapeHtml(branch.id)}" ${branch.locked ? "disabled" : ""} aria-label="${branch.locked ? "尚未解锁" : `升级${escapeHtml(branch.name)}`}">${branch.locked ? icon("lock") : icon("arrow")}</button>
            ${branch.locked ? `<small class="branch-lock">公司等级 ${companyLevel + 1} 解锁</small>` : `<small class="branch-cost">${icon("coin")} ${escapeHtml(branch.cost ?? 0)}</small>`}
          </article>`).join("")}
      </section>
      <section class="reputation-card"><span>${icon("star")} 公司声望</span><strong>${escapeHtml(model.reputation ?? 0)} / ${escapeHtml(model.reputationMax ?? 1000)}</strong><span class="progress-track"><i style="--progress:${percent(model.reputation ?? 0, model.reputationMax ?? 1000)}%"></i></span><button type="button" data-action="open-company-rewards">${icon("gift")} 声望奖励</button></section>
      ${renderBottomNav("company")}
    </main>`;
}

const toggleRow = (label: string, description: string, setting: string, checked: boolean, iconName: UiIconName): string => `
  <div class="setting-row">
    <span class="setting-row__icon">${icon(iconName)}</span>
    <span class="setting-row__copy"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>
    <button class="toggle ${checked ? "is-on" : ""}" type="button" role="switch" aria-checked="${checked}" data-action="toggle-setting" data-setting="${escapeHtml(setting)}" aria-label="${escapeHtml(label)}"><i></i></button>
  </div>`;

export function renderSettingsView(model: SettingsViewModel = {}): string {
  const quality = model.quality ?? "high";
  const frameRate = model.frameRate ?? 60;
  return `
    <main class="screen screen--settings" data-view="settings">
      <div class="screen-sky" aria-hidden="true"><img class="ui-scene-art settings-scene-art" src="${uiArtUrl("title")}" alt="" draggable="false" decoding="async"><span class="cloud cloud--one"></span></div>
      ${backButton("close-settings")}
      ${wingedTitle("设置", "让旅途更舒服")}
      <section class="paper-sheet settings-sheet">
        ${toggleRow("音乐", "邮局主题与关卡音乐", "music", model.music ?? true, "sound")}
        ${toggleRow("音效", "画路、碰撞与奖励反馈", "sound", model.sound ?? true, "sound")}
        ${toggleRow("震动", "支持设备上的轻触反馈", "vibration", model.vibration ?? true, "energy")}
        ${toggleRow("减少动态效果", "关闭漂浮、摇晃与强粒子", "reducedMotion", model.reducedMotion ?? false, "cloud")}
        ${toggleRow("色彩增强", "提高道路和危险物的对比", "highContrast", model.highContrast ?? false, "star")}
        ${toggleRow("左手模式", "交换关卡技能按钮位置", "leftHanded", model.leftHanded ?? false, "user")}
        <div class="setting-row setting-row--segmented">
          <span class="setting-row__icon">${icon("settings")}</span><span class="setting-row__copy"><strong>画质</strong><small>不影响关卡规则</small></span>
          <div class="segmented" role="group" aria-label="画质">
            ${(["low", "medium", "high"] as const).map((value) => `<button type="button" data-action="set-setting" data-setting="quality" data-value="${value}" class="${quality === value ? "is-active" : ""}">${{ low: "低", medium: "中", high: "高" }[value]}</button>`).join("")}
          </div>
        </div>
        <div class="setting-row setting-row--segmented">
          <span class="setting-row__icon">${icon("speed")}</span><span class="setting-row__copy"><strong>帧率</strong><small>低端设备建议 30</small></span>
          <div class="segmented" role="group" aria-label="帧率">
            ${([30, 60] as const).map((value) => `<button type="button" data-action="set-setting" data-setting="frameRate" data-value="${value}" class="${frameRate === value ? "is-active" : ""}">${value}</button>`).join("")}
          </div>
        </div>
      </section>
      <footer class="settings-footer"><button type="button" class="text-button" data-action="show-how-to-play">操作说明</button><button type="button" class="text-button" data-action="reset-save">重置进度</button><small>偏好已记入邮差手册</small></footer>
    </main>`;
}

const formatSeconds = (seconds = 0): string => {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export function renderHud(model: HudViewModel = {}): string {
  const ink = model.ink ?? 0;
  const inkMax = model.inkMax ?? 100;
  const cargo = model.cargo ?? 100;
  const cargoMax = model.cargoMax ?? 100;
  const cooldown = Math.max(0, model.abilityCooldown ?? 0);
  const ready = model.abilityReady ?? cooldown <= 0;
  const abilityStatus = model.abilityStatus ?? (ready ? "就绪" : `${cooldown.toFixed(1)}s`);
  return `
    <section class="game-hud ${model.paused ? "is-paused" : ""}" aria-label="关卡状态">
      <header class="hud-top">
        <button class="icon-button hud-pause" type="button" data-action="toggle-pause" aria-label="${model.paused ? "继续游戏" : "暂停"}">${icon(model.paused ? "play" : "pause")}</button>
        <div class="hud-progress">
          <span>${escapeHtml(model.stageLabel ?? "配送中")}</span>
          <div class="hud-time" aria-label="剩余时间">${icon("speed")}<strong>${formatSeconds(model.remainingSeconds)}</strong></div>
          <strong>${Math.round(percent(model.progress ?? 0))}%</strong>
          <div class="progress-track"><i style="--progress:${percent(model.progress ?? 0)}%"></i></div>
        </div>
      </header>
      <aside class="hud-status">
        <div class="hud-meter hud-meter--ink"><span>${icon("ink")} 云墨</span><strong>${Math.round(percent(ink, inkMax))}%</strong><div class="vertical-meter"><i style="--progress:${percent(ink, inkMax)}%"></i></div></div>
        <div class="hud-meter hud-meter--cargo"><span>${icon("shield")} 完整度</span><strong>${Math.round(percent(cargo, cargoMax))}%</strong><div class="vertical-meter"><i style="--progress:${percent(cargo, cargoMax)}%"></i></div></div>
        ${(model.combo ?? 0) > 0 ? `<div class="hud-combo"><strong>${escapeHtml(model.combo ?? 0)}</strong><span>COMBO</span></div>` : ""}
      </aside>
      <div class="hud-coins">${icon("coin")}<strong>${escapeHtml(model.coins ?? 0)}</strong></div>
      <button class="ability-button ${ready ? "is-ready" : "is-cooldown"}" type="button" data-action="use-ability" ${ready ? "" : "disabled"} aria-label="${escapeHtml(model.abilityLabel ?? "灯塔护盾")}，${escapeHtml(abilityStatus)}">
        <span>${icon("shield")}</span><strong>${escapeHtml(model.abilityLabel ?? "灯塔")}</strong><em>${escapeHtml(abilityStatus)}</em>
      </button>
    </section>`;
}

export function renderModal(model: ModalViewModel): string {
  const kind = model.kind ?? "info";
  const actions = model.actions ?? [{ action: "close-modal", label: "知道了", tone: "primary" }];
  const title = playerFacingCopy(model.title);
  const body = model.body ? playerFacingCopy(model.body) : "";
  const eyebrow = model.eyebrow ? playerFacingCopy(model.eyebrow) : "";
  return `
    <div class="modal-layer" role="presentation" data-modal-kind="${kind}">
      <section class="modal-card modal-card--${kind}${model.artSrc ? " has-art" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        ${model.dismissAction ? `<button class="icon-button modal-close" type="button" data-action="${escapeHtml(model.dismissAction)}" aria-label="关闭">${icon("close")}</button>` : ""}
        ${model.artSrc ? `<div class="modal-card__art" aria-hidden="true"><img src="${escapeHtml(model.artSrc)}" alt="" draggable="false" decoding="async"></div>` : ""}
        <div class="modal-card__icon">${icon(model.icon ?? MODAL_ICONS[kind])}</div>
        ${eyebrow ? `<span class="modal-card__eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
        ${model.stats?.length ? `<dl class="modal-stats">${model.stats.map((stat) => `<div><dt>${stat.icon ? icon(stat.icon) : ""}${escapeHtml(stat.label)}</dt><dd>${escapeHtml(stat.value)}</dd></div>`).join("")}</dl>` : ""}
        <div class="modal-actions">
          ${actions.map((action) => `<button class="button button--${escapeHtml(action.tone ?? "secondary")}" type="button" data-action="${escapeHtml(action.action)}"${action.value === undefined ? "" : ` data-value="${escapeHtml(action.value)}"`}${action.disabled ? " disabled" : ""}>${action.tone === "video" ? icon("video") : ""}<span>${escapeHtml(action.label)}</span></button>`).join("")}
        </div>
      </section>
    </div>`;
}
