import type { UserSettings, Word } from '../entities';
import { shuffle } from './listen';

/**
 * One pass of a session in random order (ux/first-run.md#session-order). Every word appears
 * exactly once per pass. When `previousId` (the last word of the previous pass) would come
 * first, it is swapped with another word so the same word never shows twice in a row.
 * `random` returns a number in [0, 1).
 */
export function shufflePass<T extends { id: string }>(
  words: readonly T[],
  previousId: string | null | undefined,
  random: () => number = Math.random,
): T[] {
  const pass = shuffle(words, random);
  if (pass.length > 1 && previousId && pass[0].id === previousId) {
    const j = 1 + Math.floor(random() * (pass.length - 1));
    [pass[0], pass[j]] = [pass[j], pass[0]];
  }
  return pass;
}

/**
 * A random next target, never the previous one when there is another word to choose.
 * Returns null only when `words` is empty.
 */
export function pickNextTarget<T extends { id: string }>(
  words: readonly T[],
  previousId: string | null | undefined,
  random: () => number = Math.random,
): T | null {
  const others = words.filter((w) => w.id !== previousId);
  const pool = others.length > 0 ? others : words;
  return shuffle(pool, random)[0] ?? null;
}

export interface WordDisplay {
  showPinyin: boolean;
  showCharacters: boolean;
}

/** The three learning settings for one session type, in a shape shared by every mode. */
export interface DisplaySettings {
  showPinyin: boolean;
  showCharacters: boolean;
  /** True when the word's recording plays in this mode, so it gives the learner Chinese by sound. */
  audioEnabled: boolean;
}

/** Flashcard settings (ux/progressive-disclosure.md). */
export function flashcardDisplaySettings(settings: UserSettings): DisplaySettings {
  return {
    showPinyin: settings.flashcardShowPinyin,
    showCharacters: settings.flashcardShowCharacters,
    audioEnabled: settings.flashcardAudio,
  };
}

/** Listen + Tap settings. Its sound always plays; the audio setting only adds a repeat button. */
export function listenDisplaySettings(settings: UserSettings): DisplaySettings {
  return {
    showPinyin: settings.listenShowPinyin,
    showCharacters: settings.listenShowCharacters,
    audioEnabled: true,
  };
}

/**
 * Which Chinese text to show for a word, given one mode's settings. Pinyin appears automatically
 * when the word would otherwise give the learner no Chinese: no audio for the word (or audio off)
 * and both text settings off. Never changes the saved settings. Each screen decides when the
 * pinyin appears (for example only after a tap).
 */
export function getWordDisplay(word: Pick<Word, 'audioAsset'>, settings: DisplaySettings): WordDisplay {
  const hasAudio = settings.audioEnabled && !!word.audioAsset;
  const fallback = !hasAudio && !settings.showPinyin && !settings.showCharacters;
  return {
    showPinyin: settings.showPinyin || fallback,
    showCharacters: settings.showCharacters,
  };
}
