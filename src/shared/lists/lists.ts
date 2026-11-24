import { ALMOST_THERE_THRESHOLD, isKnown } from '../confidence';
import type { Word, UserWordState } from '../entities';

export const LEARN_NEXT_LIMIT = 20;
/** Almost There shows at most this many words: any score above 0 that is not Known, highest first. */
export const ALMOST_THERE_LIMIT = 10;
/** A category is active when the average confidence of its seen words is above this. */
export const CATEGORY_ACTIVE_THRESHOLD = 0.3;

export interface WordLists {
  known: Word[];
  almostThere: Word[];
  learnNext: Word[];
}

/** Learn Next score, or -1 when the word is not a candidate (score 0.6 or above). */
export function learnNextScore(
  word: Word,
  state: UserWordState | null,
  categoryActive: boolean,
): number {
  const confidence = state?.confidenceScore ?? 0;
  if (confidence >= ALMOST_THERE_THRESHOLD) return -1;
  const frequencyScore = (5 - word.frequencyTier) / 4;
  const momentumScore = categoryActive ? 1.0 : 0.5;
  const gapScore = (ALMOST_THERE_THRESHOLD - confidence) / ALMOST_THERE_THRESHOLD;
  return frequencyScore * 0.5 + momentumScore * 0.3 + gapScore * 0.2;
}

/** Ids of categories whose seen words (timesSeenCount > 0) average above 0.3. Unseen words are ignored. */
export function activeCategoryIds(
  words: readonly Word[],
  wordStates: Readonly<Record<string, UserWordState>>,
): Set<string> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const w of words) {
    const s = wordStates[w.id];
    if (!s || s.timesSeenCount <= 0) continue;
    const t = totals.get(w.category) ?? { sum: 0, count: 0 };
    t.sum += s.confidenceScore;
    t.count += 1;
    totals.set(w.category, t);
  }
  const active = new Set<string>();
  for (const [id, t] of totals) {
    if (t.sum / t.count > CATEGORY_ACTIVE_THRESHOLD) active.add(id);
  }
  return active;
}

/**
 * Builds the three My Words lists. Known is in content order. Almost There is the top 10 words
 * that are not Known and score above 0, by confidence score. Learn Next is the top 20 by Learn Next score.
 * `wordStates` should already exclude orphans (see `activeWordStates`); only words in `words` are listed.
 */
export function buildWordLists(
  words: readonly Word[],
  wordStates: Readonly<Record<string, UserWordState>>,
): WordLists {
  const known: Word[] = [];
  const almost: { word: Word; score: number; order: number }[] = [];
  words.forEach((w, order) => {
    const s = wordStates[w.id];
    if (!s) return;
    if (isKnown(s)) known.push(w);
    // No score threshold: any word with progress (score above 0) that is not Known.
    else if (s.confidenceScore > 0) almost.push({ word: w, score: s.confidenceScore, order });
  });
  // The words nearest to Known: highest score first, content order on ties, then the top 10.
  almost.sort((a, b) => b.score - a.score || a.order - b.order);
  const almostThere = almost.slice(0, ALMOST_THERE_LIMIT).map((x) => x.word);

  const active = activeCategoryIds(words, wordStates);
  const scored: { word: Word; score: number; order: number }[] = [];
  words.forEach((word, order) => {
    const state = wordStates[word.id] ?? null;
    // A "known" override is Known even if its score were ever below 0.6.
    if (state && isKnown(state)) return;
    const score = learnNextScore(word, state, active.has(word.category));
    if (score >= 0) scored.push({ word, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const learnNext = scored.slice(0, LEARN_NEXT_LIMIT).map((x) => x.word);

  return { known, almostThere, learnNext };
}
