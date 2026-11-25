import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AppStore, APP_STORAGE, MemoryStorage, STORE_STORAGE_KEY } from '@shared/store';
import { DEFAULT_USER_SETTINGS } from '@shared/entities';

function create(storage = new MemoryStorage()) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: storage }] });
  return { store: TestBed.inject(AppStore), storage };
}

describe('AppStore', () => {
  it('returns defaults for an unseen word', () => {
    const { store } = create();
    expect(store.getWordState('cat')).toMatchObject({
      wordId: 'cat',
      confidenceScore: 0,
      timesSeenCount: 0,
      manualOverride: null,
    });
  });

  it('rounds the score and persists across a simulated reload', () => {
    const first = create();
    first.store.setWordState({ ...first.store.getWordState('cat'), confidenceScore: 0.1 + 0.2, timesSeenCount: 2 });
    const second = create(first.storage);
    expect(second.store.getWordState('cat').confidenceScore).toBe(0.3);
    expect(second.store.getWordState('cat').timesSeenCount).toBe(2);
  });

  it('initializes a fresh store with default settings, no states and no content version', () => {
    const { store } = create();
    expect(store.settings()).toEqual(DEFAULT_USER_SETTINGS);
    expect(store.wordStates()).toEqual({});
    expect(store.lastContentVersion()).toBeNull();
  });

  it('overwrites a word on write and leaves other words alone', () => {
    const { store } = create();
    store.setWordState({ ...store.getWordState('cat'), confidenceScore: 0.4, timesSeenCount: 1 });
    store.setWordState({ ...store.getWordState('dog'), confidenceScore: 0.9 });
    store.setWordState({ ...store.getWordState('cat'), confidenceScore: 0.7, timesSeenCount: 2 });
    expect(store.getWordState('cat')).toMatchObject({ confidenceScore: 0.7, timesSeenCount: 2 });
    expect(store.getWordState('dog').confidenceScore).toBe(0.9);
  });

  it('persists a manual override across a reload', () => {
    const first = create();
    first.store.setWordState({ ...first.store.getWordState('cat'), manualOverride: 'known' });
    const second = create(first.storage);
    expect(second.store.getWordState('cat').manualOverride).toBe('known');
  });

  it('fills missing fields on partial persisted records and ignores bad values', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORE_STORAGE_KEY,
      JSON.stringify({
        wordStates: { cat: { confidenceScore: 0.5 }, bad: 'x' },
        settings: { flashcardShowPinyin: 'yes', showPinyin: 'yes' },
        lastContentVersion: 'nope',
      }),
    );
    const { store } = create(storage);
    expect(store.getWordState('cat')).toMatchObject({ wordId: 'cat', confidenceScore: 0.5, timesSeenCount: 0 });
    expect(store.wordStates()['bad']).toBeUndefined();
    expect(store.settings()).toEqual(DEFAULT_USER_SETTINGS);
    expect(store.lastContentVersion()).toBeNull();
  });

  it('carries settings saved before the split by session type over to both modes', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORE_STORAGE_KEY,
      JSON.stringify({ settings: { showPinyin: true, showCharacters: true, audioEnabled: false, cloudSyncEnabled: true } }),
    );
    expect(create(storage).store.settings()).toEqual({
      flashcardShowPinyin: true,
      flashcardShowCharacters: true,
      flashcardAudio: false,
      listenShowPinyin: true,
      listenShowCharacters: true,
      listenRepeatButton: true, // new, so it starts on
      cloudSyncEnabled: true,
    });
  });
  it('a flag saved under its current name wins over a legacy value', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORE_STORAGE_KEY, JSON.stringify({ settings: { showPinyin: true, listenShowPinyin: false } }));
    const s = create(storage).store.settings();
    expect(s.flashcardShowPinyin).toBe(true);
    expect(s.listenShowPinyin).toBe(false);
  });
  it('keeps working when storage writes throw', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const { store } = create(storage);
    expect(() => store.updateSettings({ flashcardShowPinyin: true })).not.toThrow();
    expect(store.settings().flashcardShowPinyin).toBe(true);
  });

  it('persists settings and falls back to defaults on corrupt data', () => {
    const first = create();
    first.store.updateSettings({ listenShowCharacters: true });
    const second = create(first.storage);
    expect(second.store.settings()).toEqual({ ...DEFAULT_USER_SETTINGS, listenShowCharacters: true });

    const bad = new MemoryStorage();
    bad.setItem(STORE_STORAGE_KEY, '{not json');
    expect(create(bad).store.settings()).toEqual(DEFAULT_USER_SETTINGS);
  });
});
