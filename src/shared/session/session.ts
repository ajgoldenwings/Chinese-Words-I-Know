import type { UserSettings, UserWordState, Word } from '../entities';

/**
 * One pass through a category, lowest confidence first. Ties keep content order.
 * Words with no stored state count as score 0.
 */
export function orderWordsForSession(
  words: readonly Word[],
  wordStates: Readonly<Record<string, UserWordState | undefined>>,
): Word[] {
  return words
    .map((word, position) => ({
      word,
      position,
      score: wordStates[word.id]?.confidenceScore ?? 0,
    }))
    .sort((a, b) => a.score - b.score || a.position - b.position)
    .map((entry) => entry.word);
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
