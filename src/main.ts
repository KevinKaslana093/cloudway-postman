import "./style.css";

import { gameAudio, type SoundEffect } from "./audio";
import { LEVELS, UPGRADES } from "./content";
import { createGame, type CloudwayGame } from "./game-core";
import { GameRenderer } from "./game-renderer";
import { createRewardTicketId, rewardService } from "./rewards";
import {
  gameSaveStore,
  type GameSave,
  type GameSettings,
} from "./storage";
import type {
  GameEvent,
  GameSnapshot,
  LevelConfig,
  LevelId,
  LevelResult,
  UpgradeId,
} from "./types";
import {
  renderCompanyView,
  renderContractView,
  renderHud,
  renderMapView,
  renderModal,
  renderRosterView,
  renderSettingsView,
  renderTitleView,
  renderTownView,
  type CharacterCardModel,
  type CompanyBranchModel,
  type ModalViewModel,
  type SettingsViewModel,
  type TownBuildingModel,
} from "./ui-views";

type AppView =
  | "title"
  | "town"
  | "map"
  | "contract"
  | "characters"
  | "company"
  | "settings"
  | "game";

type RosterFilter = "all" | CharacterCardModel["role"];

interface UiPreferences {
  music: boolean;
  sound: boolean;
  vibration: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  leftHanded: boolean;
  quality: "low" | "medium" | "high";
  frameRate: 30 | 60;
}

interface CharacterDefinition {
  id: string;
  name: string;
  role: CharacterCardModel["role"];
  roleLabel: string;
  perk: string;
  unlockHint: string;
}

const UI_PREFERENCES_KEY = "cloudway-postman.ui-preferences";
const MAX_BUILDING_LEVEL = 5;
const XP_PER_LEVEL = 120;
const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) throw new Error("Missing #app root");
const app: HTMLDivElement = appElement;

const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: "rookie",
    name: "阿岚",
    role: "balanced",
    roleLabel: "均衡",
    perk: "出发时货物完整度 +5",
    unlockHint: "初始伙伴",
  },
  {
    id: "rainwing",
    name: "雷羽",
    role: "agile",
    roleLabel: "灵活",
    perk: "画路消耗云墨 -10%",
    unlockHint: "使用 1 张援助券解锁",
  },
  {
    id: "oldcloth",
    name: "老布",
    role: "heavy",
    roleLabel: "重载",
    perk: "货物完整度上限 +20",
    unlockHint: "邮差等级 3，或使用援助券",
  },
  {
    id: "mico",
    name: "米可",
    role: "rescue",
    roleLabel: "救援",
    perk: "灯塔护盾持续时间 +1.2 秒",
    unlockHint: "完成 5 次配送，或使用援助券",
  },
] as const;

const defaultUiPreferences = (settings: GameSettings): UiPreferences => ({
  music: !settings.muted,
  sound: !settings.muted,
  vibration: true,
  reducedMotion: settings.reducedMotion,
  highContrast: false,
  leftHanded: false,
  quality: "high",
  frameRate: 60,
});

function loadUiPreferences(settings: GameSettings): UiPreferences {
  const fallback = defaultUiPreferences(settings);
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) ?? "null") as Partial<UiPreferences> | null;
    if (!parsed) return fallback;
    return {
      music: typeof parsed.music === "boolean" ? parsed.music : fallback.music,
      sound: typeof parsed.sound === "boolean" ? parsed.sound : fallback.sound,
      vibration: typeof parsed.vibration === "boolean" ? parsed.vibration : fallback.vibration,
      reducedMotion:
        typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : fallback.reducedMotion,
      highContrast:
        typeof parsed.highContrast === "boolean" ? parsed.highContrast : fallback.highContrast,
      leftHanded: typeof parsed.leftHanded === "boolean" ? parsed.leftHanded : fallback.leftHanded,
      quality:
        parsed.quality === "low" || parsed.quality === "medium" || parsed.quality === "high"
          ? parsed.quality
          : fallback.quality,
      frameRate: parsed.frameRate === 30 || parsed.frameRate === 60 ? parsed.frameRate : fallback.frameRate,
    };
  } catch {
    return fallback;
  }
}

let save = gameSaveStore.load();
let preferences = loadUiPreferences(save.settings);
let currentView: AppView = "title";
let settingsReturnView: Exclude<AppView, "settings"> = "title";
let selectedLevelId: LevelId = getNextPlayableLevel(save);
let rosterFilter: RosterFilter = "all";
let modalOpen = false;
let game: CloudwayGame | null = null;
let renderer: GameRenderer | null = null;
let snapshot: GameSnapshot | null = null;
let frameRequest = 0;
let lastFrameTime = 0;
let lastHudTime = 0;
let paused = false;
let drawing = false;
let resultHandled = false;
let resultBonusClaimed = false;
let activeAttemptTicket = "";
let pendingAidCharacter: string | null = null;
let lastDrawSoundAt = 0;
let activePointerId: number | null = null;
let lastHudPaused: boolean | null = null;
let aidActionInFlight = false;

applyPreferences();
renderCurrentView();

app.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>("[data-action]");
  if (!button || button.hasAttribute("disabled")) return;
  const action = button.dataset.action;
  if (!action) return;
  playEffect("tap");
  vibrate(8);
  void handleAction(action, button);
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || currentView !== "game") return;
  event.preventDefault();
  togglePause();
});

window.addEventListener("resize", () => renderer?.resize(), { passive: true });
window.addEventListener("blur", () => {
  drawing = false;
  activePointerId = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentView === "game" && snapshot?.status === "running") {
    pauseGame();
  }
});

function getLevel(levelId: LevelId): LevelConfig {
  const level = LEVELS.find((candidate) => candidate.id === levelId);
  if (!level) throw new RangeError(`Unknown level ${levelId}`);
  return level;
}

