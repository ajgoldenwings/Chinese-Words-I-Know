import { Injectable, signal } from '@angular/core';
import type { SyncStatusInfo } from '@shared/sync';
/**
 * What the settings panel shows about cloud sync. `startSync` feeds it from `SyncService`
 * and registers the refresh action. Held in memory only.
 */
@Injectable({ providedIn: 'root' })
export class SyncStatusService {
  private readonly _status = signal<SyncStatusInfo>({ syncing: false, lastSyncedAt: null, error: null });
  private refreshAction: (() => Promise<void>) | null = null;
  /** True once sync is wired. False when the API URL is not set. */
  private readonly _available = signal(false);
  readonly status = this._status.asReadonly();
  readonly available = this._available.asReadonly();
  /** Called by the provider with each `SyncService` status. */
  apply(status: SyncStatusInfo): void {
    this._status.set(status);
  }
  attach(refresh: () => Promise<void>): void {
    this.refreshAction = refresh;
    this._available.set(true);
  }
  /** Syncs now. Does nothing while a sync is already running. */
  async refresh(): Promise<void> {
    if (!this.refreshAction || this._status().syncing) return;
    await this.refreshAction();
  }
}
