import { describe, expect, it } from "vitest";
import { GameAudio } from "../src/audio";
import {
  GameSaveStore,
  SAVE_STORAGE_KEY,
  type StorageLike,
} from "../src/storage";
import {
  LocalAidTicketProvider,
  RewardService,
  type RewardRequest,
} from "../src/rewards";

class FakeStorage implements StorageLike {
  readonly values = new Map<string, string>();

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

describe("GameSaveStore", () => {
  it("falls back safely and preserves a corrupt payload", () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_STORAGE_KEY, "{not-json");
    const save = new GameSaveStore(storage).load();

    expect(save.level).toBe(1);
    expect(save.aidTickets).toBe(3);
    expect(storage.getItem(`${SAVE_STORAGE_KEY}.corrupt`)).toBe("{not-json");
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it("migrates legacy names and fills newly introduced defaults", () => {
    const storage = new FakeStorage();
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        gold: 450,
        tickets: 7,
        playerLevel: 4,
        characters: ["rookie", "storm"],
        selectedCourier: "storm",
        town: { home: 2, shop: 3, postOffice: 4 },
        progress: { "level-1": { stars: 2, score: 900 } },
      }),
    );

    const save = new GameSaveStore(storage).load();
    expect(save).toMatchObject({
      version: 2,
      coins: 450,
      aidTickets: 7,
      level: 4,
      selectedCharacter: "storm",
      vehicleLevel: 1,
      buildings: { home: 2, convenienceStore: 3, dispatchCenter: 4 },
      settings: { muted: false, reducedMotion: false },
    });
    expect(save.levelRecords["level-1"]).toEqual({
      stars: 2,
      bestScore: 900,
      completed: true,
    });
  });

  it("fills and persists the default stamp balance during migration", () => {
    const storage = new FakeStorage();
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        gold: 80,
        tickets: 2,
      }),
    );

    const save = new GameSaveStore(storage).load();
    const persisted = JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null") as {
      stamps?: number;
    };

    expect(save.stamps).toBe(0);
    expect(persisted.stamps).toBe(0);
  });

  it("normalizes values and notifies subscribers on updates", () => {
    const store = new GameSaveStore(new FakeStorage());
    let observedCoins = 0;
    store.subscribe((save) => {
      observedCoins = save.coins;
    });
    const save = store.update((draft) => {
      draft.coins = 321;
      draft.aidTickets = -8;
    });

    expect(save.coins).toBe(321);
    expect(save.aidTickets).toBe(0);
    expect(observedCoins).toBe(321);
  });
});

describe("reward providers", () => {
  const shieldRequest: RewardRequest = {
    ticketId: "run-4:shield",
    grant: { kind: "shield", amount: 1 },
  };

  it("consumes one aid ticket and makes a granted ticket idempotent", async () => {
    const store = new GameSaveStore(new FakeStorage());
    store.update((save) => {
      save.aidTickets = 1;
    });
    const service = new RewardService([new LocalAidTicketProvider(store)]);

    const first = await service.claim(shieldRequest);
    const replay = await service.claim(shieldRequest);

    expect(first).toMatchObject({ status: "granted", newlyGranted: true });
    expect(replay).toMatchObject({ status: "granted", newlyGranted: false });
    expect(store.load().aidTickets).toBe(0);
  });

  it("grants a stable character unlock ticket only once across concurrent claims", async () => {
    const store = new GameSaveStore(new FakeStorage());
    store.update((save) => {
      save.aidTickets = 2;
    });
    const service = new RewardService([new LocalAidTicketProvider(store)]);
    const request: RewardRequest = {
      ticketId: "character:storm:permanent-unlock",
      grant: { kind: "character-unlock", characterId: "storm" },
    };

    const [first, concurrentReplay] = await Promise.all([
      service.claim(request),
      service.claim(request),
    ]);
    const laterReplay = await service.claim(request);

    expect([first.newlyGranted, concurrentReplay.newlyGranted].sort()).toEqual([
      false,
      true,
    ]);
    expect(first.status).toBe("granted");
    expect(concurrentReplay.status).toBe("granted");
    expect(laterReplay).toMatchObject({ status: "granted", newlyGranted: false });
    expect(store.load().aidTickets).toBe(1);
  });

  it("reports cancelled without consuming a ticket", async () => {
    const store = new GameSaveStore(new FakeStorage());
    const provider = new LocalAidTicketProvider(store, () => false);

    const result = await provider.request(shieldRequest);
    expect(result.status).toBe("cancelled");
    expect(store.load().aidTickets).toBe(3);
  });

  it("reports unavailable for an empty wallet and rejects ticket reuse conflicts", async () => {
    const store = new GameSaveStore(new FakeStorage());
    store.update((save) => {
      save.aidTickets = 1;
    });
    const provider = new LocalAidTicketProvider(store);
    await provider.request(shieldRequest);

    const service = new RewardService([provider]);
    const conflict = await service.claim({
      ticketId: shieldRequest.ticketId,
      grant: { kind: "continue" },
    });
    const empty = await provider.request({
      ticketId: "run-5:continue",
      grant: { kind: "continue" },
    });

    expect(conflict).toMatchObject({ status: "unavailable", reason: "ticket-conflict" });
    expect(empty).toMatchObject({ status: "unavailable", reason: "no-tickets" });
  });
});

describe("GameAudio", () => {
  it("stays safe when WebAudio is unavailable", async () => {
    const audio = new GameAudio({ contextFactory: () => null, visibilityDocument: null });
    expect(await audio.unlock()).toBe(false);
    expect(() => audio.play("tap")).not.toThrow();
    audio.startMusic();
    expect(audio.toggleMuted()).toBe(true);
    audio.stopMusic();
    audio.dispose();
  });
});