function getNextPlayableLevel(candidate: GameSave): LevelId {
  for (const level of LEVELS) {
    if (!candidate.levelRecords[String(level.id)]?.completed) return level.id;
  }
  return 5;
}

function getMaximumUnlockedLevel(candidate: GameSave): LevelId {
  let unlocked = 1;
  for (const level of LEVELS) {
    if (!candidate.levelRecords[String(level.id)]?.completed) break;
    unlocked = Math.min(5, level.id + 1);
  }
  return unlocked as LevelId;
}

function completedLevelCount(candidate = save): number {
  return LEVELS.filter((level) => candidate.levelRecords[String(level.id)]?.completed).length;
}

function resourceModel() {
  return {
    coins: save.coins,
    gems: save.aidTickets,
    energy: 5,
    energyMax: 5,
    unlimitedEnergy: true,
    stamps: save.stamps,
    playerLevel: save.level,
    playerXp: save.xp % XP_PER_LEVEL,
    playerXpMax: XP_PER_LEVEL,
  };
}

function renderCurrentView(): void {
  stopGameLoopIfNeeded();
  modalOpen = false;
  const level = getLevel(selectedLevelId);
  switch (currentView) {
    case "title":
      app.innerHTML = renderTitleView({
        subtitle: "一笔画出云路，护送邮车穿过风暴，再用收益重建浮空小镇。",
        canContinue: save.updatedAt > 0 || completedLevelCount() > 0,
        completedLevels: completedLevelCount(),
        audioEnabled: preferences.music || preferences.sound,
        versionLabel: "公开试玩版 · 本地自动保存",
      });
      break;
    case "town":
      app.innerHTML = renderTownView({
        resources: resourceModel(),
        greeting: `欢迎回来，${characterName(save.selectedCharacter)}`,
        townName: "晨风小镇",
        townLevel: Math.max(1, Math.ceil((buildingTotal() - 2) / 3)),
        townXp: (buildingTotal() * 23) % 100,
        townXpMax: 100,
        buildings: townBuildings(),
        noticeCount: 2,
        nextContract: {
          stageLabel: `下一站 · 1-${level.id}`,
          title: level.title,
          destination: level.id === 5 ? "暴风眼灯塔" : "晨风灯塔",
          rewardCoins: level.baseCoinReward,
          rewardStamps: level.baseStampReward,
          unlocked: true,
        },
      });
      break;
    case "map":
      app.innerHTML = renderMapView({
        resources: resourceModel(),
        chapter: 1,
        chapterTitle: "晨风航线",
        selectedStageId: selectedLevelId,
        stages: LEVELS.map((stage) => ({
          id: stage.id,
          label: `1-${stage.id}`,
          title: stage.title,
          difficulty: stage.difficultyLabel,
          stars: normalizeStars(save.levelRecords[String(stage.id)]?.stars ?? 0),
          current: stage.id === getNextPlayableLevel(save),
          locked: stage.id > getMaximumUnlockedLevel(save),
        })),
      });
      break;
    case "contract":
      app.innerHTML = renderContractView({
        resources: resourceModel(),
        stageLabel: `航线 1-${level.id}`,
        title: level.title,
        subtitle: level.subtitle,
        destination: level.id === 5 ? "暴风眼灯塔" : "晨风灯塔",
        weather: level.obstacles.some((obstacle) => obstacle.motion) ? "阵风 · 移动障碍" : "晴转多云",
        difficulty: level.difficultyLabel,
        goals: [
          { id: "deliver", label: "把全部包裹送到终点", current: 0, target: 1 },
          {
            id: "cargo",
            label: `货物完整度不低于 ${level.starCriteria.cargoForTwoStars} 点`,
            current: level.startingCargoIntegrity,
            target: level.starCriteria.cargoForTwoStars,
            complete: true,
          },
          { id: "stamp", label: "收集沿途纪念邮票", current: 0, target: 1 },
        ],
        postmanName: characterName(save.selectedCharacter),
        vehicleName: `经典邮车 Mk.${save.vehicleLevel}`,
        rewardCoins: adjustedLevel(level).baseCoinReward,
        rewardStamps: level.baseStampReward,
        rewardXp: 35 + level.id * 5,
        energyCost: 0,
        canStart: level.id <= getMaximumUnlockedLevel(save),
      });
      break;
    case "characters":
      app.innerHTML = renderRosterView({
        resources: resourceModel(),
        activeFilter: rosterFilter,
        characters: characterModels(),
      });
      break;
    case "company":
      app.innerHTML = renderCompanyView({
        resources: resourceModel(),
        companyName: "云路邮政公司",
        companyLevel: companyLevel(),
        reputation: Math.min(1000, save.xp + completedLevelCount() * 75),
        reputationMax: 1000,
        branches: companyBranches(),
      });
      break;
    case "settings":
      app.innerHTML = renderSettingsView(preferences as SettingsViewModel);
      break;
    case "game":
      mountGame();
      break;
  }
}

function townBuildings(): TownBuildingModel[] {
  return [
    {
      id: "dispatchCenter",
      name: "云端邮局",
      description: "每级提高合同基础金币",
      level: save.buildings.dispatchCenter,
      icon: "mail",
      state: save.buildings.dispatchCenter >= MAX_BUILDING_LEVEL ? "ready" : "upgrade",
      badge: save.buildings.dispatchCenter < MAX_BUILDING_LEVEL ? "可升级" : "满级",
    },
    {
      id: "convenienceStore",
      name: "云端便利站",
      description: "每级提高货物初始完整度",
      level: save.buildings.convenienceStore,
      icon: "shop",
      state: save.buildings.convenienceStore >= MAX_BUILDING_LEVEL ? "ready" : "upgrade",
      badge: "营业中",
    },
    {
      id: "home",
      name: "邮差之家",
      description: "每级提高配送经验",
      level: save.buildings.home,
      icon: "home",
      state: save.buildings.home >= MAX_BUILDING_LEVEL ? "ready" : "upgrade",
    },
    {
      id: "garage",
      name: "浮空车库",
      description: "每级提高邮车速度",
      level: save.vehicleLevel,
      icon: "garage",
      state: save.vehicleLevel >= MAX_BUILDING_LEVEL ? "ready" : "upgrade",
      badge: save.vehicleLevel >= MAX_BUILDING_LEVEL ? "满级" : "可改装",
    },
  ];
}

