import { ChangeDetectionStrategy, Component, effect, inject, output, signal, untracked } from '@angular/core';
import type { UserSettings } from '@shared/entities';
import { AppStore } from '@shared/store';
import { AuthService } from '../../services/auth.service';
import { AccountPanelComponent } from '../account/account-panel.component';

type BooleanFlag = 'showPinyin' | 'showCharacters' | 'audioEnabled' | 'cloudSyncEnabled';

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
  { key: 'cloudSyncEnabled', label: 'Save to Cloud', description: 'Keep your progress safe and share it between devices.' },
];

/** Slide-in settings overlay. Opened only by the gear on the home screen. */
@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountPanelComponent],
  template: `
    <div class="fixed inset-0 z-40 flex justify-end bg-black/40" data-testid="settings-backdrop" (click)="closed.emit()">
      <section
        class="flex h-full w-full max-w-sm flex-col gap-2 overflow-y-auto bg-white p-5 text-slate-900 shadow-xl"
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
          <label class="flex min-h-11 items-center gap-4 border-b border-slate-200 py-3">
            <span class="flex-1">
              <span class="block text-lg font-medium">{{ row.label }}</span>
              <span class="block text-sm text-slate-600">{{ row.description }}</span>
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
      </section>
    </div>
    <app-account-panel [(open)]="accountOpen" />
  `,
})
export class SettingsPanelComponent {
  protected readonly store = inject(AppStore);
  private readonly auth = inject(AuthService);
  protected readonly rows = SETTING_ROWS;
  readonly closed = output<void>();
  protected readonly accountOpen = signal(false);
  private readonly pendingCloud = signal(false);

  constructor() {
    // Save to Cloud turns on only once the parent is signed in.
    effect(() => {
      if (!this.pendingCloud()) return;
      if (this.auth.signedIn()) {
        untracked(() => {
          this.store.updateSettings({ cloudSyncEnabled: true });
          this.pendingCloud.set(false);
        });
      } else if (!this.accountOpen()) {
        untracked(() => this.pendingCloud.set(false));
      }
    });
  }

  protected toggle(key: BooleanFlag, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.checked;
    if (key === 'cloudSyncEnabled') {
      if (value && !this.auth.signedIn()) {
        // Stay off until sign-in succeeds. Closing the panel leaves it off.
        input.checked = false;
        this.pendingCloud.set(true);
        this.accountOpen.set(true);
        return;
      }
      if (!value) {
        this.pendingCloud.set(false);
        this.accountOpen.set(false);
        void this.auth.signOut();
      }
    }
    const changes: Partial<UserSettings> = { [key]: value };
    this.store.updateSettings(changes);
  }
}
