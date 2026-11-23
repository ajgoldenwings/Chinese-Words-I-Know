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

/**
 * Which Chinese text to show for a word. Pinyin appears automatically when the word
 * would otherwise give the learner no Chinese: no audio for the word (or audio off)
 * and both text settings off. Never changes the saved settings.
 */
export function getWordDisplay(
  word: Pick<Word, 'audioAsset'>,
  settings: Pick<UserSettings, 'showPinyin' | 'showCharacters' | 'audioEnabled'>,
): WordDisplay {
  const hasAudio = settings.audioEnabled && !!word.audioAsset;
  const fallback = !hasAudio && !settings.showPinyin && !settings.showCharacters;
  return {
    showPinyin: settings.showPinyin || fallback,
    showCharacters: settings.showCharacters,
  };
}