function companyBranches(): CompanyBranchModel[] {
  return [
    {
      id: "garage",
      name: "车库",
      description: "每级让邮车基础速度提高 3%",
      icon: "garage",
      level: save.vehicleLevel,
      maxLevel: MAX_BUILDING_LEVEL,
      progress: save.vehicleLevel * 20,
      cost: upgradeCost("garage", save.vehicleLevel),
    },
    {
      id: "weather",
      name: "气象中心",
      description: "升级调度，增加每份合同的基础报酬",
      icon: "weather",
      level: save.buildings.dispatchCenter,
      maxLevel: MAX_BUILDING_LEVEL,
      progress: save.buildings.dispatchCenter * 20,
      cost: upgradeCost("dispatchCenter", save.buildings.dispatchCenter),
    },
    {
      id: "logistics",
      name: "物流仓",
      description: "升级便利站，提高货箱出发完整度",
      icon: "logistics",
      level: save.buildings.convenienceStore,
      maxLevel: MAX_BUILDING_LEVEL,
      progress: save.buildings.convenienceStore * 20,
      cost: upgradeCost("convenienceStore", save.buildings.convenienceStore),
      locked: companyLevel() < 2,
    },
  ];
}

function characterModels(): CharacterCardModel[] {
  const deliveries = Object.values(save.levelRecords).filter((record) => record.completed).length;
  return CHARACTERS.map((character) => {
    const progressionUnlocked =
      character.id === "rookie" ||
      (character.id === "oldcloth" && save.level >= 3) ||
      (character.id === "mico" && deliveries >= 5);
    const unlocked = progressionUnlocked || save.unlockedCharacters.includes(character.id);
    return {
      id: character.id,
      name: character.name,
      role: character.role,
      roleLabel: character.roleLabel,
      level: save.level,
      perk: character.perk,
      locked: !unlocked,
      selected: save.selectedCharacter === character.id,
      unlockHint: character.unlockHint,
    };
  });
}

function adjustedLevel(base: LevelConfig): LevelConfig {
  const selected = CHARACTERS.find((character) => character.id === save.selectedCharacter) ?? CHARACTERS[0];
  const cargoBonus =
    (save.buildings.convenienceStore - 1) * 4 +
    (selected?.role === "balanced" ? 5 : 0) +
    (selected?.role === "heavy" ? 20 : 0);
  const inkMultiplier = selected?.role === "agile" ? 0.9 : 1;
  const shieldBonus = selected?.role === "rescue" ? 1.2 : 0;
  return {
    ...base,
    vehicleSpeed: base.vehicleSpeed * (1 + (save.vehicleLevel - 1) * 0.03),
    startingCargoIntegrity: base.startingCargoIntegrity + cargoBonus,
    baseCoinReward: Math.round(base.baseCoinReward * (1 + (save.buildings.dispatchCenter - 1) * 0.08)),
    pathRules: {
      ...base.pathRules,
      inkPerPixel: base.pathRules.inkPerPixel * inkMultiplier,
    },
    lighthouse: {
      ...base.lighthouse,
      shieldDurationSeconds: base.lighthouse.shieldDurationSeconds + shieldBonus,
    },
  };
}

function mountGame(): void {
  app.innerHTML = `
    <main class="screen screen--game" data-view="game">
      <canvas id="game-canvas" class="game-canvas" width="390" height="844" aria-label="配送关卡：按住并画出云路"></canvas>
      <div id="hud-root"></div>
      <div id="game-dialogs"></div>
      <p class="game-access-note" aria-live="polite">按住画路，邮车会自动前进；按 Esc 可暂停。</p>
    </main>`;

  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  if (!canvas) throw new Error("Game canvas failed to mount");
  renderer = new GameRenderer(canvas);
  renderer.setQuality(preferences.quality);
  renderer.setReducedMotion(preferences.reducedMotion || preferences.quality === "low");
  game = createGame({
    level: adjustedLevel(getLevel(selectedLevelId)),
    seed: Math.floor(Date.now() / 1000),
  });
  snapshot = game.start();
  game.consumeEvents();
  paused = false;
  drawing = false;
  resultHandled = false;
  resultBonusClaimed = false;
  lastHudPaused = null;
  activeAttemptTicket = createRewardTicketId(`level-${selectedLevelId}`);
  modalOpen = false;
  attachCanvasInput(canvas);
  renderGameFrame(true);
  lastFrameTime = performance.now();
  lastHudTime = 0;
  frameRequest = requestAnimationFrame(gameLoop);
}

function attachCanvasInput(canvas: HTMLCanvasElement): void {
  canvas.addEventListener("pointerdown", (event) => {
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      activePointerId !== null ||
      !game ||
      !renderer ||
      paused ||
      snapshot?.status !== "running"
    ) {
      return;
    }
    drawing = true;
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    appendPointerPoint(event);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing || event.pointerId !== activePointerId) return;
    appendPointerPoint(event);
    event.preventDefault();
  });
  const stopDrawing = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) return;
    drawing = false;
    activePointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
}

