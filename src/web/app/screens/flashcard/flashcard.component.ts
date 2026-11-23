import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import { loadContent } from '@shared/content';
import type { Word } from '@shared/entities';
import { getWordDisplay, orderWordsForSession } from '@shared/session';
import { AppStore } from '@shared/store';
import { map } from 'rxjs';
import { AudioService } from '../../services/audio.service';
import { ImageService } from '../../services/image.service';

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

  protected readonly category = computed(
    () => this.content.categories.find((c) => c.id === this.categoryId()) ?? null,
  );
  private readonly store = inject(AppStore);
  /** The current pass, lowest confidence first. Re-ordered each time the pass wraps. */
  private readonly queue = signal<Word[]>([]);
  protected readonly index = signal(0);
  protected readonly revealed = signal(false);
  private readonly imageFailed = signal(false);
  protected readonly word = computed(() => this.queue()[this.index()] ?? null);
  protected readonly display = computed(() => {
    const w = this.word();
    return w ? getWordDisplay(w, this.store.settings()) : null;
  });
  protected readonly emoji = computed(() => this.category()?.emoji ?? '🀄');
  protected readonly imageUrl = computed(() =>
    this.imageFailed() ? null : this.images.wordImageUrl(this.word()?.imageAsset),
  );

  constructor() {
    // A new category starts from the first card.
    effect(() => {
      this.categoryId();
      untracked(() => {
        this.startPass();
        this.resetCard(0);
      });
    });
  }

  protected reveal(): void {
    if (this.revealed() || !this.word()) return;
    this.revealed.set(true);
    void this.audio.play(this.word()!.audioAsset, 'natural');
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

  private startPass(): void {
    const inCategory = this.content.words.filter((w) => w.category === this.categoryId());
    this.queue.set(orderWordsForSession(inCategory, this.store.wordStates()));
  }

  private resetCard(index: number): void {
    this.index.set(index);
    this.revealed.set(false);
    this.imageFailed.set(false);
  }
}
