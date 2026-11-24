import type { UserWordState } from '../entities';

export type AnswerType = 'flashcard' | 'listening';
export type OverrideDirection = 'known' | 'unknown';
export type WordStateBand = 'new' | 'learning' | 'almost-there' | 'known';

export const CORRECT_DELTA: Record<AnswerType, number> = {
  flashcard: 0.08,
  listening: 0.05,
};
export const INCORRECT_DELTA = -0.12;
export const KNOWN_OVERRIDE_SCORE = 0.9;
export const UNKNOWN_OVERRIDE_SCORE = 0.1;
export const LEARNING_THRESHOLD = 0.3;
export const ALMOST_THERE_THRESHOLD = 0.6;
export const KNOWN_THRESHOLD = 0.85;
export const KNOWN_MIN_TIMES_SEEN = 5;

/** Clamps to [0, 1] and rounds to 2 decimals so repeated steps never drift. */
export function normalizeScore(score: number): number {
  const clamped = Math.min(1, Math.max(0, score));
  return Math.round(clamped * 100) / 100;
}

function touch(state: UserWordState, now?: string): Pick<UserWordState, 'lastSeenAt' | 'updatedAt'> {
  const stamp = now ?? new Date().toISOString();
  return { lastSeenAt: stamp, updatedAt: stamp };
}

/**
 * Correct answer on a target word. Raises the score and counts the word as seen.
 * A "known" override stays; an "unknown" override is cleared.
 */
export function applyCorrectAnswer(
  state: UserWordState,
  type: AnswerType,
  now?: string,
): UserWordState {
  return {
    ...state,
    confidenceScore: normalizeScore(state.confidenceScore + CORRECT_DELTA[type]),
    timesSeenCount: state.timesSeenCount + 1,
    manualOverride: state.manualOverride === 'known' ? 'known' : null,
    ...touch(state, now),
    syncStatus: 'pending',
  };
}

/** Incorrect answer on a target word. Lowers the score and clears any override. */
export function applyIncorrectAnswer(state: UserWordState, now?: string): UserWordState {
  return {
    ...state,
    confidenceScore: normalizeScore(state.confidenceScore + INCORRECT_DELTA),
    timesSeenCount: state.timesSeenCount + 1,
    manualOverride: null,
    ...touch(state, now),
    syncStatus: 'pending',
  };
}

/** Parent override. Does not change `timesSeenCount` or `lastSeenAt`. */
export function applyManualOverride(
  state: UserWordState,
  direction: OverrideDirection,
  now?: string,
): UserWordState {
  return {
    ...state,
    confidenceScore: direction === 'known' ? KNOWN_OVERRIDE_SCORE : UNKNOWN_OVERRIDE_SCORE,
    manualOverride: direction,
    updatedAt: now ?? new Date().toISOString(),
    syncStatus: 'pending',
  };
}

/** Score band only. Lower bound inclusive, upper bound exclusive; 1.00 is Known. */
export function getWordState(state: UserWordState): WordStateBand {
  const score = state.confidenceScore;
  if (score >= KNOWN_THRESHOLD) return 'known';
  if (score >= ALMOST_THERE_THRESHOLD) return 'almost-there';
  if (score >= LEARNING_THRESHOLD) return 'learning';
  return 'new';
}

/** Confidence state labels from core/confidence-model.md, by score band. */
export const CONFIDENCE_LABELS: Record<WordStateBand, string> = {
  new: 'New',
  learning: 'Learning',
  'almost-there': 'Almost There',
  known: 'I Know This',
};
/** The confidence state label for a word's score, e.g. "Almost There". */
export function confidenceLabel(state: UserWordState): string {
  return CONFIDENCE_LABELS[getWordState(state)];
}
/** Words I Know list: "known" override, or score >= 0.85 with at least 5 answered prompts. */
export function isKnown(state: UserWordState): boolean {
  return (
    state.manualOverride === 'known' ||
    (state.confidenceScore >= KNOWN_THRESHOLD && state.timesSeenCount >= KNOWN_MIN_TIMES_SEEN)
  );
}

/** Almost There list: score >= 0.6 and not Known. */
export function isAlmostThere(state: UserWordState): boolean {
  return state.confidenceScore >= ALMOST_THERE_THRESHOLD && !isKnown(state);
}
