import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { applyManualOverride, isAlmostThere, isKnown } from '@shared/confidence';
import { loadContent } from '@shared/content';
import type { UserWordState, Word } from '@shared/entities';
import { buildWordLists } from '@shared/lists';
import { activeWordStates, AppStore } from '@shared/store';
import { getWordDisplay } from '@shared/session';
import { ImageService } from '../../services/image.service';
import { LongPressDirective } from './long-press.directive';

interface Section {
  id: 'known' | 'almost-there' | 'learn-next';
  title: string;
  empty: string;
  words: Word[];
}

@Component({
  selector: 'app-my-words',
  imports: [RouterLink, LongPressDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-words.component.html',
})
export class MyWordsComponent {
  private readonly store = inject(AppStore);
  private readonly images = inject(ImageService);
  private readonly content = loadContent();
  private readonly emojiByCategory = new Map(this.content.categories.map((c) => [c.id, c.emoji]));
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  /** Recomputed whenever the store changes. Orphaned states are excluded. */
  protected readonly sections = computed<Section[]>(() => {
    const states: Record<string, UserWordState> = {};
    for (const s of activeWordStates(this.store.wordStates(), this.content)) states[s.wordId] = s;
    const lists = buildWordLists(this.content.words, states);
    return [
      { id: 'known', title: 'Known', empty: 'No words here yet. Keep practicing together.', words: lists.known },
      { id: 'almost-there', title: 'Almost There', empty: 'No words here yet.', words: lists.almostThere },
      { id: 'learn-next', title: 'Learn Next', empty: 'No more words to suggest right now.', words: lists.learnNext },
    ];
  });

  /** The word whose detail view is open, and whether its override menu is showing. */
  protected readonly selected = signal<Word | null>(null);
  protected readonly menuOpen = signal(false);

  protected readonly display = computed(() => {
    const w = this.selected();
    return w ? getWordDisplay(w, this.store.settings()) : null;
  });
  protected readonly selectedStatus = computed(() => {
    const w = this.selected();
    if (!w) return '';
    const state = this.store.getWordState(w.id);
    return isKnown(state) ? 'Known' : isAlmostThere(state) ? 'Almost there' : 'Still learning';
  });

  protected open(word: Word): void {
    this.menuOpen.set(false);
    this.selected.set(word);
  }

  protected openMenu(word: Word): void {
    this.selected.set(word);
    this.menuOpen.set(true);
  }

  protected close(): void {
    this.menuOpen.set(false);
    this.selected.set(null);
  }

  protected markAs(direction: 'known' | 'unknown'): void {
    const w = this.selected();
    if (!w) return;
    this.store.setWordState(applyManualOverride(this.store.getWordState(w.id), direction));
    this.menuOpen.set(false);
  }

  protected imageUrl(word: Word): string | null {
    return this.failedImages().has(word.id) ? null : this.images.wordImageUrl(word.imageAsset);
  }

  protected emoji(word: Word): string {
    return this.emojiByCategory.get(word.category) ?? '🀄';
  }

  protected onImageError(word: Word): void {
    this.failedImages.update((s) => new Set(s).add(word.id));
  }
}
