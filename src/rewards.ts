import {
  type GameSaveStore,
  gameSaveStore,
  type RewardLedgerEntry,
} from "./storage";

export type RewardStatus = "unavailable" | "cancelled" | "granted";

export type RewardGrant =
  | { kind: "continue" }
  | { kind: "shield"; amount?: number }
  | { kind: "character-trial"; characterId: string; runs: number }
  | { kind: "character-unlock"; characterId: string }
  | { kind: "bonus-coins"; amount: number }
  | { kind: "reroll" };

export interface RewardRequest {
  ticketId: string;
  grant: RewardGrant;
}

export interface RewardResult {
  status: RewardStatus;
  ticketId: string;
  providerId: string;
  grant: RewardGrant;
  newlyGranted: boolean;
  reason?: "no-tickets" | "user-cancelled" | "ticket-conflict" | "provider-unavailable";
}

export interface RewardProvider {
  readonly id: string;
  isAvailable(request: RewardRequest): boolean | Promise<boolean>;
  request(request: RewardRequest): Promise<RewardResult>;
}

export type RewardConfirmation = (request: RewardRequest) => boolean | Promise<boolean>;

function stableGrantSignature(grant: RewardGrant): string {
  switch (grant.kind) {
    case "continue":
    case "reroll":
      return grant.kind;
    case "shield":
      return `${grant.kind}:${grant.amount ?? 1}`;
    case "character-trial":
      return `${grant.kind}:${grant.characterId}:${grant.runs}`;
    case "character-unlock":
      return `${grant.kind}:${grant.characterId}`;
    case "bonus-coins":
      return `${grant.kind}:${grant.amount}`;
  }
}

function result(
  request: RewardRequest,
  providerId: string,
  status: RewardStatus,
  newlyGranted: boolean,
  reason?: RewardResult["reason"],
): RewardResult {
  return {
    status,
    ticketId: request.ticketId,
    providerId,
    grant: request.grant,
    newlyGranted,
    ...(reason ? { reason } : {}),
  };
}

export class LocalAidTicketProvider implements RewardProvider {
  readonly id = "local-aid-ticket";

  constructor(
    private readonly store: GameSaveStore = gameSaveStore,
    private readonly confirm: RewardConfirmation = () => true,
  ) {}

  isAvailable(request: RewardRequest): boolean {
    const save = this.store.load();
    const previous = save.rewardLedger[request.ticketId];
    if (previous) return true;
    return save.aidTickets > 0;
  }

  async request(request: RewardRequest): Promise<RewardResult> {
    const signature = stableGrantSignature(request.grant);
    const previous = this.store.load().rewardLedger[request.ticketId];
    if (previous) {
      return previous.grantSignature === signature
        ? result(request, this.id, "granted", false)
        : result(request, this.id, "unavailable", false, "ticket-conflict");
    }

    if (this.store.load().aidTickets < 1) {
      return result(request, this.id, "unavailable", false, "no-tickets");
    }
    if (!(await this.confirm(request))) {
      return result(request, this.id, "cancelled", false, "user-cancelled");
    }

    const mutation = {
      outcome: "empty" as "granted" | "duplicate" | "conflict" | "empty",
    };
    this.store.update((save) => {
      const existing = save.rewardLedger[request.ticketId];
      if (existing) {
        mutation.outcome = existing.grantSignature === signature ? "duplicate" : "conflict";
        return;
      }
      if (save.aidTickets < 1) return;
      save.aidTickets -= 1;
      const ledgerEntry: RewardLedgerEntry = {
        providerId: this.id,
        grantKind: request.grant.kind,
        grantSignature: signature,
        grantedAt: Date.now(),
      };
      save.rewardLedger[request.ticketId] = ledgerEntry;
      mutation.outcome = "granted";
    });

    if (mutation.outcome === "granted") return result(request, this.id, "granted", true);
    if (mutation.outcome === "duplicate") return result(request, this.id, "granted", false);
    if (mutation.outcome === "conflict") {
      return result(request, this.id, "unavailable", false, "ticket-conflict");
    }
    return result(request, this.id, "unavailable", false, "no-tickets");
  }
}

export class UnavailableRewardProvider implements RewardProvider {
  constructor(readonly id = "unavailable") {}

  isAvailable(): boolean {
    return false;
  }

  async request(request: RewardRequest): Promise<RewardResult> {
    return result(request, this.id, "unavailable", false, "provider-unavailable");
  }
}

export class RewardService {
  constructor(private readonly providers: readonly RewardProvider[]) {}

  async claim(request: RewardRequest, providerId?: string): Promise<RewardResult> {
    const candidates = providerId
      ? this.providers.filter((provider) => provider.id === providerId)
      : this.providers;

    let lastUnavailable: RewardResult | null = null;
    for (const provider of candidates) {
      if (!(await provider.isAvailable(request))) continue;
      const claimed = await provider.request(request);
      if (claimed.status !== "unavailable") return claimed;
      lastUnavailable = claimed;
    }

    if (lastUnavailable) return lastUnavailable;
    return result(
      request,
      providerId ?? candidates[0]?.id ?? "none",
      "unavailable",
      false,
      "provider-unavailable",
    );
  }
}

export function createRewardTicketId(prefix = "reward"): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return `${prefix}:${cryptoApi.randomUUID()}`;
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export const localAidTicketProvider = new LocalAidTicketProvider();
export const rewardService = new RewardService([localAidTicketProvider]);
