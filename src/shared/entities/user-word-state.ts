export type ManualOverride = 'known' | 'unknown' | null;

export type SyncStatus = 'synced' | 'pending';

/** Keyed by Word.id (wordId). */
export interface UserWordState {
  wordId: string;
  /** 0.0 to 1.0, rounded to 2 decimals after every update. */
  confidenceScore: number;
  /** Answered prompts where this word was the target. */
  timesSeenCount: number;
  /** ISO 8601: when the word was last practiced. */
  lastSeenAt: string;
  /** `null` means no override on the client; the API and DynamoDB use "none". */
  manualOverride: ManualOverride;
  /** ISO 8601: when this record was last written. Used for cloud conflict resolution. */
  updatedAt: string;
  /** Local only. Never persisted to DynamoDB. */
  syncStatus: SyncStatus;
}
