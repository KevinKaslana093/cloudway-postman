import type { GameEvent, GameSnapshot, Vec2 } from "./types";
import {
  artAssets,
  getLevelArtTheme,
  type CommonSpriteKey,
} from "./art-assets";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const WORLD_WIDTH = 390;
const WORLD_HEIGHT = 844;

export interface CanvasMetrics {
  backingWidth: number;
  backingHeight: number;
  scaleX: number;
  scaleY: number;
}

export function calculateCanvasMetrics(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maximumRatio: number,
): CanvasMetrics {
  const safeWidth = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : WORLD_WIDTH;
  const safeHeight = Number.isFinite(cssHeight) && cssHeight > 0 ? cssHeight : WORLD_HEIGHT;
  const safeDeviceRatio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const pixelRatio = Math.min(safeDeviceRatio, maximumRatio);
  const backingWidth = Math.max(1, Math.round(safeWidth * pixelRatio));
  const backingHeight = Math.max(1, Math.round(safeHeight * pixelRatio));

  return {
    backingWidth,
    backingHeight,
    scaleX: backingWidth / WORLD_WIDTH,
    scaleY: backingHeight / WORLD_HEIGHT,
  };
}

export class GameRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver | null;
  private particles: Particle[] = [];
  private reducedMotion = false;
  private quality: "low" | "medium" | "high" = "high";
  private lastTimestamp = performance.now();
  private readonly requestedArtLevels = new Set<GameSnapshot["level"]["id"]>();
  private artSweepStarted = false;

  private readonly handleSurfaceResize = (): void => {
    this.resize();
  };

  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden) this.resize();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.context = context;
    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(this.handleSurfaceResize);
    this.resizeObserver?.observe(this.canvas);
    this.canvas.addEventListener("contextrestored", this.handleSurfaceResize);
    window.addEventListener("pageshow", this.handleSurfaceResize);
    window.addEventListener("orientationchange", this.handleSurfaceResize, { passive: true });
    window.visualViewport?.addEventListener("resize", this.handleSurfaceResize, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.resize();
  }

  resize(): void {
    const maximumRatio = this.quality === "low" ? 1 : this.quality === "medium" ? 1.5 : 2;
    const bounds = this.canvas.getBoundingClientRect();
    const metrics = calculateCanvasMetrics(
      bounds.width || this.canvas.clientWidth,
      bounds.height || this.canvas.clientHeight,
      window.devicePixelRatio || 1,
      maximumRatio,
    );

    if (
      this.canvas.width !== metrics.backingWidth ||
      this.canvas.height !== metrics.backingHeight
    ) {
      this.canvas.width = metrics.backingWidth;
      this.canvas.height = metrics.backingHeight;
    }
    this.applyWorldTransform();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener("contextrestored", this.handleSurfaceResize);
    window.removeEventListener("pageshow", this.handleSurfaceResize);
    window.removeEventListener("orientationchange", this.handleSurfaceResize);
    window.visualViewport?.removeEventListener("resize", this.handleSurfaceResize);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) this.particles = this.particles.slice(0, 24);
  }

  setQuality(value: "low" | "medium" | "high"): void {
    if (this.quality === value) return;
    this.quality = value;
    this.resize();
  }

  toWorld(clientX: number, clientY: number): Vec2 {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - bounds.left) / bounds.width) * WORLD_WIDTH,
      y: ((clientY - bounds.top) / bounds.height) * WORLD_HEIGHT,
    };
  }

  handleEvents(events: readonly GameEvent[], snapshot: GameSnapshot): void {
    for (const event of events) {
      const vehicle = snapshot.vehicle.position;
      if (event.type === "path-added") {
        this.burst(event.endpoint, "#fff7d1", 2, 2);
      } else if (event.type === "collectible") {
        this.burst(vehicle, event.kind === "coin" ? "#f4c65e" : "#75d3ef", 14, 5);
      } else if (event.type === "collision") {
        this.burst(vehicle, "#f47d67", 20, 8);
      } else if (event.type === "shield-blocked" || event.type === "shield-activated") {
        this.burst(vehicle, "#8ef1e6", 18, 7);
      } else if (event.type === "upgrade") {
        this.burst(vehicle, "#a9e47c", 24, 8);
      } else if (event.type === "won") {
        this.burst(vehicle, "#ffd666", 42, 10);
      }
    }
  }

  render(snapshot: GameSnapshot): void {
    this.requestArtForLevel(snapshot.level.id);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;
    this.updateParticles(dt);

    const ctx = this.context;
    // Android WebView/WeChat can preserve the backing store while resetting the
    // 2D context state. Rebuild the transform every frame so the world never
    // collapses into the backing store's top-left corner after a surface restore.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyWorldTransform();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.quality === "low" ? "low" : "high";
    ctx.save();
    this.drawSky(snapshot);
    this.drawAmbientDepth(snapshot);
    this.drawFinish(snapshot);
    this.drawRoad(snapshot);
    this.drawCollectibles(snapshot);
    this.drawObstacles(snapshot);
    this.drawVehicle(snapshot);
    this.drawParticles();
    this.drawForegroundWeather(snapshot);
    this.drawEdgeVignette(snapshot);
    ctx.restore();
  }

  private applyWorldTransform(): void {
    this.context.setTransform(
      this.canvas.width / WORLD_WIDTH,
      0,
      0,
      this.canvas.height / WORLD_HEIGHT,
      0,
      0,
    );
  }

  private requestArtForLevel(levelId: GameSnapshot["level"]["id"]): void {
    if (this.requestedArtLevels.has(levelId)) return;
    this.requestedArtLevels.add(levelId);

    // Load what can affect the current frame first. The other four large
    // backgrounds wait until this playable set has settled, avoiding a flash
    // of placeholder vehicle art on real GitHub Pages connections.
    void artAssets.preload({
      levels: [levelId],
      common: ["postalVan", "storm", "rock", "rotor", "coin", "stamp", "destination"],
    }).then(() => {
      if (this.artSweepStarted) return;
      this.artSweepStarted = true;
      const remainingLevels = ([1, 2, 3, 4, 5] as const).filter(
        (candidate) => candidate !== levelId,
      );
      void artAssets.preload({ levels: remainingLevels, common: [] });
    });
  }

  private drawSky(snapshot: GameSnapshot): void {
    const ctx = this.context;
    const theme = getLevelArtTheme(snapshot.level.id);
    const background = artAssets.getBackground(snapshot.level.id);

    if (background?.complete && background.naturalWidth > 0) {
      ctx.drawImage(background, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // A very light moving wash keeps the painted world alive without making
      // the gameplay route or collision silhouettes harder to read.
      const light = ctx.createRadialGradient(
        74 + Math.sin(snapshot.elapsedSeconds * 0.16) * 18,
        92,
        0,
        74,
        92,
        290,
      );
      light.addColorStop(0, `${theme.ambientTint}24`);
      light.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    gradient.addColorStop(0, theme.sky[0]);
    gradient.addColorStop(0.55, theme.sky[1]);
    gradient.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let index = 0; index < 9; index += 1) {
      const drift = this.reducedMotion
        ? 0
        : snapshot.elapsedSeconds * (2 + (index % 3)) * theme.weather.cloudSpeed;
      const x = ((index * 97 + drift) % 520) - 70;
      const y = 88 + ((index * 139) % 690);
      const scale = 0.65 + (index % 4) * 0.13;
      this.drawCloud(
        x,
        y,
        scale,
        index % 2 === 0 ? 0.3 : 0.19,
        theme.cloudTint,
      );
    }

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    for (let index = 0; index < 24; index += 1) {
      const x = (index * 71 + 17) % WORLD_WIDTH;
      const y = (index * 113 + 31) % WORLD_HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, index % 5 === 0 ? 2 : 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCloud(
    x: number,
    y: number,
    scale: number,
    alpha: number,
    color = "#ffffff",
  ): void {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 42 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 28 * scale, y - 8 * scale, 30 * scale, 23 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 24 * scale, y - 5 * scale, 27 * scale, 21 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFinish(snapshot: GameSnapshot): void {
    const { x, y } = snapshot.level.finish.position;
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    const pulse = this.reducedMotion ? 0 : Math.sin(snapshot.elapsedSeconds * 2.6) * 3;
    const theme = getLevelArtTheme(snapshot.level.id);

    ctx.fillStyle = "rgba(25,47,64,.22)";
    ctx.beginPath();
    ctx.ellipse(0, 38, 57, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(0, 0, 18, 0, 0, 74);
    glow.addColorStop(0, `${theme.landmarkGlow}62`);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.fill();

    const painted = this.drawSprite("destination", 0, 0, 114 + pulse, 114 + pulse);
    if (!painted) {
      ctx.fillStyle = "#76b77c";
      ctx.beginPath();
      ctx.ellipse(0, 8, 57, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7e6";
      ctx.fillRect(-24, -25, 48, 38);
      ctx.fillStyle = "#f47d67";
      ctx.beginPath();
      ctx.moveTo(-32, -24);
      ctx.lineTo(0, -48);
      ctx.lineTo(32, -24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#294b58";
      ctx.fillRect(-7, -9, 14, 22);
    }

    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.arc(0, 4, 49 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawRoad(snapshot: GameSnapshot): void {
    const path = snapshot.path;
    if (path.length < 2) return;
    const ctx = this.context;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = snapshot.lighthouse.activeRemaining > 0 ? 22 : 14;
    ctx.shadowColor = snapshot.lighthouse.activeRemaining > 0 ? "#7ff4e7" : "#ffffff";
    ctx.strokeStyle = snapshot.lighthouse.activeRemaining > 0 ? "rgba(199,255,244,.76)" : "rgba(255,255,255,.45)";
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(path[0]?.x ?? 0, path[0]?.y ?? 0);
    for (const point of path.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fffdf2";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.strokeStyle = "#75d3ef";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 12]);
    ctx.stroke();
    ctx.restore();
  }

  private drawCollectibles(snapshot: GameSnapshot): void {
    const ctx = this.context;
    for (const item of snapshot.collectibles) {
      if (item.collected) continue;
      const bob = this.reducedMotion ? 0 : Math.sin(snapshot.elapsedSeconds * 3 + item.position.x) * 4;
      ctx.save();
      ctx.translate(item.position.x, item.position.y + bob);
      this.drawGroundShadow(0, item.radius + 8, item.radius * 0.9, item.radius * 0.28, 0.2);
      const spriteSize = item.kind === "coin" ? item.radius * 3 : item.radius * 2.9;
      const rotation = item.kind === "coin"
        ? (this.reducedMotion ? 0 : Math.sin(snapshot.elapsedSeconds * 2.4 + item.position.y) * 0.08)
        : -0.12;
      const painted = this.drawSprite(
        item.kind === "coin" ? "coin" : "stamp",
        0,
        0,
        spriteSize,
        spriteSize,
        rotation,
      );

      if (!painted && item.kind === "coin") {
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffd65f";
        ctx.fillStyle = "#f4c65e";
        ctx.strokeStyle = "#b97827";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff2a6";
        ctx.font = "bold 15px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦", 0, 1);
      } else if (!painted) {
        ctx.rotate(-0.12);
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#6fe1ff";
        ctx.fillStyle = "#fff7e6";
        ctx.strokeStyle = "#287aa0";
        ctx.lineWidth = 3;
        ctx.fillRect(-15, -18, 30, 36);
        ctx.strokeRect(-15, -18, 30, 36);
        ctx.fillStyle = "#43a9a2";
        ctx.fillRect(-8, -10, 16, 20);
      }
      ctx.restore();
    }
  }

  private drawObstacles(snapshot: GameSnapshot): void {
    for (const obstacle of snapshot.obstacles) {
      const { x, y } = obstacle.runtimePosition;
      if (obstacle.kind === "storm") this.drawStorm(x, y, obstacle.radius, snapshot.elapsedSeconds);
      if (obstacle.kind === "rock") this.drawRock(x, y, obstacle.radius);
      if (obstacle.kind === "windmill") this.drawWindmill(x, y, obstacle.radius, snapshot.elapsedSeconds);
    }
  }

  private drawStorm(x: number, y: number, radius: number, time: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    const bob = this.reducedMotion ? 0 : Math.sin(time * 2.2 + x) * 2.5;
    this.drawGroundShadow(0, radius * 0.72, radius * 0.92, radius * 0.28, 0.24);
    if (this.drawSprite("storm", 0, bob, radius * 2.7, radius * 2.7)) {
      const spark = this.reducedMotion ? 0.65 : 0.52 + Math.sin(time * 8 + x) * 0.24;
      ctx.globalAlpha = Math.max(0.25, spark);
      ctx.strokeStyle = "#f4ddff";
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#b69cff";
      ctx.beginPath();
      ctx.moveTo(2, radius * 0.14 + bob);
      ctx.lineTo(-6, radius * 0.42 + bob);
      ctx.lineTo(3, radius * 0.38 + bob);
      ctx.lineTo(-2, radius * 0.68 + bob);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#536178";
    for (const [dx, dy, scale] of [[-0.45, 0.05, 0.62], [0, -0.18, 0.78], [0.42, 0.06, 0.58]] as const) {
      ctx.beginPath();
      ctx.arc(dx * radius, dy * radius, scale * radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#d9c4ff";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#b69cff";
    const flash = this.reducedMotion ? 0 : Math.sin(time * 6) * 3;
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.3);
    ctx.lineTo(-9, radius * 0.72);
    ctx.lineTo(3 + flash, radius * 0.64);
    ctx.lineTo(-2, radius * 1.08);
    ctx.stroke();
    ctx.restore();
  }

  private drawRock(x: number, y: number, radius: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    this.drawGroundShadow(0, radius * 0.72, radius * 0.95, radius * 0.3, 0.24);
    if (this.drawSprite("rock", 0, 0, radius * 2.65, radius * 2.65)) {
      ctx.restore();
      return;
    }

    ctx.fillStyle = "rgba(41,75,88,.2)";
    ctx.beginPath();
    ctx.ellipse(0, radius * 0.65, radius * 0.88, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6c7d72";
    ctx.beginPath();
    ctx.moveTo(-radius, -radius * 0.1);
    ctx.lineTo(-radius * 0.5, radius * 0.72);
    ctx.lineTo(radius * 0.35, radius * 0.9);
    ctx.lineTo(radius, -radius * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#76b77c";
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.15, radius, radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawWindmill(x: number, y: number, radius: number, time: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    this.drawGroundShadow(0, radius * 0.9, radius * 0.9, radius * 0.28, 0.22);

    const hasRotor = artAssets.getCommon("rotor") !== null;
    if (hasRotor) {
      ctx.fillStyle = "rgba(42,56,67,.28)";
      ctx.beginPath();
      ctx.moveTo(-radius * 0.25, radius * 0.78);
      ctx.lineTo(-radius * 0.12, radius * 0.08);
      ctx.lineTo(radius * 0.12, radius * 0.08);
      ctx.lineTo(radius * 0.3, radius * 0.78);
      ctx.closePath();
      ctx.fill();
      this.drawSprite("rock", 0, radius * 0.72, radius * 1.35, radius * 1.35);
      this.drawSprite(
        "rotor",
        0,
        0,
        radius * 2.85,
        radius * 2.85,
        this.reducedMotion ? 0.35 : time * 2.4,
      );
      ctx.restore();
      return;
    }

    ctx.fillStyle = "#fff7e6";
    ctx.strokeStyle = "#294b58";
    ctx.lineWidth = 3;
    ctx.fillRect(-11, -5, 22, radius * 0.95);
    ctx.strokeRect(-11, -5, 22, radius * 0.95);
    ctx.rotate(this.reducedMotion ? 0.35 : time * 2.4);
    for (let index = 0; index < 4; index += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#f4c65e";
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.lineTo(radius, -12);
      ctx.lineTo(radius * 0.82, 8);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#f47d67";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawVehicle(snapshot: GameSnapshot): void {
    const vehicle = snapshot.vehicle.position;
    const target = snapshot.path[snapshot.nextPathPointIndex];
    const angle = target ? Math.atan2(target.y - vehicle.y, target.x - vehicle.x) + Math.PI / 2 : 0;
    const ctx = this.context;
    ctx.save();
    ctx.translate(vehicle.x, vehicle.y);
    this.drawGroundShadow(0, 24, 24, 8, 0.28);
    if (snapshot.lighthouse.activeRemaining > 0) {
      ctx.strokeStyle = "rgba(159,255,235,.85)";
      ctx.lineWidth = 5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#8ef1e6";
      ctx.beginPath();
      ctx.arc(0, 0, 28 + Math.sin(snapshot.elapsedSeconds * 7) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The painted van asset is authored facing the viewer; flip its forward
    // axis so its bonnet points toward the next cloud-road waypoint.
    ctx.rotate(angle + Math.PI);
    const blink = snapshot.vehicle.collisionInvulnerabilityRemaining > 0 && Math.floor(snapshot.elapsedSeconds * 12) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;

    if (this.drawSprite("postalVan", 0, 0, 66, 66)) {
      ctx.restore();
      return;
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(22,60,90,.38)";
    ctx.fillStyle = "#24567b";
    ctx.strokeStyle = "#f4c65e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-18, -24, 36, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff7e6";
    ctx.fillRect(-11, -10, 22, 18);
    ctx.strokeStyle = "#294b58";
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -10, 22, 18);
    ctx.beginPath();
    ctx.moveTo(-11, -10);
    ctx.lineTo(0, -1);
    ctx.lineTo(11, -10);
    ctx.stroke();
    ctx.fillStyle = "#294b58";
    ctx.beginPath();
    ctx.arc(-15, 17, 6, 0, Math.PI * 2);
    ctx.arc(15, 17, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAmbientDepth(snapshot: GameSnapshot): void {
    const ctx = this.context;
    const theme = getLevelArtTheme(snapshot.level.id);
    const time = this.reducedMotion ? 0 : snapshot.elapsedSeconds;
    const detailCount = this.quality === "low" ? 7 : this.quality === "medium" ? 11 : 16;

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = theme.weather.particleColor;
    ctx.fillStyle = theme.weather.particleColor;

    if (theme.weather.kind === "morning-breeze") {
      for (let index = 0; index < detailCount; index += 1) {
        const x = (index * 91 + time * (5 + (index % 3))) % (WORLD_WIDTH + 40) - 20;
        const y = 122 + ((index * 131) % 650);
        ctx.globalAlpha = 0.12 + (index % 3) * 0.045;
        ctx.beginPath();
        ctx.arc(x, y, index % 4 === 0 ? 2.4 : 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.weather.kind === "crosswind") {
      ctx.lineWidth = 2;
      for (let index = 0; index < detailCount; index += 1) {
        const x = (index * 67 + time * 34) % (WORLD_WIDTH + 110) - 55;
        const y = 132 + ((index * 83) % 610);
        ctx.globalAlpha = 0.08 + (index % 3) * 0.035;
        ctx.beginPath();
        ctx.moveTo(x - 25, y);
        ctx.bezierCurveTo(x - 8, y - 8, x + 10, y + 8, x + 31, y - 2);
        ctx.stroke();
      }
    } else if (theme.weather.kind === "clockwork-gust") {
      ctx.lineWidth = 2;
      for (let index = 0; index < Math.ceil(detailCount * 0.6); index += 1) {
        const side = index % 2 === 0 ? 1 : -1;
        const x = side > 0 ? 350 : 40;
        const y = 138 + ((index * 127) % 610);
        const radius = 9 + (index % 3) * 4;
        ctx.globalAlpha = 0.11;
        ctx.beginPath();
        ctx.arc(x, y, radius, time * 0.3 + index, time * 0.3 + index + Math.PI * 1.45);
        ctx.stroke();
        for (let tooth = 0; tooth < 6; tooth += 1) {
          const angle = (Math.PI * 2 * tooth) / 6 + time * 0.18;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(angle) * (radius - 2), y + Math.sin(angle) * (radius - 2));
          ctx.lineTo(x + Math.cos(angle) * (radius + 3), y + Math.sin(angle) * (radius + 3));
          ctx.stroke();
        }
      }
    } else if (theme.weather.kind === "moonlit-squall") {
      for (let index = 0; index < detailCount; index += 1) {
        const x = (index * 101 + time * (10 + (index % 2) * 4)) % (WORLD_WIDTH + 30) - 15;
        const y = 125 + ((index * 89) % 655);
        const size = 2 + (index % 3);
        ctx.globalAlpha = 0.12 + (index % 4) * 0.035;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 0.2 + index);
        ctx.fillRect(-size / 2, -size, size, size * 2);
        ctx.restore();
      }
    } else {
      ctx.lineWidth = 3;
      for (let index = 0; index < Math.ceil(detailCount * 0.75); index += 1) {
        const x = (index * 79 + time * 46) % (WORLD_WIDTH + 130) - 65;
        const y = 120 + ((index * 103) % 640);
        ctx.globalAlpha = 0.075;
        ctx.beginPath();
        ctx.moveTo(x - 38, y);
        ctx.bezierCurveTo(x - 9, y - 13, x + 14, y + 12, x + 43, y - 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawForegroundWeather(snapshot: GameSnapshot): void {
    const theme = getLevelArtTheme(snapshot.level.id);
    const weather = theme.weather;
    const ctx = this.context;
    const time = this.reducedMotion ? 0 : snapshot.elapsedSeconds;
    const maximumStreaks = this.quality === "low" ? 14 : this.quality === "medium" ? 22 : 32;
    const streakCount = Math.round(maximumStreaks * weather.rain);

    if (streakCount > 0) {
      ctx.save();
      ctx.strokeStyle = weather.kind === "tempest" ? "rgba(207,235,255,.36)" : "rgba(241,249,255,.26)";
      ctx.lineWidth = weather.kind === "tempest" ? 1.35 : 1;
      ctx.lineCap = "round";
      const drift = time * (95 + weather.windX * 105);
      const fall = time * (165 + weather.rain * 120);
      for (let index = 0; index < streakCount; index += 1) {
        const x = (index * 73 + drift) % (WORLD_WIDTH + 70) - 35;
        const y = (index * 101 + fall) % (WORLD_HEIGHT + 100) - 50;
        const length = 9 + (index % 5) * 2.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - weather.windX * length * 0.7, y + length);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (!this.reducedMotion && weather.lightning > 0) {
      const lightningWave = Math.sin(time * 2.37 + snapshot.level.id * 1.7)
        + Math.sin(time * 0.71 + 4.2);
      if (lightningWave > 1.72) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.11, (lightningWave - 1.72) * weather.lightning * 0.38);
        ctx.fillStyle = "#f2ecff";
        ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        ctx.restore();
      }
    }
  }

  private drawSprite(
    key: CommonSpriteKey,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation = 0,
  ): boolean {
    const image = artAssets.getCommon(key);
    if (!image?.complete || image.naturalWidth <= 0) return false;

    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    if (rotation !== 0) ctx.rotate(rotation);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  private drawGroundShadow(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    alpha: number,
  ): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = `rgba(20,43,58,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEdgeVignette(snapshot: GameSnapshot): void {
    const ctx = this.context;
    const theme = getLevelArtTheme(snapshot.level.id);
    const edge = ctx.createLinearGradient(0, 0, WORLD_WIDTH, 0);
    edge.addColorStop(0, theme.vignette);
    edge.addColorStop(0.08, "rgba(28,68,95,0)");
    edge.addColorStop(0.92, "rgba(28,68,95,0)");
    edge.addColorStop(1, theme.vignette);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (snapshot.status === "running" && snapshot.path.length < 2) {
      // The lower-left strip is outside every obstacle route in all five
      // levels. It also clears the van and the bottom-right lighthouse button.
      const hintWidth = 210;
      const hintHeight = 36;
      const hintX = 12;
      const hintY = 790;
      ctx.fillStyle = "rgba(20,58,78,.72)";
      ctx.strokeStyle = "rgba(255,247,209,.72)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(hintX, hintY, hintWidth, hintHeight, 19);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffdf2";
      ctx.font = "700 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("按住，从邮车前方向上画路", hintX + hintWidth / 2, hintY + hintHeight / 2 + 1);
    }
  }

  private burst(origin: Vec2, color: string, count: number, speed: number): void {
    const cappedCount = this.reducedMotion ? Math.min(5, count) : count;
    for (let index = 0; index < cappedCount && this.particles.length < 150; index += 1) {
      const angle = (Math.PI * 2 * index) / cappedCount + Math.random() * 0.4;
      const velocity = speed * (0.55 + Math.random() * 0.75) * 18;
      const life = 0.45 + Math.random() * 0.45;
      this.particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 36 * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private drawParticles(): void {
    const ctx = this.context;
    for (const particle of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
