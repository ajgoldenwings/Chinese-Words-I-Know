import { getWordState, isKnown } from '../confidence';
import type { UserWordState } from '../entities';

/** The predetermined first session. */
export const FIRST_SESSION_CATEGORY_ID = 'animals';

export interface StartNowContent {
  categories: readonly { id: string }[];
  words: readonly { id: string; category: string }[];
}

/**
 * Prior data means the learner has interacted with at least one word. The content migration
 * seeds a zero state for every word, so a non-empty `wordStates` alone does not count.
 */
export function hasPriorData(wordStates: Readonly<Record<string, UserWordState>>): boolean {
  return Object.values(wordStates).some(
    (s) => s.timesSeenCount > 0 || s.confidenceScore > 0 || s.manualOverride !== null,
  );
}

/**
 * Category for the Start Now flashcard session (ux/first-run.md).
 * First launch: Animals. Returning user, in order:
 * 1. Most words in the Learning state; ties go to the earlier category in content order.
 * 2. No Learning words: first category with a word below Known.
 * 3. Every word Known: first category in content order.
 * Returns null only when the content has no categories.
 */
export function selectStartNowCategory(
  content: StartNowContent,
  wordStates: Readonly<Record<string, UserWordState>>,
): string | null {
  const ids = content.categories.map((c) => c.id);
  if (ids.length === 0) return null;

  if (!hasPriorData(wordStates)) {
    return ids.includes(FIRST_SESSION_CATEGORY_ID) ? FIRST_SESSION_CATEGORY_ID : ids[0];
  }

  const learning = new Map<string, number>();
  const hasUnknown = new Set<string>();
  for (const w of content.words) {
    const s = wordStates[w.id];
    if (s && getWordState(s) === 'learning') {
      learning.set(w.category, (learning.get(w.category) ?? 0) + 1);
    }
    if (!s || !isKnown(s)) hasUnknown.add(w.category);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const id of ids) {
    const n = learning.get(id) ?? 0;
    if (n > bestCount) {
      best = id;
      bestCount = n;
    }
  }
  if (best !== null) return best;

  return ids.find((id) => hasUnknown.has(id)) ?? ids[0];
}
