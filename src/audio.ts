export type SoundEffect =
  | "tap"
  | "draw"
  | "perfect"
  | "coin"
  | "upgrade"
  | "success"
  | "crash"
  | "shield";

export interface GameAudioOptions {
  initialMuted?: boolean;
  contextFactory?: () => AudioContext | null;
  visibilityDocument?: Document | null;
}

interface ToneStep {
  frequency: number;
  duration: number;
  volume: number;
  offset?: number;
  type?: OscillatorType;
}

const EFFECTS: Record<SoundEffect, readonly ToneStep[]> = {
  tap: [{ frequency: 520, duration: 0.045, volume: 0.035 }],
  draw: [{ frequency: 260, duration: 0.05, volume: 0.018, type: "triangle" }],
  perfect: [
    { frequency: 659, duration: 0.09, volume: 0.055 },
    { frequency: 988, duration: 0.16, volume: 0.05, offset: 0.075 },
  ],
  coin: [
    { frequency: 784, duration: 0.07, volume: 0.045 },
    { frequency: 1175, duration: 0.12, volume: 0.04, offset: 0.055 },
  ],
  upgrade: [
    { frequency: 392, duration: 0.11, volume: 0.045 },
    { frequency: 523, duration: 0.11, volume: 0.045, offset: 0.09 },
    { frequency: 784, duration: 0.2, volume: 0.05, offset: 0.18 },
  ],
  success: [
    { frequency: 523, duration: 0.14, volume: 0.05 },
    { frequency: 659, duration: 0.14, volume: 0.05, offset: 0.11 },
    { frequency: 784, duration: 0.3, volume: 0.055, offset: 0.22 },
  ],
  crash: [
    { frequency: 130, duration: 0.16, volume: 0.06, type: "sawtooth" },
    { frequency: 82, duration: 0.22, volume: 0.04, offset: 0.045, type: "square" },
  ],
  shield: [
    { frequency: 330, duration: 0.16, volume: 0.04, type: "triangle" },
    { frequency: 660, duration: 0.23, volume: 0.04, offset: 0.07, type: "sine" },
  ],
};

const MUSIC_NOTES = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66] as const;

function defaultContextFactory(): AudioContext | null {
  const audioGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Context = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  return Context ? new Context() : null;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private muted: boolean;
  private musicWanted = false;
  private musicTimer: number | null = null;
  private musicIndex = 0;
  private disposed = false;
  private readonly contextFactory: () => AudioContext | null;
  private readonly visibilityDocument: Document | null;
  private readonly visibilityHandler = (): void => {
    if (!this.context) return;
    if (this.visibilityDocument?.hidden) {
      this.clearMusicTimer();
      void this.context.suspend();
      return;
    }
    if (!this.muted) {
      void this.context.resume().then(() => this.ensureMusicLoop());
    }
  };
  private readonly firstInteractionHandler = (): void => {
    void this.unlock();
  };

  constructor(options: GameAudioOptions = {}) {
    this.muted = options.initialMuted ?? false;
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.visibilityDocument =
      options.visibilityDocument ?? (typeof document === "undefined" ? null : document);
    this.visibilityDocument?.addEventListener("visibilitychange", this.visibilityHandler);
    this.visibilityDocument?.addEventListener("pointerdown", this.firstInteractionHandler, {
      capture: true,
      passive: true,
    });
    this.visibilityDocument?.addEventListener("keydown", this.firstInteractionHandler, {
      capture: true,
    });
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get isUnlocked(): boolean {
    return this.context !== null && this.context.state !== "closed";
  }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.context) {
      try {
        this.context = this.contextFactory();
      } catch {
        this.context = null;
      }
    }
    if (!this.context) return false;
    if (!this.muted && this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return false;
      }
    }
    this.ensureMusicLoop();
    this.removeFirstInteractionListeners();
    return true;
  }

  play(effect: SoundEffect): void {
    if (this.muted || this.disposed) return;
    if (!this.context) {
      void this.unlock().then((unlocked) => {
        if (unlocked) this.play(effect);
      });
      return;
    }
    for (const step of EFFECTS[effect]) this.scheduleTone(step);
  }

  playSfx(effect: SoundEffect): void {
    this.play(effect);
  }

  startMusic(): void {
    this.musicWanted = true;
    this.ensureMusicLoop();
  }

  stopMusic(): void {
    this.musicWanted = false;
    this.clearMusicTimer();
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      this.clearMusicTimer();
      if (this.context?.state === "running") void this.context.suspend();
    } else if (this.context) {
      void this.context.resume().then(() => this.ensureMusicLoop());
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  dispose(): void {
    this.disposed = true;
    this.clearMusicTimer();
    this.removeFirstInteractionListeners();
    this.visibilityDocument?.removeEventListener("visibilitychange", this.visibilityHandler);
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
  }

  private ensureMusicLoop(): void {
    if (
      !this.musicWanted ||
      this.muted ||
      this.disposed ||
      !this.context ||
      this.context.state !== "running" ||
      this.visibilityDocument?.hidden ||
      this.musicTimer !== null
    ) {
      return;
    }

    const playNext = (): void => {
      const frequency = MUSIC_NOTES[this.musicIndex % MUSIC_NOTES.length];
      if (frequency !== undefined) {
        this.scheduleTone({
          frequency,
          duration: 0.42,
          volume: 0.014,
          type: this.musicIndex % 2 === 0 ? "sine" : "triangle",
        });
      }
      this.musicIndex += 1;
    };
    playNext();
    this.musicTimer = globalThis.setInterval(playNext, 480);
  }

  private clearMusicTimer(): void {
    if (this.musicTimer === null) return;
    globalThis.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private removeFirstInteractionListeners(): void {
    this.visibilityDocument?.removeEventListener("pointerdown", this.firstInteractionHandler, true);
    this.visibilityDocument?.removeEventListener("keydown", this.firstInteractionHandler, true);
  }

  private scheduleTone(step: ToneStep): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const start = context.currentTime + (step.offset ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(step.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + step.duration + 0.025);
  }
}

export const gameAudio = new GameAudio();
