import type { Word } from '../entities';

/** Tiles shown per Listen & Tap round: the target plus three distractors. */
export const LISTEN_TILE_COUNT = 4;

/** Words that can appear as a tile: they have an illustration. */
function hasImage(word: Word): boolean {
  return word.imageAsset !== null && word.imageAsset !== '';
}

/** Imaged words of one category, in content order. */
export function imagedWordsInCategory(words: readonly Word[], categoryId: string): Word[] {
  return words.filter((w) => w.category === categoryId && hasImage(w));
}

/** Whether a category has enough imaged words for Listen & Tap. */
export function isListenAvailable(
  words: readonly Word[],
  categoryId: string,
  min: number = LISTEN_TILE_COUNT,
): boolean {
  return imagedWordsInCategory(words, categoryId).length >= min;
}

/**
 * Category for Listen & Tap: the requested one when it qualifies, else the first
 * qualifying category in content order, else null.
 */
export function selectListenCategory(
  content: { categories: readonly { id: string }[]; words: readonly Word[] },
  requested: string | null | undefined,
): string | null {
  if (requested && isListenAvailable(content.words, requested)) return requested;
  return content.categories.find((c) => isListenAvailable(content.words, c.id))?.id ?? null;
}

/** Fisher-Yates shuffle into a new array. `random` returns a number in [0, 1). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Three distractors for a target: other imaged words from the target's category.
 * Never includes the target. Returns fewer than three only when the category has too few.
 */
export function pickDistractors(
  words: readonly Word[],
  target: Word,
  random: () => number = Math.random,
  count: number = LISTEN_TILE_COUNT - 1,
): Word[] {
  const pool = imagedWordsInCategory(words, target.category).filter((w) => w.id !== target.id);
  return shuffle(pool, random).slice(0, count);
}

/** The shuffled tiles for one round: the target and its distractors. */
export function buildListenTiles(
  words: readonly Word[],
  target: Word,
  random: () => number = Math.random,
): Word[] {
  return shuffle([target, ...pickDistractors(words, target, random)], random);
}