function appendPointerPoint(event: PointerEvent): void {
  if (!game || !renderer) return;
  const result = game.appendPath(renderer.toWorld(event.clientX, event.clientY));
  if (!result.accepted) return;
  const now = performance.now();
  if (now - lastDrawSoundAt > 90) {
    playEffect("draw");
    lastDrawSoundAt = now;
  }
}

function gameLoop(now: number): void {
  if (currentView !== "game" || !game || !renderer) return;
  const minimumFrameMs = 1000 / preferences.frameRate;
  if (now - lastFrameTime < minimumFrameMs - 1) {
    frameRequest = requestAnimationFrame(gameLoop);
    return;
  }
  const delta = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  snapshot = !paused && snapshot?.status === "running" ? game.advance(delta) : game.getSnapshot();
  const events = game.consumeEvents();
  handleGameEvents(events);
  renderer.handleEvents(events, snapshot);
  renderer.render(snapshot);
  if (now - lastHudTime >= 90) {
    updateHud();
    lastHudTime = now;
  }
  if (snapshot.status === "upgrade-choice" && !modalOpen) showRelayModal(snapshot);
  frameRequest = requestAnimationFrame(gameLoop);
}

function renderGameFrame(forceHud = false): void {
  if (!game || !renderer) return;
  snapshot = game.getSnapshot();
  renderer.render(snapshot);
  if (forceHud) updateHud();
}

function updateHud(): void {
  if (!snapshot) return;
  const hud = document.querySelector<HTMLElement>("#hud-root");
  if (!hud) return;
  const displayProgress = snapshot.status === "won" ? 100 : snapshot.progress * 100;
  const abilityStatus =
    snapshot.status === "upgrade-choice"
      ? "选择增益中"
      : snapshot.status === "won" || snapshot.status === "lost"
        ? "本局结束"
        : undefined;
  const model = {
    stageLabel: `1-${snapshot.level.id} · ${snapshot.level.title}`,
    progress: displayProgress,
    remainingSeconds: snapshot.remainingSeconds,
    ink: snapshot.ink.current,
    inkMax: snapshot.ink.capacity,
    cargo: snapshot.cargo.integrity,
    cargoMax: snapshot.cargo.maximum,
    coins: snapshot.coins,
    abilityReady: snapshot.lighthouse.ready && !paused,
    abilityCooldown: snapshot.lighthouse.cooldownRemaining,
    abilityLabel: snapshot.lighthouse.activeRemaining > 0 ? "护盾中" : "灯塔",
    abilityStatus,
    paused,
  };
  const existing = hud.querySelector<HTMLElement>(".game-hud");
  if (!existing || lastHudPaused !== paused) {
    hud.innerHTML = renderHud(model);
    lastHudPaused = paused;
    return;
  }

  setText(existing.querySelector(".hud-progress > strong"), `${Math.round(displayProgress)}%`);
  setProgress(existing.querySelector<HTMLElement>(".hud-progress .progress-track i"), displayProgress);
  setText(existing.querySelector(".hud-time strong"), formatClock(snapshot.remainingSeconds));
  setText(existing.querySelector(".hud-meter--ink > strong"), `${Math.round(snapshot.ink.ratio * 100)}%`);
  setProgress(existing.querySelector<HTMLElement>(".hud-meter--ink .vertical-meter i"), snapshot.ink.ratio * 100);
  setText(existing.querySelector(".hud-meter--cargo > strong"), `${Math.round(snapshot.cargo.ratio * 100)}%`);
  setProgress(existing.querySelector<HTMLElement>(".hud-meter--cargo .vertical-meter i"), snapshot.cargo.ratio * 100);
  setText(existing.querySelector(".hud-coins strong"), String(snapshot.coins));
  const ability = existing.querySelector<HTMLButtonElement>(".ability-button");
  if (ability) {
    const ready = snapshot.lighthouse.ready && !paused;
    ability.disabled = !ready;
    ability.classList.toggle("is-ready", ready);
    ability.classList.toggle("is-cooldown", !ready);
    const label = snapshot.lighthouse.activeRemaining > 0 ? "护盾中" : "灯塔";
    setText(ability.querySelector("strong"), label);
    const statusText = abilityStatus ?? (ready ? "就绪" : `${snapshot.lighthouse.cooldownRemaining.toFixed(1)}s`);
    setText(ability.querySelector("em"), statusText);
    ability.setAttribute(
      "aria-label",
      `${label}，${statusText}`,
    );
  }
}

function handleGameEvents(events: readonly GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case "collectible":
        playEffect(event.kind === "coin" ? "coin" : "perfect");
        vibrate(18);
        break;
      case "collision":
        playEffect("crash");
        vibrate([35, 30, 45]);
        break;
      case "shield-blocked":
      case "shield-activated":
        playEffect("shield");
        vibrate(22);
        break;
      case "upgrade":
        playEffect("upgrade");
        break;
      case "won":
        playEffect("success");
        settleWin(event.result);
        showResultModal(event.result);
        break;
      case "lost":
        playEffect("crash");
        showResultModal(event.result);
        break;
      default:
        break;
    }
  }
}

function settleWin(result: LevelResult): void {
  if (resultHandled) return;
  resultHandled = true;
  const level = getLevel(selectedLevelId);
  const xpEarned = Math.round((35 + level.id * 5) * (1 + (save.buildings.home - 1) * 0.08));
  save = gameSaveStore.update((draft) => {
    draft.coins += result.coinsEarned;
    draft.stamps += result.stampsEarned;
    draft.xp += xpEarned;
    draft.level = Math.floor(draft.xp / XP_PER_LEVEL) + 1;
    const key = String(selectedLevelId);
    const previous = draft.levelRecords[key];
    const score = result.coinsEarned * 100 + result.stars * 1000;
    draft.levelRecords[key] = {
      completed: true,
      stars: Math.max(previous?.stars ?? 0, result.stars),
      bestScore: Math.max(previous?.bestScore ?? 0, score),
    };
  });
}

