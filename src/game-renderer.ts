import type { GameEvent, GameSnapshot, Vec2 } from "./types";

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
    ctx.save();
    this.drawSky(snapshot.elapsedSeconds);
    this.drawFinish(snapshot);
    this.drawRoad(snapshot);
    this.drawCollectibles(snapshot);
    this.drawObstacles(snapshot);
    this.drawVehicle(snapshot);
    this.drawParticles();
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

  private drawSky(time: number): void {
    const ctx = this.context;
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    gradient.addColorStop(0, "#5bbbe4");
    gradient.addColorStop(0.55, "#8ed9e8");
    gradient.addColorStop(1, "#e9fbff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let index = 0; index < 9; index += 1) {
      const drift = this.reducedMotion ? 0 : time * (2 + (index % 3));
      const x = ((index * 97 + drift) % 520) - 70;
      const y = 88 + ((index * 139) % 690);
      const scale = 0.65 + (index % 4) * 0.13;
      this.drawCloud(x, y, scale, index % 2 === 0 ? 0.3 : 0.19);
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

  private drawCloud(x: number, y: number, scale: number, alpha: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
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
    ctx.fillStyle = "rgba(41,75,88,.18)";
    ctx.beginPath();
    ctx.ellipse(0, 26, 62, 20, 0, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.arc(0, 4, 46 + Math.sin(snapshot.elapsedSeconds * 3) * 3, 0, Math.PI * 2);
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
      ctx.shadowBlur = 12;
      ctx.shadowColor = item.kind === "coin" ? "#ffd65f" : "#6fe1ff";
      if (item.kind === "coin") {
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
      } else {
        ctx.rotate(-0.12);
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
    ctx.rotate(angle);
    if (snapshot.lighthouse.activeRemaining > 0) {
      ctx.strokeStyle = "rgba(159,255,235,.85)";
      ctx.lineWidth = 5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#8ef1e6";
      ctx.beginPath();
      ctx.arc(0, 0, 28 + Math.sin(snapshot.elapsedSeconds * 7) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    const blink = snapshot.vehicle.collisionInvulnerabilityRemaining > 0 && Math.floor(snapshot.elapsedSeconds * 12) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
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

  private drawEdgeVignette(snapshot: GameSnapshot): void {
    const ctx = this.context;
    const edge = ctx.createLinearGradient(0, 0, WORLD_WIDTH, 0);
    edge.addColorStop(0, "rgba(28,68,95,.18)");
    edge.addColorStop(0.08, "rgba(28,68,95,0)");
    edge.addColorStop(0.92, "rgba(28,68,95,0)");
    edge.addColorStop(1, "rgba(28,68,95,.18)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (snapshot.status === "running" && snapshot.path.length < 2) {
      ctx.fillStyle = "rgba(23,61,98,.78)";
      ctx.font = "700 17px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("按住并在邮车前方画出云路", WORLD_WIDTH / 2, 682);
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
