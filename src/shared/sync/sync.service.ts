import type { UserWordState } from '../entities';
import { fromCloudRecord, mergeWordStates, toCloudRecord, type CloudWordState } from './merge';

/** The slice of AppStore that sync needs. `AppStore` satisfies it structurally. */
export interface SyncStore {
  wordStates(): Record<string, UserWordState>;
  settings(): { cloudSyncEnabled: boolean };
  setWordState(state: UserWordState): void;
}

export interface SyncServiceDeps {
  store: SyncStore;
  /** Returns the current JWT, or `null` when signed out. */
  getToken: () => Promise<string | null>;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Base URL of the API, without a trailing slash. */
  apiBaseUrl: string;
  /** ISO 8601 clock. */
  now?: () => string;
  /** Quiet period after the last change before a flush. Default 5 seconds. */
  debounceMs?: number;
  /** Longest a dirty record waits before a flush. Default 30 seconds. */
  maxDelayMs?: number;
}

export interface SyncApi {
  /** Pulls cloud state and merges with local. Never throws. */
  syncOnLoad(): Promise<void>;
  /** Marks a record pending and schedules a flush. */
  markDirty(wordId: string): void;
  /** Sends all pending records to the API. Never throws. */
  flush(): Promise<void>;
}

/** The API accepts at most this many records per PUT. */
export const MAX_BATCH_SIZE = 25;
const DEFAULT_DEBOUNCE_MS = 5_000;
const DEFAULT_MAX_DELAY_MS = 30_000;

interface PutResponse {
  accepted?: string[];
  rejected?: { wordId: string; current: CloudWordState }[];
}

/**
 * Platform-agnostic sync. No Angular imports, so it also works on Capacitor and in plain tests.
 * Wire it with `new SyncService({ store: inject(AppStore), ... })` in an Angular provider.
 */
export class SyncService implements SyncApi {
  protected readonly fetchFn: typeof fetch;
  protected readonly now: () => string;
  private readonly debounceMs: number;
  private readonly maxDelayMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstDirtyAt: number | null = null;
  private inFlight: Promise<void> | null = null;
  private stopListening: (() => void) | null = null;

