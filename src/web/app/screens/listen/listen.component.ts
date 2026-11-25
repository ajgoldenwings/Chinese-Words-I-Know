import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import { loadContent } from '@shared/content';
import type { Word } from '@shared/entities';
import {
  buildListenTiles,
  imagedWordsInCategory,
  pickNextTarget,
  selectListenCategory,
  getWordDisplay,
  listenDisplaySettings,
  type WordDisplay,
} from '@shared/session';
import { AppStore } from '@shared/store';
import { map } from 'rxjs';
import { AudioService } from '../../services/audio.service';
import { ImageService } from '../../services/image.service';
import { SESSION_RANDOM } from '../../services/session-random';

@Component({
  selector: 'app-listen',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listen.component.html',
  styles: `
    @keyframes tile-pop { 50% { transform: scale(1.08); } }
    @keyframes tile-shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
    .tile-correct { animation: tile-pop 250ms; }
    .tile-wrong { animation: tile-shake 250ms; }
    @media (prefers-reduced-motion: reduce) { .tile-correct, .tile-wrong { animation: none; } }
  `,
})
export class ListenComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly images = inject(ImageService);
  private readonly audio = inject(AudioService);
  private readonly store = inject(AppStore);
  private readonly random = inject(SESSION_RANDOM);
  private readonly content = loadContent();
  private readonly requested = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('category'))),
    { initialValue: null },
  );

  protected readonly categoryId = computed(() => selectListenCategory(this.content, this.requested()));
  protected readonly emoji = computed(
    () => this.content.categories.find((c) => c.id === this.categoryId())?.emoji ?? '🀄',
  );

  protected readonly target = signal<Word | null>(null);
  protected readonly tiles = signal<Word[]>([]);
  /** Tiles the child has tapped wrongly this round. */
  protected readonly wrongIds = signal<ReadonlySet<string>>(new Set());
  /** True once the target tile has been tapped. Shows the next-round button. */
  protected readonly solved = signal(false);
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  /** Tiles pressed this round, right or wrong. Their pinyin shows under the picture. */
  protected readonly pressedIds = signal<ReadonlySet<string>>(new Set());
  /**
   * True when the target has a recording. Listen + Tap sound always plays, so the English word is
   * only needed as the prompt when there is no recording.
   */
  protected readonly hasAudioPrompt = computed(() => !!this.target()?.audioAsset);
  /** Listen + Tap Audio setting: a button that plays the word again. */
  protected readonly showRepeat = computed(
    () => this.store.settings().listenRepeatButton && this.hasAudioPrompt(),
  );
  /** Listen + Tap settings for each tile's word, including the pinyin fallback. */
  private readonly displays = computed(() => {
    const settings = listenDisplaySettings(this.store.settings());
    return new Map(this.tiles().map((w) => [w.id, getWordDisplay(w, settings)]));
  });

  constructor() {
    effect(() => {
      const id = this.categoryId();
      untracked(() => {
        // Listen & Tap needs a category with at least 4 imaged words.
        if (!id) {
          void this.router.navigateByUrl('/');
          return;
        }
        this.startRound();
      });
    });
  }

  protected isCorrect(word: Word): boolean {
    return this.solved() && word.id === this.target()?.id;
  }

  protected display(word: Word): WordDisplay {
    return this.displays().get(word.id) ?? { showPinyin: false, showCharacters: false };
  }
  /** Pinyin shows under a picture only after that picture has been tapped. */
  protected showTilePinyin(word: Word): boolean {
    return this.display(word).showPinyin && this.pressedIds().has(word.id);
  }
  /** Plays the round's word again. Shown only when the Listen + Tap Audio setting is on. */
  protected repeat(): void {
    const t = this.target();
    if (t) void this.audio.play(t.audioAsset, 'slow');
  }
  protected tileImageUrl(word: Word): string | null {
    return this.failedImages().has(word.id) ? null : this.images.wordImageUrl(word.imageAsset);
  }

  protected onImageError(word: Word): void {
    this.failedImages.update((s) => new Set(s).add(word.id));
  }

  /** Plays the pressed word, then scores the target: a correct tile raises it, the first wrong tile of a round lowers it. */
  protected onTileTap(word: Word): void {
    const t = this.target();
    if (!t || this.solved()) return;
    // Every press says the word for the picture that was pressed, including a repeat press on a wrong tile.
    void this.audio.play(word.audioAsset, 'slow');
    this.pressedIds.update((s) => (s.has(word.id) ? s : new Set(s).add(word.id)));
    if (this.wrongIds().has(word.id)) return;
    const state = this.store.getWordState(t.id);
    if (word.id === t.id) {
      this.store.setWordState(applyCorrectAnswer(state, 'listening'));
      this.solved.set(true);
      return;
    }
    if (this.wrongIds().size === 0) this.store.setWordState(applyIncorrectAnswer(state));
    this.wrongIds.update((s) => new Set(s).add(word.id));
  }

  protected nextRound(): void {
    this.startRound(this.target()?.id);
  }

  /** Picks a random imaged word (not the previous target) as the target and builds its tiles. */
  protected startRound(previousId?: string): void {
    this.solved.set(false);
    this.wrongIds.set(new Set());
    this.pressedIds.set(new Set());
    const id = this.categoryId();
    this.failedImages.set(new Set());
    if (!id) {
      this.target.set(null);
      this.tiles.set([]);
      return;
    }
    const imaged = imagedWordsInCategory(this.content.words, id);
    // A random target each round, never the previous one (ux/first-run.md#session-order).
    const target = pickNextTarget(imaged, previousId, this.random);
    this.target.set(target);
    this.tiles.set(target ? buildListenTiles(this.content.words, target, this.random) : []);
    if (target && this.hasAudioPrompt()) {
      void this.audio.play(target.audioAsset, 'slow');
    }
  }
}
