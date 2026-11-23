import type { ManualOverride, UserWordState } from '../entities';

/** A word state as the API and DynamoDB represent it. `"none"` stands for no override. */
export interface CloudWordState {
  wordId: string;
  confidenceScore: number;
  timesSeenCount: number;
  lastSeenAt: string;
  manualOverride: 'known' | 'unknown' | 'none';
  updatedAt: string;
}

export function toCloudRecord(state: UserWordState): CloudWordState {
  return {
    wordId: state.wordId,
    confidenceScore: state.confidenceScore,
    timesSeenCount: state.timesSeenCount,
    lastSeenAt: state.lastSeenAt,
    manualOverride: state.manualOverride ?? 'none',
    updatedAt: state.updatedAt,
  };
}

/** Converts an API record to a client record, marked synced. */
export function fromCloudRecord(record: CloudWordState): UserWordState {
  const override: ManualOverride =
    record.manualOverride === 'known' || record.manualOverride === 'unknown' ? record.manualOverride : null;
  return {
    wordId: record.wordId,
    confidenceScore: record.confidenceScore,
    timesSeenCount: record.timesSeenCount,
    lastSeenAt: record.lastSeenAt,
    manualOverride: override,
    updatedAt: record.updatedAt,
    syncStatus: 'synced',
  };
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/** True only when `a` is strictly newer than `b`. */
export function isNewer(a: string, b: string): boolean {
  return time(a) > time(b);
}

export interface MergeResult {
  /** Merged records, keyed by wordId. */
  merged: Record<string, UserWordState>;
  /** Word ids where the local record won and the cloud lacks it or holds an older one. */
  toPush: string[];
}

/**
 * Last-write-wins by `updatedAt`. The cloud wins only when strictly newer;
 * equal timestamps keep the local record. Pure: inputs are not changed.
 */
export function mergeWordStates(
  local: Record<string, UserWordState>,
  cloud: readonly UserWordState[],
): MergeResult {
  const merged: Record<string, UserWordState> = { ...local };
  const toPush: string[] = [];
  const cloudById = new Map(cloud.map((c) => [c.wordId, c]));

  for (const [id, localRecord] of Object.entries(local)) {
    const remote = cloudById.get(id);
    if (!remote) {
      if (localRecord.syncStatus !== 'synced') {
        toPush.push(id);
      } else {
        // Marked synced yet missing in the cloud: push it again.
        merged[id] = { ...localRecord, syncStatus: 'pending' };
        toPush.push(id);
      }
      continue;
    }
    if (isNewer(remote.updatedAt, localRecord.updatedAt)) {
      merged[id] = remote;
    } else if (isNewer(localRecord.updatedAt, remote.updatedAt)) {
      merged[id] = { ...localRecord, syncStatus: 'pending' };
      toPush.push(id);
    } else if (localRecord.syncStatus === 'pending') {
      toPush.push(id);
    }
  }
  for (const remote of cloud) {
    if (!(remote.wordId in local)) {
      merged[remote.wordId] = remote;
    }
  }
  return { merged, toPush };
}