function showRelayModal(current: GameSnapshot): void {
  const choices = current.relay.choices;
  showModal({
    kind: "reward",
    eyebrow: "中继站 · 三选一",
    title: "为后半程装上一件增益",
    body: "关卡已经暂停。选择后会立刻生效，再继续沿云路前进。",
    icon: "gift",
    stats: choices.map((id) => ({
      label: UPGRADES[id].title,
      value: UPGRADES[id].description,
      icon: upgradeIcon(id),
    })),
    actions: choices.map((id, index) => ({
      action: "choose-upgrade",
      value: id,
      label: UPGRADES[id].title,
      tone: index === 0 ? "primary" : "secondary",
    })),
  });
}

function showResultModal(result: LevelResult): void {
  const won = result.outcome === "won";
  const bonus = Math.max(8, Math.round(result.coinsEarned * 0.5));
  const actions: Array<NonNullable<ModalViewModel["actions"]>[number]> = won
    ? [
        {
          action: selectedLevelId < 5 ? "next-level" : "return-town",
          label: selectedLevelId < 5 ? "下一份合同" : "返回小镇",
          tone: "primary",
        },
        { action: "retry-level", label: "再跑一次", tone: "secondary" },
      ]
    : [
        {
          action: "aid-retry",
          label: `援助重发 · 护盾开局（余 ${save.aidTickets}）`,
          tone: "video",
          disabled: save.aidTickets < 1,
        },
        { action: "retry-level", label: "普通重试", tone: "primary" },
        { action: "return-town", label: "返回小镇", tone: "secondary" },
      ];
  if (won && !resultBonusClaimed && save.aidTickets > 0) {
    actions.splice(1, 0, {
      action: "claim-result-bonus",
      value: String(bonus),
      label: `援助加急 · 再得 ${bonus} 金币`,
      tone: "video",
    });
  }
  showModal({
    kind: "result",
    eyebrow: won ? `航线 1-${selectedLevelId} 完成` : "本次配送未完成",
    title: won ? `${"★".repeat(result.stars)}${"☆".repeat(3 - result.stars)} 准时送达` : result.reason === "cargo" ? "货箱受损过重" : "配送时间用尽",
    body: won
      ? "金币已入账，小镇建筑和公司部门现在都可以继续成长。"
      : "重新规划路线即可再试；援助券只是未来激励视频接口的本地替代，不会触发真实广告。",
    icon: won ? "star" : "cloud",
    stats: [
      {
        label: won ? "金币" : "本局金币（未入账）",
        value: String(result.coinsEarned),
        icon: "coin",
      },
      {
        label: won ? "邮票" : "本局邮票（未入账）",
        value: String(result.stampsEarned),
        icon: "stamp",
      },
      { label: "星级", value: `${result.stars} / 3`, icon: "star" },
    ],
    actions,
  });
}

function showModal(model: ModalViewModel): void {
  closeModal();
  const target = document.querySelector<HTMLElement>("#game-dialogs") ?? app;
  target.insertAdjacentHTML("beforeend", renderModal(model));
  modalOpen = true;
  requestAnimationFrame(() => target.querySelector<HTMLElement>(".modal-actions button:not([disabled])")?.focus());
}

function closeModal(): void {
  document.querySelectorAll(".modal-layer").forEach((element) => element.remove());
  modalOpen = false;
}

