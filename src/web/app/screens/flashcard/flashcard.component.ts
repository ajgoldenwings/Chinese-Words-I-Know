import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
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

/** Longest wait for a card's image to load before its word plays anyway. */
export const CARD_AUDIO_MAX_WAIT_MS = 1500;

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
  /** True once this card's word has played after its image appeared. */
  private cardAudioPlayed = false;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
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
    inject(DestroyRef).onDestroy(() => {
      this.clearFallback();
      this.audio.stop();
    });
    // A new category starts from the first card.
    effect(() => {
      this.categoryId();
      untracked(() => {
        this.startPass();
        this.resetCard(0);
      });
    });
  }

  /** Every press on the card plays the word. The first press also reveals the answer buttons. */
  protected onCardPress(): void {
    const w = this.word();
    if (!w) return;
    this.cardAudioPlayed = true;
    this.clearFallback();
    this.revealed.set(true);
    // A press plays at once: no wait for the image, and the recording's lead-in silence is skipped.
    void this.audio.play(w.audioAsset, 'natural', { skipLeadIn: true });
  }

  protected onImageLoad(): void {
    this.playCardAudio();
  }

  protected onImageError(): void {
    this.imageFailed.set(true);
    // The emoji shows instead, which counts as the image being displayed.
    this.playCardAudio();
  }

  /** Plays the word once per card, when its image is displayed. */
  private playCardAudio(): void {
    const w = this.word();
    if (!w || this.cardAudioPlayed) return;
    this.cardAudioPlayed = true;
    this.clearFallback();
    void this.audio.play(w.audioAsset, 'natural');
  }

  private clearFallback(): void {
    if (this.fallbackTimer !== null) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
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
    this.cardAudioPlayed = false;
    this.clearFallback();
    if (!this.word()) return;
    if (this.imageUrl() === null) {
      // No image: the emoji is displayed at once, so play now.
      this.playCardAudio();
    } else {
      // A slow image never holds the sound back for long.
      this.fallbackTimer = setTimeout(() => this.playCardAudio(), CARD_AUDIO_MAX_WAIT_MS);
    }
  }
}
