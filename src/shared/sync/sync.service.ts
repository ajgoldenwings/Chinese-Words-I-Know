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
  /** Called whenever the sync status changes. */
  onStatus?: (status: SyncStatusInfo) => void;
}
export interface SyncStatusInfo {
  /** A pull or push is running. */
  syncing: boolean;
  /** ISO 8601 time of the last successful pull or push. Null until one succeeds. */
  lastSyncedAt: string | null;
  /** Plain-language message for a parent, or null when the last sync worked. */
  error: string | null;
}
export const PUSH_FAILED_MESSAGE = 'Your progress is not saved to the cloud yet. It will try again.';
export const PULL_FAILED_MESSAGE =
  'Could not check the cloud for newer progress. Check your internet connection and try again.';
export const SIGN_IN_EXPIRED_MESSAGE = 'Your sign-in has expired. Please log out and log in again.';

export interface SyncApi {
  /** Pulls cloud state and merges with local. Never throws. */
  syncOnLoad(): Promise<void>;
  /** Marks a record pending and schedules a flush. */
  markDirty(wordId: string): void;
  /** Sends all pending records to the API. Never throws. */
  flush(): Promise<void>;
  /** Sends pending records, then pulls and merges. Never throws. */
  refresh(): Promise<void>;
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
  private refreshing: Promise<void> | null = null;
  private active = 0;
  private lastSyncedAt: string | null = null;
  private pushError: string | null = null;
  private pullError: string | null = null;

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
  /** The token, or null with the sign-in error recorded when sync is on but there is no token. */
  private async tokenFor(kind: 'push' | 'pull'): Promise<string | null> {
    const token = await this.activeToken();
    if (!token && this.deps.store.settings().cloudSyncEnabled) {
      this.setError(kind, SIGN_IN_EXPIRED_MESSAGE);
    }
    return token;
  }
  private setError(kind: 'push' | 'pull', message: string | null): void {
    if (kind === 'push') this.pushError = message;
    else this.pullError = message;
    this.emit();
  }
  private emit(): void {
    this.deps.onStatus?.({
      syncing: this.active > 0,
      lastSyncedAt: this.lastSyncedAt,
      error: this.pushError ?? this.pullError,
    });
  }
  /** Runs `work` and reports the syncing state around it. */
  private async track<T>(work: () => Promise<T>): Promise<T> {
    this.active += 1;
    this.emit();
    try {
      return await work();
    } finally {
      this.active -= 1;
      this.emit();
    }
  }
  private markSynced(kind: 'push' | 'pull'): void {
    this.lastSyncedAt = this.now();
    this.setError(kind, null);
  }
  private errorFor(status: number, fallback: string): string {
    return status === 401 || status === 403 ? SIGN_IN_EXPIRED_MESSAGE : fallback;
  }

  protected url(path: string): string {
    return `${this.deps.apiBaseUrl.replace(/\/+$/, '')}${path}`;
  }

  syncOnLoad(): Promise<void> {
    return this.track(() => this.pull());
  }
  /**
   * Sends pending records, then pulls and merges. A second call while one runs joins the first.
   * Never throws.
   */
  refresh(): Promise<void> {
    if (this.refreshing) {
      return this.refreshing;
    }
    const run = this.track(async () => {
      await this.flush();
      await this.pull();
    })
      .catch(() => undefined)
      .finally(() => {
        this.refreshing = null;
      });
    this.refreshing = run;
    return run;
  }
  private async pull(): Promise<void> {
    const token = await this.tokenFor('pull');
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
        // Local data stays as it is.
        this.setError('pull', this.errorFor(response.status, PULL_FAILED_MESSAGE));
        return;
      }
      const body = (await response.json()) as { items?: CloudWordState[] };
      items = Array.isArray(body.items) ? body.items : [];
    } catch {
      // Offline or API error: local data stays as it is.
      this.setError('pull', PULL_FAILED_MESSAGE);
      return;
    }
    const { merged, toPush } = mergeWordStates(this.deps.store.wordStates(), items.map(fromCloudRecord));
    const current = this.deps.store.wordStates();
    for (const [id, state] of Object.entries(merged)) {
      if (current[id] !== state) {
        this.deps.store.setWordState(state);
      }
    }
    this.markSynced('pull');
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
    const run = this.track(() => this.doFlush())
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
      // Nothing is waiting to be saved, so an old save error no longer applies.
      if (this.pushError !== null) this.setError('push', null);
      return;
    }
    const token = await this.tokenFor('push');
    if (!token) {
      return;
    }
    const records = this.pendingRecords();
    let failed = false;
    let sentAny = false;
    for (let i = 0; i < records.length; i += MAX_BATCH_SIZE) {
      const batch = records.slice(i, i + MAX_BATCH_SIZE);
      const result = await this.sendBatch(batch, token);
      if (result === 'ok') {
        sentAny = true;
        continue;
      }
      failed = true;
      // A network error, server error or expired sign-in affects every batch, so stop.
      // A batch the API refuses is skipped so it cannot block the rest.
      if (result === 'stop') {
        break;
      }
    }
    if (failed) {
      // Leave the rest pending and try again later. The error message is already set.
      this.schedule(true);
    } else if (sentAny) {
      this.markSynced('push');
    }
  }
  /** `ok`: applied. `skip`: the API refused this batch. `stop`: stop sending for now. */
  private async sendBatch(batch: UserWordState[], token: string): Promise<'ok' | 'skip' | 'stop'> {
    let body: PutResponse;
    try {
      const response = await this.fetchFn(this.url('/progress'), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch.map(toCloudRecord) }),
      });
      if (!response.ok) {
        this.setError('push', this.errorFor(response.status, PUSH_FAILED_MESSAGE));
        const refused = response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403;
        return refused ? 'skip' : 'stop';
      }
      body = ((await response.json()) as PutResponse) ?? {};
    } catch {
      this.setError('push', PUSH_FAILED_MESSAGE);
      return 'stop';
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
    return 'ok';
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