async function handleAction(action: string, element: HTMLElement): Promise<void> {
  switch (action) {
    case "start-game":
      navigate("town");
      showModal({
        kind: "info",
        eyebrow: "30 秒上手",
        title: "画一条路，邮车自己走",
        body: "进入合同后，从邮车附近按住拖动，绕开风暴和浮岛。行程过半会暂停并让你选一次增益。",
        icon: "route",
        actions: [
          { action: "open-next-contract", label: "去看第一份合同", tone: "primary" },
          { action: "close-modal", label: "先逛逛小镇", tone: "secondary" },
        ],
      });
      break;
    case "continue-game":
      selectedLevelId = getNextPlayableLevel(save);
      navigate("contract");
      break;
    case "navigate":
      navigate(asView(element.dataset.value));
      break;
    case "open-next-contract":
      closeModal();
      selectedLevelId = getNextPlayableLevel(save);
      navigate("contract");
      break;
    case "open-contract": {
      const value = Number(element.dataset.value);
      if (Number.isInteger(value) && value >= 1 && value <= 5) selectedLevelId = value as LevelId;
      navigate("contract");
      break;
    }
    case "select-stage": {
      const value = Number(element.dataset.id);
      if (Number.isInteger(value) && value >= 1 && value <= 5) {
        selectedLevelId = value as LevelId;
        renderCurrentView();
      }
      break;
    }
    case "back-to-map":
      navigate("map");
      break;
    case "start-level":
      navigate("game");
      break;
    case "open-settings":
      settingsReturnView = currentView === "settings" ? "title" : currentView;
      navigate("settings");
      break;
    case "close-settings":
      navigate(settingsReturnView);
      break;
    case "toggle-audio":
      preferences.music = !(preferences.music || preferences.sound);
      preferences.sound = preferences.music;
      persistPreferences();
      renderCurrentView();
      break;
    case "toggle-setting":
      toggleSetting(element.dataset.setting);
      break;
    case "set-setting":
      setSetting(element.dataset.setting, element.dataset.value);
      break;
    case "show-how-to-play":
      showModal({
        kind: "info",
        title: "操作说明",
        body: "在关卡画布上按住拖动来铺路；邮车会自动沿线前进。路可以分段续画。点击灯塔获得短暂护盾，Esc 可暂停。",
        icon: "route",
        actions: [{ action: "close-modal", label: "知道了", tone: "primary" }],
      });
      break;
    case "reset-save":
      showModal({
        kind: "error",
        title: "重置全部本地进度？",
        body: "金币、关卡星级、建筑等级和角色都会回到初始状态。此操作无法撤销。",
        icon: "cloud",
        actions: [
          { action: "confirm-reset-save", label: "确认重置", tone: "danger" },
          { action: "close-modal", label: "取消", tone: "secondary" },
        ],
      });
      break;
    case "confirm-reset-save":
      save = gameSaveStore.reset();
      preferences = defaultUiPreferences(save.settings);
      persistPreferences();
      selectedLevelId = 1;
      closeModal();
      showToast("本地存档已重置");
      renderCurrentView();
      break;
    case "close-modal":
      closeModal();
      break;
    case "open-tasks":
      showModal({
        kind: "reward",
        eyebrow: "今日清单",
        title: "两件小事，顺路完成",
        body: "完成 1 次配送；在关卡中收集 1 枚邮票。正式版可接入每日刷新与服务端校验。",
        icon: "check",
        stats: [
          { label: "配送", value: completedLevelCount() > 0 ? "已完成" : "0 / 1", icon: "route" },
          { label: "邮票", value: "关卡中收集", icon: "stamp" },
        ],
        actions: [{ action: "close-modal", label: "继续", tone: "primary" }],
      });
      break;
    case "open-energy":
      showModal({
        kind: "info",
        title: "试玩版不限体力",
        body: "界面保留体力位，方便以后做恢复、活动或商业化；当前所有关卡都可反复游玩，不会消耗真实资源。",
        icon: "energy",
        actions: [{ action: "close-modal", label: "明白", tone: "primary" }],
      });
      break;
    case "open-building":
      openBuilding(element.dataset.id);
      break;
    case "upgrade-building":
      upgradeBuilding(element.dataset.value);
      break;
    case "upgrade-branch":
      upgradeCompanyBranch(element.dataset.id);
      break;
    case "open-company-rewards":
      showModal({
        kind: "reward",
        title: "公司声望正在累积",
        body: "每次通关都会增加经验与声望。试玩版已实现部门成长和实际关卡加成，阶段宝箱将在后续版本开放。",
        icon: "gift",
        actions: [{ action: "close-modal", label: "继续经营", tone: "primary" }],
      });
      break;
    case "filter-roster":
      rosterFilter = asRosterFilter(element.dataset.value);
      renderCurrentView();
      break;
    case "select-character":
      if (!element.dataset.id) {
        navigate("characters");
      } else {
        selectCharacter(element.dataset.id);
      }
      break;
    case "trial-character":
      promptCharacterAid(element.dataset.id);
      break;
    case "claim-character-aid":
      await claimCharacterAid(element.dataset.value);
      break;
    case "select-vehicle":
      showModal({
        kind: "info",
        title: `经典邮车 Mk.${save.vehicleLevel}`,
        body: "去公司车库升级后，邮车在每一关都会获得更高基础速度。",
        icon: "garage",
        actions: [
          { action: "go-company", label: "前往公司", tone: "primary" },
          { action: "close-modal", label: "保持当前配置", tone: "secondary" },
        ],
      });
      break;
    case "go-company":
      closeModal();
      navigate("company");
      break;
    case "toggle-pause":
      togglePause();
      break;
    case "resume-game":
      closeModal();
      paused = false;
      lastFrameTime = performance.now();
      updateHud();
      break;
    case "return-town":
      closeModal();
      selectedLevelId = getNextPlayableLevel(save);
      navigate("town");
      break;
    case "retry-level":
      closeModal();
      restartLevel(false);
      break;
    case "next-level":
      closeModal();
      selectedLevelId = Math.min(5, selectedLevelId + 1) as LevelId;
      navigate("contract");
      break;
    case "choose-upgrade":
      chooseUpgrade(element.dataset.value);
      break;
    case "use-ability":
      if (game?.activateLighthouse()) {
        snapshot = game.getSnapshot();
        updateHud();
      }
      break;
    case "aid-retry":
      await claimAidRetry();
      break;
    case "claim-result-bonus":
      await claimResultBonus(Number(element.dataset.value));
      break;
    default:
      showToast("这个入口正在准备中");
  }
}

function navigate(view: Exclude<AppView, "settings"> | "settings"): void {
  currentView = view;
  renderCurrentView();
}

function asView(value: string | undefined): Exclude<AppView, "title" | "contract" | "settings" | "game"> {
  if (value === "map" || value === "characters" || value === "company") return value;
  return "town";
}

function asRosterFilter(value: string | undefined): RosterFilter {
  if (value === "agile" || value === "heavy" || value === "rescue") return value;
  return "all";
}

function togglePause(): void {
  if (!snapshot || (snapshot.status !== "running" && !paused)) return;
  if (paused) {
    closeModal();
    paused = false;
    lastFrameTime = performance.now();
    updateHud();
  } else {
    pauseGame();
  }
}

function pauseGame(): void {
  if (paused || snapshot?.status !== "running") return;
  paused = true;
  drawing = false;
  activePointerId = null;
  updateHud();
  showModal({
    kind: "pause",
    title: "配送已暂停",
    body: "路线和剩余时间都已冻结。",
    icon: "pause",
    actions: [
      { action: "resume-game", label: "继续配送", tone: "primary" },
      { action: "retry-level", label: "重新开始", tone: "secondary" },
      { action: "return-town", label: "返回小镇", tone: "secondary" },
    ],
  });
}

function restartLevel(withAidShield: boolean): void {
  if (!game) return;
  const base = adjustedLevel(getLevel(selectedLevelId));
  game = createGame({
    level: withAidShield
      ? { ...base, lighthouse: { ...base.lighthouse, shieldDurationSeconds: 10 } }
      : base,
    seed: Math.floor(Date.now() / 1000),
  });
  snapshot = game.start();
  game.consumeEvents();
  paused = false;
  drawing = false;
  activePointerId = null;
  resultHandled = false;
  resultBonusClaimed = false;
  activeAttemptTicket = createRewardTicketId(`level-${selectedLevelId}`);
  if (withAidShield) game.activateLighthouse();
  renderGameFrame(true);
  lastFrameTime = performance.now();
}

