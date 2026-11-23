import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { loadContent, selectStartNowCategory, type Content } from '@shared/content';
import { AppStore } from '@shared/store';
import { SettingsPanelComponent } from '../settings/settings-panel.component';

/** Minimum number of words with an image a category needs for Listen & Tap. */
export const LISTEN_MIN_IMAGES = 4;

@Component({
  selector: 'app-home',
  imports: [RouterLink, SettingsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private readonly store = inject(AppStore);
  private readonly router = inject(Router);

  protected readonly content: Content = loadContent();
  /** Set to true when the gear is tapped. The settings panel (task 12) reacts to it. */
  readonly settingsOpen = signal(false);

  protected readonly categories = this.content.categories;

  protected readonly showListen = computed(() => {
    const counts = new Map<string, number>();
    for (const w of this.content.words) {
      if (w.imageAsset) counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
    }
    return [...counts.values()].some((n) => n >= LISTEN_MIN_IMAGES);
  });

  constructor() {
    this.store.migrateContent(this.content);
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  /** First launch: Animals. Returning user: the recommended category. Always flashcards. */
  startNow(): void {
    const id = selectStartNowCategory(this.content, this.store.wordStates());
    if (id) void this.router.navigate(['/session/flashcard', id]);
  }
}
