import type { UserWordState } from '../entities';

/** The subset of content the migration needs. `Content` satisfies it. */
export interface MigrationContent {
  contentVersion: number;
  words: readonly { id: string }[];
}

export interface MigrationInput {
  wordStates: Record<string, UserWordState>;
  lastContentVersion: number | null;
}

export interface MigrationResult {
  /** False when no migration was needed; `wordStates` is then the input object. */
  migrated: boolean;
  wordStates: Record<string, UserWordState>;
  lastContentVersion: number | null;
  /** Slugs that got a fresh state. */
  added: string[];
  /** Slugs whose state is retained but no longer in the content. Excluded from UI queries. */
  orphaned: string[];
}

function zeroState(wordId: string): UserWordState {
  return {
    wordId,
    confidenceScore: 0,
    timesSeenCount: 0,
    lastSeenAt: '',
    manualOverride: null,
    updatedAt: '',
    syncStatus: 'pending',
  };
}

/**
 * Runs the content-versioning migration. Pure: returns a new result and never mutates the input.
 *
 * - New slug: state initialized at score 0, seen 0.
 * - Removed slug (including a rename's old slug): state retained, reported as orphaned.
 * - Display-field fixes and category moves: nothing to do, states are keyed by slug only.
 *
 * Runs only when `contentVersion` is higher than `lastContentVersion` (or none is stored).
 */
export function migrateContent(input: MigrationInput, content: MigrationContent): MigrationResult {
  const { lastContentVersion } = input;
  if (lastContentVersion !== null && content.contentVersion <= lastContentVersion) {
    return {
      migrated: false,
      wordStates: input.wordStates,
      lastContentVersion,
      added: [],
      orphaned: [],
    };
  }
  const wordStates = { ...input.wordStates };
  const added: string[] = [];
  const ids = new Set<string>();
  for (const { id } of content.words) {
    ids.add(id);
    if (!(id in wordStates)) {
      wordStates[id] = zeroState(id);
      added.push(id);
    }
  }
  const orphaned = Object.keys(wordStates).filter((id) => !ids.has(id));
  return {
    migrated: true,
    wordStates,
    lastContentVersion: content.contentVersion,
    added,
    orphaned,
  };
}

/** Word states for words in the content only. Orphaned records never reach scores or lists. */
export function activeWordStates(
  wordStates: Record<string, UserWordState>,
  content: MigrationContent,
): UserWordState[] {
  const out: UserWordState[] = [];
  for (const { id } of content.words) {
    const s = wordStates[id];
    if (s) out.push(s);
  }
  return out;
}