function chooseUpgrade(value: string | undefined): void {
  if (!game || !value || !(value in UPGRADES)) return;
  if (game.chooseRelayUpgrade(value as UpgradeId)) {
    closeModal();
    snapshot = game.getSnapshot();
    lastFrameTime = performance.now();
    updateHud();
  }
}

async function claimAidRetry(): Promise<void> {
  if (aidActionInFlight) return;
  aidActionInFlight = true;
  const result = await rewardService.claim({
    ticketId: `${activeAttemptTicket}:rescue`,
    grant: { kind: "continue" },
  });
  save = gameSaveStore.load();
  if (result.status !== "granted") {
    aidActionInFlight = false;
    showToast(result.reason === "no-tickets" ? "援助券不足" : "暂时无法使用援助");
    return;
  }
  closeModal();
  restartLevel(true);
  aidActionInFlight = false;
  showToast("援助生效：本局以 10 秒灯塔护盾开场");
}

async function claimResultBonus(amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0 || !snapshot?.result || aidActionInFlight) return;
  aidActionInFlight = true;
  const result = await rewardService.claim({
    ticketId: `${activeAttemptTicket}:bonus`,
    grant: { kind: "bonus-coins", amount: Math.round(amount) },
  });
  if (result.status !== "granted") {
    save = gameSaveStore.load();
    aidActionInFlight = false;
    showToast(result.reason === "no-tickets" ? "援助券不足" : "奖励暂不可用");
    return;
  }
  if (result.newlyGranted) {
    save = gameSaveStore.update((draft) => {
      draft.coins += Math.round(amount);
    });
  } else {
    save = gameSaveStore.load();
  }
  resultBonusClaimed = true;
  aidActionInFlight = false;
  showToast(`援助加急成功，获得 ${Math.round(amount)} 金币`);
  showResultModal(snapshot.result);
}

function promptCharacterAid(characterId: string | undefined): void {
  const character = CHARACTERS.find((candidate) => candidate.id === characterId);
  if (!character) return;
  pendingAidCharacter = character.id;
  showModal({
    kind: "rescue",
    eyebrow: "商业化接口预览",
    title: `邀请 ${character.name} 加入车队`,
    body: `当前不会播放真实广告，而是消耗 1 张本地援助券完成解锁。未来可把同一按钮替换为 30 秒激励视频，成功回调后再发放角色。`,
    icon: "video",
    stats: [
      { label: "角色能力", value: character.perk, icon: "user" },
      { label: "援助券", value: `${save.aidTickets} 张`, icon: "gift" },
    ],
    actions: [
      {
        action: "claim-character-aid",
        value: character.id,
        label: "使用 1 张援助券解锁",
        tone: "video",
        disabled: save.aidTickets < 1,
      },
      { action: "close-modal", label: "稍后再说", tone: "secondary" },
    ],
  });
}

async function claimCharacterAid(characterId: string | undefined): Promise<void> {
  if (!characterId || pendingAidCharacter !== characterId || aidActionInFlight) return;
  aidActionInFlight = true;
  const result = await rewardService.claim({
    ticketId: `character-unlock:${characterId}`,
    grant: { kind: "character-unlock", characterId },
  });
  save = gameSaveStore.load();
  if (result.status !== "granted") {
    aidActionInFlight = false;
    showToast(result.reason === "no-tickets" ? "援助券不足" : "解锁暂不可用");
    return;
  }
  save = gameSaveStore.update((draft) => {
    if (!draft.unlockedCharacters.includes(characterId)) draft.unlockedCharacters.push(characterId);
    draft.selectedCharacter = characterId;
  });
  pendingAidCharacter = null;
  aidActionInFlight = false;
  closeModal();
  showToast(`${characterName(characterId)} 已加入并设为出战`);
  renderCurrentView();
}

function selectCharacter(characterId: string): void {
  const model = characterModels().find((candidate) => candidate.id === characterId);
  if (!model || model.locked) return;
  save = gameSaveStore.update((draft) => {
    if (!draft.unlockedCharacters.includes(characterId)) draft.unlockedCharacters.push(characterId);
    draft.selectedCharacter = characterId;
  });
  showToast(`${characterName(characterId)} 已设为出战`);
  renderCurrentView();
}

function openBuilding(buildingId: string | undefined): void {
  if (!buildingId) return;
  const building = townBuildings().find((candidate) => candidate.id === buildingId);
  if (!building) return;
  if (building.state === "locked") {
    showModal({
      kind: "info",
      title: `${building.name} 尚未开放`,
      body: "先完成配送或升级其他建筑，提高公司等级后即可改装邮车。",
      icon: "lock",
      actions: [{ action: "close-modal", label: "继续经营", tone: "primary" }],
    });
    return;
  }
  const level = building.level ?? 1;
  const cost = upgradeCost(buildingId, level);
  const atMaximum = level >= MAX_BUILDING_LEVEL;
  showModal({
    kind: "reward",
    eyebrow: `${building.name} · Lv.${level}`,
    title: atMaximum ? "建筑已达到最高等级" : "投入本次配送收益继续扩建",
    body: building.description,
    icon: building.icon,
    stats: [
      { label: "当前金币", value: String(save.coins), icon: "coin" },
      { label: "升级费用", value: atMaximum ? "已满级" : String(cost), icon: "coin" },
    ],
    actions: [
      {
        action: "upgrade-building",
        value: buildingId,
        label: atMaximum ? "已满级" : `升级到 Lv.${level + 1}`,
        tone: "primary",
        disabled: atMaximum || save.coins < cost,
      },
      { action: "close-modal", label: "返回小镇", tone: "secondary" },
    ],
  });
}

