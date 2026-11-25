import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import type { UserSettings } from '@shared/entities';
import { AppStore } from '@shared/store';
import { NotificationService } from '../../components';
import { AuthService } from '../../services/auth.service';
import { SyncStatusService } from '../../services/sync-status.service';
import { AccountPanelComponent } from '../account/account-panel.component';

/** A learning setting shown as a switch. Cloud sync is a button, not a switch. */
type LearningFlag = Exclude<keyof UserSettings, 'cloudSyncEnabled'>;
interface SettingRow {
  readonly key: LearningFlag;
  readonly label: string;
  readonly description: string;
}
/** The pages of the panel. Settings → Learning Settings → Flashcard or Listen + Tap. */
export type SettingsPage = 'main' | 'learning' | 'flashcard' | 'listen';
interface SubmenuPage {
  readonly title: string;
  /** One line on the Learning Settings page, under the link to this page. */
  readonly summary: string;
  readonly rows: readonly SettingRow[];
}
/** Learning settings by session type, in the order defined in ux/progressive-disclosure.md. */
export const LEARNING_PAGES: Readonly<Record<'flashcard' | 'listen', SubmenuPage>> = {
  flashcard: {
    title: 'Flashcard Settings',
    summary: 'Pinyin, characters and sound for flashcards.',
    rows: [
      { key: 'flashcardShowPinyin', label: 'Show Pinyin', description: 'Show how each word is pronounced, in letters, after the card is tapped.' },
      { key: 'flashcardShowCharacters', label: 'Show Characters', description: 'Show the Chinese characters for each word under the picture.' },
      { key: 'flashcardAudio', label: 'Audio', description: 'Play a recording of each word when a card is tapped.' },
    ],
  },
  listen: {
    title: 'Listen + Tap Settings',
    summary: 'Pinyin, characters and the repeat button for Listen + Tap.',
    rows: [
      { key: 'listenShowPinyin', label: 'Show Pinyin', description: 'Show how each word is pronounced under a picture after it is tapped.' },
      { key: 'listenShowCharacters', label: 'Show Characters', description: 'Show the Chinese characters for each word under the picture.' },
      { key: 'listenRepeatButton', label: 'Audio', description: 'Show a repeat button.' },
    ],
  },
};
/** Every learning switch, page by page. */
export const SETTING_ROWS: readonly SettingRow[] = [...LEARNING_PAGES.flashcard.rows, ...LEARNING_PAGES.listen.rows];
const PAGE_TITLES: Record<SettingsPage, string> = {
  main: 'Settings',
  learning: 'Learning Settings',
  flashcard: LEARNING_PAGES.flashcard.title,
  listen: LEARNING_PAGES.listen.title,
};
/** Where the back arrow goes from each page. */
const PARENT: Record<Exclude<SettingsPage, 'main'>, SettingsPage> = {
  learning: 'main',
  flashcard: 'learning',
  listen: 'learning',
};
const LEARNING_SUMMARY = 'Choose what shows and plays in each kind of session.';
const CLOUD_DESCRIPTION = 'Keep your progress safe and share it between devices.';

/** Slide-in settings overlay. Opened only by the gear on the home screen. */
@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountPanelComponent, NgTemplateOutlet],
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
        <header class="flex items-center gap-2">
          @if (page() !== 'main') {
            <button
              type="button"
              class="flex min-h-11 min-w-11 items-center justify-center rounded-full text-2xl"
              [attr.aria-label]="'Back to ' + parentTitle()"
              data-testid="settings-back"
              (click)="back()"
            >
              ←
            </button>
          }
          <h2 id="settings-title" class="flex-1 text-2xl font-semibold" data-testid="settings-title">{{ title() }}</h2>
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

        @switch (page()) {
          @case ('main') {
            <ng-container *ngTemplateOutlet="link; context: { $implicit: 'learning', label: 'Learning Settings', summary: learningSummary }" />
            <ng-container *ngTemplateOutlet="cloud" />
          }
          @case ('learning') {
            <ng-container *ngTemplateOutlet="link; context: { $implicit: 'flashcard', label: pages.flashcard.title, summary: pages.flashcard.summary }" />
            <ng-container *ngTemplateOutlet="link; context: { $implicit: 'listen', label: pages.listen.title, summary: pages.listen.summary }" />
          }
          @case ('flashcard') {
            <ng-container *ngTemplateOutlet="switches; context: { $implicit: pages.flashcard.rows }" />
          }
          @case ('listen') {
            <ng-container *ngTemplateOutlet="switches; context: { $implicit: pages.listen.rows }" />
          }
        }
      </section>
    </div>
    <app-account-panel [(open)]="accountOpen" />

    <!-- A row that opens a submenu page. -->
    <ng-template #link let-target let-label="label" let-summary="summary">
      <button
        type="button"
        class="flex min-h-11 w-full items-center gap-4 border-b border-slate-200 dark:border-slate-700 py-3 text-left"
        [attr.data-testid]="'open-' + target"
        (click)="go(target)"
      >
        <span class="flex-1">
          <span class="block text-lg font-medium">{{ label }}</span>
          <span class="block text-sm text-slate-600 dark:text-slate-300">{{ summary }}</span>
        </span>
        <span class="text-2xl" aria-hidden="true">›</span>
      </button>
    </ng-template>

    <!-- The switches on a submenu page. -->
    <ng-template #switches let-rows>
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
            [checked]="isOn(row.key)"
            [attr.data-testid]="'toggle-' + row.key"
            (change)="toggle(row.key, $event)"
          />
        </label>
      }
    </ng-template>

    <ng-template #cloud>
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
    </ng-template>
  `,
})
export class SettingsPanelComponent {
  protected readonly store = inject(AppStore);
  protected readonly auth = inject(AuthService);
  protected readonly syncStatus = inject(SyncStatusService);
  private readonly notifications = inject(NotificationService);
  protected readonly pages = LEARNING_PAGES;
  protected readonly learningSummary = LEARNING_SUMMARY;
  /** The panel always opens on the main page. */
  protected readonly page = signal<SettingsPage>('main');
  protected readonly title = computed(() => PAGE_TITLES[this.page()]);
  protected readonly parentTitle = computed(() => {
    const p = this.page();
    return p === 'main' ? '' : PAGE_TITLES[PARENT[p]];
  });
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
  protected isOn(key: LearningFlag): boolean {
    return this.store.settings()[key];
  }
  protected go(page: SettingsPage): void {
    this.page.set(page);
  }
  protected back(): void {
    const p = this.page();
    if (p !== 'main') this.page.set(PARENT[p]);
  }
  protected toggle(key: LearningFlag, event: Event): void {
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
