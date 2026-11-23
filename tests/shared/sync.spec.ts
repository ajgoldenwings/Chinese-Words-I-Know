import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserWordState } from '@shared/entities';
import {
  MAX_BATCH_SIZE,
  SyncService,
  fromCloudRecord,
  mergeWordStates,
  toCloudRecord,
  type CloudWordState,
  type SyncStore,
} from '@shared/sync';

const T1 = '2024-01-01T00:00:00.000Z';
const T2 = '2024-01-02T00:00:00.000Z';

function word(id: string, over: Partial<UserWordState> = {}): UserWordState {
  return {
    wordId: id,
    confidenceScore: 0.5,
    timesSeenCount: 1,
    lastSeenAt: T1,
    manualOverride: null,
    updatedAt: T1,
    syncStatus: 'synced',
    ...over,
  };
}

function cloud(id: string, over: Partial<CloudWordState> = {}): CloudWordState {
  return { ...toCloudRecord(word(id)), ...over };
}

function fakeStore(initial: UserWordState[] = [], cloudSyncEnabled = true) {
  let states: Record<string, UserWordState> = Object.fromEntries(initial.map((s) => [s.wordId, s]));
  const store: SyncStore = {
    wordStates: () => states,
    settings: () => ({ cloudSyncEnabled }),
    setWordState: (s) => {
      states = { ...states, [s.wordId]: s };
    },
  };
  return { store, get: () => states };
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe('mergeWordStates', () => {
  it('keeps local and queues a push when local is newer', () => {
    const local = { cat: word('cat', { updatedAt: T2, confidenceScore: 0.9 }) };
    const { merged, toPush } = mergeWordStates(local, [word('cat', { updatedAt: T1 })]);
    expect(merged['cat'].confidenceScore).toBe(0.9);
    expect(merged['cat'].syncStatus).toBe('pending');
    expect(toPush).toEqual(['cat']);
  });

  it('adopts the cloud record when it is newer', () => {
    const local = { cat: word('cat', { updatedAt: T1, syncStatus: 'pending' }) };
    const remote = word('cat', { updatedAt: T2, confidenceScore: 0.8 });
    const { merged, toPush } = mergeWordStates(local, [remote]);
    expect(merged['cat']).toEqual(remote);
    expect(toPush).toEqual([]);
  });

  it('keeps local on equal timestamps', () => {
    const local = { cat: word('cat', { confidenceScore: 0.1 }) };
    const { merged, toPush } = mergeWordStates(local, [word('cat', { confidenceScore: 0.9 })]);
    expect(merged['cat'].confidenceScore).toBe(0.1);
    expect(toPush).toEqual([]);
  });

  it('pushes a record missing from the cloud and adopts one missing locally', () => {
    const local = { cat: word('cat', { syncStatus: 'pending' }) };
    const { merged, toPush } = mergeWordStates(local, [word('dog')]);
    expect(toPush).toEqual(['cat']);
    expect(Object.keys(merged).sort()).toEqual(['cat', 'dog']);
  });

  it('maps "none" to null and null to "none"', () => {
    expect(toCloudRecord(word('cat', { manualOverride: null })).manualOverride).toBe('none');
    expect(toCloudRecord(word('cat', { manualOverride: 'known' })).manualOverride).toBe('known');
    expect(fromCloudRecord(cloud('cat', { manualOverride: 'none' })).manualOverride).toBeNull();
    expect(fromCloudRecord(cloud('cat', { manualOverride: 'unknown' })).manualOverride).toBe('unknown');
    expect(fromCloudRecord(cloud('cat')).syncStatus).toBe('synced');
  });
});

describe('SyncService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make(
    initial: UserWordState[],
    fetchFn: ReturnType<typeof vi.fn>,
    opts: { token?: string | null; enabled?: boolean } = {},
  ) {
    const fs = fakeStore(initial, opts.enabled ?? true);
    const token = opts.token === undefined ? 'tok' : opts.token;
    const service = new SyncService({
      store: fs.store,
      getToken: () => Promise.resolve(token),
      fetch: fetchFn as unknown as typeof fetch,
      apiBaseUrl: 'https://api.test/',
      debounceMs: 5000,
      maxDelayMs: 30000,
    });
    return { fs, service };
  }

  const pending = (id: string, over: Partial<UserWordState> = {}) =>
    word(id, { syncStatus: 'pending', manualOverride: null, ...over });

  it('syncOnLoad fetches with a Bearer token and writes the merged result', async () => {
    const fetchFn = vi.fn(() => jsonResponse({ items: [cloud('dog', { manualOverride: 'none' })] }));
    const { fs, service } = make([], fetchFn);
    await service.syncOnLoad();
    expect(fetchFn).toHaveBeenCalledWith('https://api.test/progress', {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(fs.get()['dog'].manualOverride).toBeNull();
    expect(fs.get()['dog'].syncStatus).toBe('synced');
  });

  it('flush sends pending records with the correct body and token', async () => {
    const fetchFn = vi.fn(() => jsonResponse({ accepted: ['cat'] }));
    const { service } = make([pending('cat'), word('dog')], fetchFn);
    await service.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/progress');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ items: [toCloudRecord(pending('cat'))] });
    expect(JSON.parse(init.body as string).items[0].manualOverride).toBe('none');
  });

  it('flush splits into batches of at most 25', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `w${i}`);
    const fetchFn = vi.fn(() => jsonResponse({ accepted: [] }));
    const { service } = make(ids.map((id) => pending(id)), fetchFn);
    await service.flush();
    const sizes = fetchFn.mock.calls.map(
      (c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string).items.length,
    );
    expect(sizes).toEqual([25, 25, 10]);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_BATCH_SIZE);
  });

  it('marks accepted records synced', async () => {
    const fetchFn = vi.fn(() => jsonResponse({ accepted: ['cat'] }));
    const { fs, service } = make([pending('cat')], fetchFn);
    await service.flush();
    expect(fs.get()['cat'].syncStatus).toBe('synced');
  });

  it('adopts the cloud record when a write is rejected', async () => {
    const current = cloud('cat', { updatedAt: T2, confidenceScore: 0.77, manualOverride: 'known' });
    const fetchFn = vi.fn(() => jsonResponse({ accepted: [], rejected: [{ wordId: 'cat', current }] }));
    const { fs, service } = make([pending('cat')], fetchFn);
    await service.flush();
    expect(fs.get()['cat']).toEqual(fromCloudRecord(current));
    expect(fs.get()['cat'].manualOverride).toBe('known');
  });

  it('keeps records pending and does not throw when the request fails', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('offline')));
    const { fs, service } = make([pending('cat')], fetchFn);
    await expect(service.flush()).resolves.toBeUndefined();
    expect(fs.get()['cat'].syncStatus).toBe('pending');
    service.dispose();
  });

  it('keeps records pending on a non-ok response', async () => {
    const fetchFn = vi.fn(() => jsonResponse({}, false));
    const { fs, service } = make([pending('cat')], fetchFn);
    await expect(service.flush()).resolves.toBeUndefined();
    expect(fs.get()['cat'].syncStatus).toBe('pending');
    service.dispose();
  });

  it('makes no fetch calls without a token', async () => {
    const fetchFn = vi.fn(() => jsonResponse({}));
    const { service } = make([pending('cat')], fetchFn, { token: null });
    await service.syncOnLoad();
    await service.flush();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('makes no fetch calls when cloudSyncEnabled is false', async () => {
    const fetchFn = vi.fn(() => jsonResponse({}));
    const { service } = make([pending('cat')], fetchFn, { enabled: false });
    await service.syncOnLoad();
    await service.flush();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('debounces: flushes once after the quiet period, not before', async () => {
    const fetchFn = vi.fn(() => jsonResponse({ accepted: ['cat'] }));
    const { fs, service } = make([word('cat')], fetchFn);
    service.markDirty('cat');
    expect(fs.get()['cat'].syncStatus).toBe('pending');
    await vi.advanceTimersByTimeAsync(4000);
    service.markDirty('cat');
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fs.get()['cat'].syncStatus).toBe('synced');
  });

  it('flushes by the 30 second maximum even if edits keep coming', async () => {
    const fetchFn = vi.fn(() => jsonResponse({ accepted: ['cat'] }));
    const { service } = make([word('cat')], fetchFn);
    for (let i = 0; i < 8; i++) {
      service.markDirty('cat');
      await vi.advanceTimersByTimeAsync(4000);
    }
    expect(fetchFn).toHaveBeenCalled();
    service.dispose();
  });
});