  constructor(protected readonly deps: SyncServiceDeps) {
    this.fetchFn = deps.fetch ?? ((...args) => globalThis.fetch(...args));
    this.now = deps.now ?? (() => new Date().toISOString());
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxDelayMs = deps.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  /** Sync runs only when the setting is on and a token exists. */
  protected async activeToken(): Promise<string | null> {
    if (!this.deps.store.settings().cloudSyncEnabled) {
      return null;
    }
    try {
      return await this.deps.getToken();
    } catch {
      return null;
    }
  }

  protected url(path: string): string {
    return `${this.deps.apiBaseUrl.replace(/\/+$/, '')}${path}`;
  }

  async syncOnLoad(): Promise<void> {
    const token = await this.activeToken();
    if (!token) {
      return;
    }
    let items: CloudWordState[];
    try {
      const response = await this.fetchFn(this.url('/progress'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { items?: CloudWordState[] };
      items = Array.isArray(body.items) ? body.items : [];
    } catch {
      // Offline or API error: local data stays as it is.
      return;
    }

    const { merged, toPush } = mergeWordStates(this.deps.store.wordStates(), items.map(fromCloudRecord));
    const current = this.deps.store.wordStates();
    for (const [id, state] of Object.entries(merged)) {
      if (current[id] !== state) {
        this.deps.store.setWordState(state);
      }
    }
    this.onMerged(toPush);
  }

  /** Marks the record pending (if it is not already) and schedules a debounced flush. */
  markDirty(wordId: string): void {
    const state = this.deps.store.wordStates()[wordId];
    if (state && state.syncStatus !== 'pending') {
      this.deps.store.setWordState({ ...state, syncStatus: 'pending' });
    }
    this.schedule();
  }

  /** Sends pending records in batches of at most 25. Never throws and never blocks the UI. */
  flush(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    this.clearTimer();
    const run = this.doFlush()
      .catch(() => undefined)
      .finally(() => {
        this.inFlight = null;
      });
    this.inFlight = run;
    return run;
  }

  /** Flushes when the device comes back online or the page is hidden. Safe to call more than once. */
  start(): void {
    if (this.stopListening) {
      return;
    }
    const g = globalThis as unknown as Partial<Window & typeof globalThis>;
    const doc = g.document;
    const onOnline = () => void this.flush();
    const onVisibility = () => {
      if (doc?.visibilityState === 'hidden') {
        void this.flush();
      }
    };
    g.addEventListener?.('online', onOnline);
    doc?.addEventListener?.('visibilitychange', onVisibility);
    this.stopListening = () => {
      g.removeEventListener?.('online', onOnline);
      doc?.removeEventListener?.('visibilitychange', onVisibility);
    };
  }

  /** Removes listeners and cancels the scheduled flush. */
  dispose(): void {
    this.stopListening?.();
    this.stopListening = null;
    this.clearTimer();
  }

  private pendingRecords(): UserWordState[] {
    return Object.values(this.deps.store.wordStates()).filter(
      (s) => s.syncStatus === 'pending' && s.updatedAt !== '',
    );
  }

  private schedule(retry = false): void {
    const now = Date.now();
    this.firstDirtyAt ??= now;
    const remainingMax = Math.max(0, this.firstDirtyAt + this.maxDelayMs - now);
    // A retry after a failure waits the full max delay so a down API is not hammered.
    const delay = retry ? this.maxDelayMs : Math.min(this.debounceMs, remainingMax);
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.firstDirtyAt = null;
  }

  private async doFlush(): Promise<void> {
    if (this.pendingRecords().length === 0) {
      return;
    }
    const token = await this.activeToken();
    if (!token) {
      return;
    }
    const records = this.pendingRecords();
    for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
      const batch = records.slice(i, i + MAX_BATCH_SIZE);
      if (!(await this.sendBatch(batch, token))) {
        // Leave the rest pending and try again later.
        this.schedule(true);
        return;
      }
    }
  }

  /** Returns true when the API answered and the response was applied. */
  private async sendBatch(batch: UserWordState[], token: string): Promise<boolean> {
    let body: PutResponse;
    try {
      const response = await this.fetchFn(this.url('/progress'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch.map(toCloudRecord) }),
      });
      if (!response.ok) {
        return false;
      }
      body = ((await response.json()) as PutResponse) ?? {};
    } catch {
      return false;
    }

    const sent = new Map(batch.map((s) => [s.wordId, s]));
    // Only touch a record that has not changed since it was sent; a newer edit stays pending.
    const unchanged = (id: string): UserWordState | null => {
      const was = sent.get(id);
      const now = this.deps.store.wordStates()[id];
      return was && now && now.updatedAt === was.updatedAt ? now : null;
    };

    for (const id of Array.isArray(body.accepted) ? body.accepted : []) {
      const now = unchanged(id);
      if (now && now.syncStatus !== 'synced') {
        this.deps.store.setWordState({ ...now, syncStatus: 'synced' });
      }
    }
    for (const rejected of Array.isArray(body.rejected) ? body.rejected : []) {
      if (rejected?.current && unchanged(rejected.wordId)) {
        this.deps.store.setWordState(fromCloudRecord(rejected.current));
      }
    }
    return true;
  }

  /** After a load merge, queues the records the cloud lacks or holds older. */
  protected onMerged(wordIdsToPush: string[]): void {
    if (wordIdsToPush.length === 0) {
      return;
    }
    for (const id of wordIdsToPush) {
      const state = this.deps.store.wordStates()[id];
      if (state && state.syncStatus !== 'pending') {
        this.deps.store.setWordState({ ...state, syncStatus: 'pending' });
      }
    }
    this.schedule();
  }
}