function upgradeBuilding(buildingId: string | undefined): void {
  if (!buildingId) return;
  const currentLevel = buildingId === "garage" ? save.vehicleLevel : buildingLevel(buildingId);
  if (currentLevel === null || currentLevel >= MAX_BUILDING_LEVEL) return;
  const cost = upgradeCost(buildingId, currentLevel);
  if (save.coins < cost) {
    showToast("金币不足，先完成一份合同吧");
    return;
  }
  save = gameSaveStore.update((draft) => {
    draft.coins -= cost;
    if (buildingId === "garage") draft.vehicleLevel += 1;
    else if (buildingId === "home") draft.buildings.home += 1;
    else if (buildingId === "convenienceStore") draft.buildings.convenienceStore += 1;
    else if (buildingId === "dispatchCenter") draft.buildings.dispatchCenter += 1;
  });
  closeModal();
  playEffect("upgrade");
  showToast("升级完成，加成已应用到下一次配送");
  renderCurrentView();
}

function upgradeCompanyBranch(branchId: string | undefined): void {
  const mapping: Record<string, string> = {
    garage: "garage",
    weather: "dispatchCenter",
    logistics: "convenienceStore",
  };
  const buildingId = branchId ? mapping[branchId] : undefined;
  if (!buildingId) return;
  upgradeBuilding(buildingId);
}

function buildingLevel(buildingId: string): number | null {
  if (buildingId === "home") return save.buildings.home;
  if (buildingId === "convenienceStore") return save.buildings.convenienceStore;
  if (buildingId === "dispatchCenter") return save.buildings.dispatchCenter;
  return null;
}

function buildingTotal(): number {
  return save.buildings.home + save.buildings.convenienceStore + save.buildings.dispatchCenter + save.vehicleLevel;
}

function companyLevel(): number {
  return Math.max(1, Math.floor((buildingTotal() - 4) / 2) + 1);
}

function upgradeCost(buildingId: string, level: number): number {
  const base: Record<string, number> = {
    home: 70,
    convenienceStore: 90,
    dispatchCenter: 105,
    garage: 120,
  };
  return Math.round((base[buildingId] ?? 100) * Math.max(1, level));
}

function toggleSetting(setting: string | undefined): void {
  if (!setting) return;
  if (setting === "music") preferences.music = !preferences.music;
  else if (setting === "sound") preferences.sound = !preferences.sound;
  else if (setting === "vibration") preferences.vibration = !preferences.vibration;
  else if (setting === "reducedMotion") preferences.reducedMotion = !preferences.reducedMotion;
  else if (setting === "highContrast") preferences.highContrast = !preferences.highContrast;
  else if (setting === "leftHanded") preferences.leftHanded = !preferences.leftHanded;
  else return;
  persistPreferences();
  renderCurrentView();
}

function setSetting(setting: string | undefined, value: string | undefined): void {
  if (setting === "quality" && (value === "low" || value === "medium" || value === "high")) {
    preferences.quality = value;
  } else if (setting === "frameRate" && (value === "30" || value === "60")) {
    preferences.frameRate = Number(value) as 30 | 60;
  } else {
    return;
  }
  persistPreferences();
  renderCurrentView();
}

function persistPreferences(): void {
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // The game remains usable when storage is blocked.
  }
  save = gameSaveStore.update((draft) => {
    draft.settings.muted = !preferences.music && !preferences.sound;
    draft.settings.reducedMotion = preferences.reducedMotion;
  });
  applyPreferences();
}

function applyPreferences(): void {
  document.documentElement.classList.toggle("high-contrast", preferences.highContrast);
  document.documentElement.classList.toggle("left-handed", preferences.leftHanded);
  document.documentElement.classList.toggle("reduced-motion", preferences.reducedMotion);
  document.documentElement.dataset.quality = preferences.quality;
  gameAudio.setMuted(!preferences.music && !preferences.sound);
  if (preferences.music) gameAudio.startMusic();
  else gameAudio.stopMusic();
  renderer?.setReducedMotion(preferences.reducedMotion || preferences.quality === "low");
  renderer?.setQuality(preferences.quality);
}

function playEffect(effect: SoundEffect): void {
  if (preferences.sound) gameAudio.playSfx(effect);
}

function vibrate(pattern: number | number[]): void {
  if (!preferences.vibration || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}

function stopGameLoopIfNeeded(): void {
  if (currentView === "game") return;
  if (frameRequest) cancelAnimationFrame(frameRequest);
  frameRequest = 0;
  game = null;
  renderer = null;
  snapshot = null;
  drawing = false;
  activePointerId = null;
  paused = false;
}

function showToast(message: string): void {
  document.querySelectorAll(".app-toast").forEach((element) => element.remove());
  const toast = document.createElement("div");
  toast.className = "app-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), preferences.reducedMotion ? 1400 : 2400);
}

function characterName(characterId: string): string {
  return CHARACTERS.find((character) => character.id === characterId)?.name ?? "阿岚";
}

function normalizeStars(value: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.floor(value))) as 0 | 1 | 2 | 3;
}

function setText(element: Element | null, value: string): void {
  if (element && element.textContent !== value) element.textContent = value;
}

function setProgress(element: HTMLElement | null, value: number): void {
  element?.style.setProperty("--progress", `${Math.max(0, Math.min(100, value))}%`);
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function upgradeIcon(upgradeId: UpgradeId): "speed" | "shield" | "ink" | "coin" {
  if (upgradeId === "tailwind") return "speed";
  if (upgradeId === "cloud-recycler") return "ink";
  if (upgradeId === "express-bonus") return "coin";
  return "shield";
}
