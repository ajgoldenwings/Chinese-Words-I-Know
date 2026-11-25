import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import { loadContent, selectStartNowCategory } from '@shared/content';
import type { Word } from '@shared/entities';
import { buildWordLists } from '@shared/lists';
import { flashcardDisplaySettings, getWordDisplay, shufflePass } from '@shared/session';
import { AppStore } from '@shared/store';
import { map } from 'rxjs';
import { AudioService } from '../../services/audio.service';
import { ImageService } from '../../services/image.service';
import { SESSION_RANDOM } from '../../services/session-random';

@Component({
  selector: 'app-flashcard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flashcard.component.html',
  styles: `
    @keyframes got-it { 50% { transform: scale(1.15); } }
    @keyframes not-yet { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .got-it:active { animation: got-it 200ms; }
    .not-yet:active { animation: not-yet 200ms; }
    @media (prefers-reduced-motion: reduce) { .got-it:active, .not-yet:active { animation: none; } }
  `,
})
export class FlashcardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly images = inject(ImageService);
  private readonly audio = inject(AudioService);
  private readonly content = loadContent();

  private readonly categoryId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('categoryId') ?? '')),
    { initialValue: '' },
  );

  /** True on the Learn Next session that Start Now opens. Words then come from any category. */
  private readonly learnNext = this.route.snapshot.data['source'] === 'learn-next';
  protected readonly category = computed(
    () => this.content.categories.find((c) => c.id === this.categoryId()) ?? null,
  );
  private readonly store = inject(AppStore);
  private readonly random = inject(SESSION_RANDOM);
  /** The current pass in random order. Shuffled again each time the pass wraps. */
  private readonly queue = signal<Word[]>([]);
  protected readonly index = signal(0);
  protected readonly revealed = signal(false);
  private readonly imageFailed = signal(false);
  protected readonly word = computed(() => this.queue()[this.index()] ?? null);
  /** Flashcard settings only. Characters show with the image; pinyin waits for the tap (see the template). */
  protected readonly display = computed(() => {
    const w = this.word();
    return w ? getWordDisplay(w, flashcardDisplaySettings(this.store.settings())) : null;
  });
  protected readonly audioOn = computed(() => this.store.settings().flashcardAudio);
  /** The fallback emoji is the current word's category, so it is right in a mixed Learn Next session. */
  protected readonly emoji = computed(() => {
    const id = this.word()?.category ?? this.categoryId();
    return this.content.categories.find((c) => c.id === id)?.emoji ?? '🀄';
  });
  protected readonly imageUrl = computed(() =>
    this.imageFailed() ? null : this.images.wordImageUrl(this.word()?.imageAsset),
  );

  constructor() {
    // Leaving the session stops any word still playing.
    inject(DestroyRef).onDestroy(() => this.audio.stop());
    // A new category starts from the first card.
    effect(() => {
      this.categoryId();
      untracked(() => {
        this.startPass();
        this.resetCard(0);
      });
    });
  }

  /**
   * Sound plays only when the card is pressed (and Flashcard Audio is on), never when a card appears.
   * Every press plays the word from the start. The first press also reveals the pinyin and the answer buttons.
   */
  protected onCardPress(): void {
    const w = this.word();
    if (!w) return;
    this.revealed.set(true);
    if (this.audioOn()) void this.audio.play(w.audioAsset, 'natural');
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  protected gotIt(): void {
    this.answer(true);
  }

  protected notYet(): void {
    this.answer(false);
  }

  /** Scores the word, then moves on. Sessions never end on their own. */
  protected answer(correct: boolean): void {
    const w = this.word();
    this.audio.stop();
    if (!w) return;
    const state = this.store.getWordState(w.id);
    this.store.setWordState(
      correct ? applyCorrectAnswer(state, 'flashcard') : applyIncorrectAnswer(state),
    );
    const next = this.index() + 1;
    if (next >= this.queue().length) {
      this.startPass();
      this.resetCard(0);
    } else {
      this.resetCard(next);
    }
  }

  /**
   * Builds the next pass in random order. Each word shows once per pass, and the last word of
   * the previous pass never comes straight back as the first of the next.
   */
  private startPass(): void {
    const states = this.store.wordStates();
    const last = this.word()?.id ?? null;
    if (this.learnNext) {
      // Learn Next is rebuilt at the start of every pass, so it follows the latest scores.
      const words = buildWordLists(this.content.words, states).learnNext;
      if (words.length > 0) {
        this.queue.set(shufflePass(words, last, this.random));
        return;
      }
      // Every word reached 0.6 during the session: carry on with the Start Now category.
      const fallback = selectStartNowCategory(this.content, states);
      const inFallback = this.content.words.filter((w) => w.category === fallback);
      this.queue.set(shufflePass(inFallback, last, this.random));
      return;
    }
    const inCategory = this.content.words.filter((w) => w.category === this.categoryId());
    this.queue.set(shufflePass(inCategory, last, this.random));
  }

  private resetCard(index: number): void {
    this.index.set(index);
    this.revealed.set(false);
    this.imageFailed.set(false);
  }
}
