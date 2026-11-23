import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { activeWordStates, AppStore, APP_STORAGE, MemoryStorage, migrateContent } from '@shared/store';

const words = (...ids: string[]) => ids.map((id) => ({ id }));

function create(storage = new MemoryStorage()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: storage }] });
  return { store: TestBed.inject(AppStore), storage };
}

describe('migrateContent', () => {
  it('initializes new words at zero and stores the version', () => {
    const r = migrateContent({ wordStates: {}, lastContentVersion: null }, { contentVersion: 1, words: words('cat') });
    expect(r.migrated).toBe(true);
    expect(r.added).toEqual(['cat']);
    expect(r.wordStates['cat']).toMatchObject({ confidenceScore: 0, timesSeenCount: 0 });
    expect(r.lastContentVersion).toBe(1);
  });

  it('does nothing when the version is unchanged', () => {
    const input = { wordStates: {}, lastContentVersion: 2 };
    const r = migrateContent(input, { contentVersion: 2, words: words('cat') });
    expect(r.migrated).toBe(false);
    expect(r.wordStates).toBe(input.wordStates);
  });

  it('retains removed and renamed-away words, and keeps progress for kept words', () => {
    const { store } = create();
    store.migrateContent({ contentVersion: 1, words: words('cat', 'dog') });
    store.setWordState({ ...store.getWordState('cat'), confidenceScore: 0.6, timesSeenCount: 4 });
    store.setWordState({ ...store.getWordState('dog'), confidenceScore: 0.5, timesSeenCount: 3 });
    const next = { contentVersion: 2, words: words('cat', 'doggy') };
    const r = store.migrateContent(next);
    expect(r.added).toEqual(['doggy']);
    expect(r.orphaned).toEqual(['dog']);
    expect(store.wordStates()['dog'].confidenceScore).toBe(0.5);
    expect(store.wordStates()['cat'].confidenceScore).toBe(0.6);
    expect(store.wordStates()['doggy'].confidenceScore).toBe(0);
    expect(activeWordStates(store.wordStates(), next).map((s) => s.wordId)).toEqual(['cat', 'doggy']);
    expect(store.lastContentVersion()).toBe(2);
  });

  it('leaves progress untouched for a display-field fix (same slugs, new version)', () => {
    const { store } = create();
    store.migrateContent({ contentVersion: 1, words: words('cat') });
    store.setWordState({ ...store.getWordState('cat'), confidenceScore: 0.8, timesSeenCount: 5 });
    const r = store.migrateContent({ contentVersion: 2, words: [{ id: 'cat', pinyin: 'māo' } as { id: string }] });
    expect(r.migrated).toBe(true);
    expect(r.added).toEqual([]);
    expect(r.orphaned).toEqual([]);
    expect(store.getWordState('cat')).toMatchObject({ confidenceScore: 0.8, timesSeenCount: 5 });
    expect(store.lastContentVersion()).toBe(2);
  });

  it('leaves progress untouched when a word moves category (states are keyed by slug)', () => {
    const before = { wordStates: {}, lastContentVersion: null };
    const v1 = migrateContent(before, {
      contentVersion: 1,
      words: [{ id: 'cat', categoryId: 'animals' } as { id: string }],
    });
    v1.wordStates['cat'] = { ...v1.wordStates['cat'], confidenceScore: 0.6, timesSeenCount: 3 };
    const v2 = migrateContent(v1, {
      contentVersion: 2,
      words: [{ id: 'cat', categoryId: 'pets' } as { id: string }],
    });
    expect(v2.added).toEqual([]);
    expect(v2.orphaned).toEqual([]);
    expect(v2.wordStates['cat']).toMatchObject({ confidenceScore: 0.6, timesSeenCount: 3 });
  });

  it('does not mutate its input', () => {
    const input = { wordStates: {}, lastContentVersion: null };
    migrateContent(input, { contentVersion: 1, words: words('cat') });
    expect(input.wordStates).toEqual({});
  });

  it('ignores an older content version', () => {
    const r = migrateContent({ wordStates: {}, lastContentVersion: 5 }, { contentVersion: 4, words: words('cat') });
    expect(r.migrated).toBe(false);
    expect(r.lastContentVersion).toBe(5);
  });

  it('persists lastContentVersion across a reload', () => {
    const first = create();
    first.store.migrateContent({ contentVersion: 3, words: words('cat') });
    const second = create(first.storage);
    expect(second.store.lastContentVersion()).toBe(3);
  });
});
