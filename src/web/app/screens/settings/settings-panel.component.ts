import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import type { UserSettings } from '@shared/entities';
import { AppStore } from '@shared/store';
import { NotificationService } from '../../components';
import { AuthService } from '../../services/auth.service';
import { SyncStatusService } from '../../services/sync-status.service';
import { AccountPanelComponent } from '../account/account-panel.component';

type BooleanFlag = 'showPinyin' | 'showCharacters' | 'audioEnabled';

interface SettingRow {
  readonly key: BooleanFlag;
  readonly label: string;
  readonly description: string;
}

/** Rows render in the order defined in ux/progressive-disclosure.md. */
export const SETTING_ROWS: readonly SettingRow[] = [
  { key: 'showPinyin', label: 'Show Pinyin', description: 'Show how each word is pronounced, in letters, under the picture.' },
  { key: 'showCharacters', label: 'Show Characters', description: 'Show the Chinese characters for each word under the picture.' },
  { key: 'audioEnabled', label: 'Audio', description: 'Play a recording of each word when a card is turned over.' },
];
const CLOUD_DESCRIPTION = 'Keep your progress safe and share it between devices.';

/** Slide-in settings overlay. Opened only by the gear on the home screen. */
@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountPanelComponent],
  template: `
    <div class="fixed inset-0 z-40 flex justify-end bg-black/40" data-testid="settings-backdrop" (click)="closed.emit()">
      <section
        class="flex h-full w-full max-w-sm flex-col gap-2 overflow-y-auto bg-white dark:bg-slate-900 p-5 text-slate-900 dark:text-slate-100 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="settings-panel"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between">
          <h2 id="settings-title" class="text-2xl font-semibold">Settings</h2>
          <button
            type="button"
            class="flex min-h-11 min-w-11 items-center justify-center rounded-full text-2xl"
            aria-label="Close settings"
            data-testid="settings-close"
            (click)="closed.emit()"
          >
            ✕
          </button>
        </header>

        @for (row of rows; track row.key) {
          <label class="flex min-h-11 items-center gap-4 border-b border-slate-200 dark:border-slate-700 py-3">
            <span class="flex-1">
              <span class="block text-lg font-medium">{{ row.label }}</span>
              <span class="block text-sm text-slate-600 dark:text-slate-300">{{ row.description }}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              class="size-7 shrink-0"
              [checked]="store.settings()[row.key]"
              [attr.data-testid]="'toggle-' + row.key"
              (change)="toggle(row.key, $event)"
            />
          </label>
        }
        <div class="flex flex-col gap-2 py-3" data-testid="cloud-section">
          <span class="block text-lg font-medium">Save to Cloud</span>
          @if (auth.signedIn()) {
            <span class="block text-sm text-slate-600 dark:text-slate-300" data-testid="cloud-email">Signed in as {{ auth.email() }}</span>
            <div class="flex items-center gap-2">
              <span class="flex-1 text-sm text-slate-600 dark:text-slate-300" data-testid="sync-last">{{ lastSyncedText() }}</span>
              <button
                type="button"
                class="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-2xl disabled:opacity-60"
                aria-label="Sync now"
                data-testid="sync-refresh"
                [disabled]="syncStatus.status().syncing"
                (click)="refresh()"
              >
                <span [class.animate-spin]="syncStatus.status().syncing" class="inline-block" aria-hidden="true">⟳</span>
              </button>
            </div>
            @if (syncStatus.status().error; as error) {
              <p class="rounded-lg border-2 border-red-700 dark:border-red-400 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-900 dark:text-red-100" role="alert" data-testid="sync-error">
                ⚠ {{ error }}
              </p>
            }
            <button type="button" [class]="button" data-testid="cloud-logout" (click)="logout()">Logout</button>
          } @else {
            <span class="block text-sm text-slate-600 dark:text-slate-300">{{ cloudDescription }}</span>
            <button type="button" [class]="button" data-testid="cloud-save" (click)="accountOpen.set(true)">Save to Cloud</button>
          }
        </div>
      </section>
    </div>
    <app-account-panel [(open)]="accountOpen" />
  `,
})
export class SettingsPanelComponent {
  protected readonly store = inject(AppStore);
  protected readonly auth = inject(AuthService);
  protected readonly syncStatus = inject(SyncStatusService);
  private readonly notifications = inject(NotificationService);
  protected readonly rows = SETTING_ROWS;
  protected readonly cloudDescription = CLOUD_DESCRIPTION;
  protected readonly button =
    'min-h-11 min-w-11 w-full rounded-xl bg-slate-800 dark:bg-slate-200 px-5 py-3 text-lg font-semibold text-white dark:text-slate-900';
  readonly closed = output<void>();
  protected readonly accountOpen = signal(false);
  protected readonly lastSyncedText = computed(() => {
    const at = this.syncStatus.status().lastSyncedAt;
    if (!at) return 'Not synced yet';
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return 'Not synced yet';
    return `Last synced: ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  });
  protected toggle(key: BooleanFlag, event: Event): void {
    const changes: Partial<UserSettings> = { [key]: (event.target as HTMLInputElement).checked };
    this.store.updateSettings(changes);
  }
  protected refresh(): void {
    void this.syncStatus.refresh();
  }
  /** Signs out and turns cloud sync off. Progress on the device stays. */
  protected async logout(): Promise<void> {
    this.store.updateSettings({ cloudSyncEnabled: false });
    await this.auth.signOut();
    this.notifications.showToast('Logged out. Your progress is saved on this device.');
  }
}
