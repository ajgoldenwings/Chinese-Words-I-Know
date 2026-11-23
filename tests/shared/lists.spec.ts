import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { applyManualOverride } from '@shared/confidence';
import { loadContent } from '@shared/content';
import type { FrequencyTier, UserWordState, Word } from '@shared/entities';
import { buildWordLists, learnNextScore } from '@shared/lists';
import { APP_STORAGE, AppStore, MemoryStorage } from '@shared/store';
import { MyWordsComponent } from '../../src/web/app/screens/my-words/my-words.component';

function word(id: string, tier: FrequencyTier, category = 'c1'): Word {
  return {
    id,
    simplified: id,
    pinyin: id,
    english: id,
    category,
    imageAsset: null,
    audioAsset: null,
    tags: [],
    frequencyTier: tier,
  };
}

function state(
  wordId: string,
  confidenceScore: number,
  timesSeenCount = 0,
  manualOverride: UserWordState['manualOverride'] = null,
): UserWordState {
  return {
    wordId,
    confidenceScore,
    timesSeenCount,
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    manualOverride,
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'synced',
  };
}

const ids = (ws: Word[]) => ws.map((w) => w.id);

describe('buildWordLists', () => {
  const words = [word('known', 1), word('almost', 1), word('learning', 2), word('fresh', 3)];
  const states = {
    known: state('known', 0.9, 6),
    almost: state('almost', 0.7, 4),
    learning: state('learning', 0.4, 3),
  };

  it('places words in the correct lists', () => {
    const lists = buildWordLists(words, states);
    expect(ids(lists.known)).toEqual(['known']);
    expect(ids(lists.almostThere)).toEqual(['almost']);
    expect(ids(lists.learnNext).sort()).toEqual(['fresh', 'learning']);
  });

  it('puts a word with a "known" override in Known immediately, even at a low score', () => {
    const before = buildWordLists(words, states);
    expect(ids(before.known)).not.toContain('learning');
    const after = buildWordLists(words, {
      ...states,
      learning: applyManualOverride(states.learning, 'known'),
    });
    expect(ids(after.known)).toContain('learning');
    expect(ids(after.learnNext)).not.toContain('learning');
    const lowKnown = buildWordLists(words, { ...states, fresh: state('fresh', 0.1, 0, 'known') });
    expect(ids(lowKnown.known)).toContain('fresh');
    expect(ids(lowKnown.learnNext)).not.toContain('fresh');
  });

  it('Learn Next is in descending score order and excludes words at 0.6 or above', () => {
    const ws = [word('t4', 4), word('t1', 1), word('t3', 3), word('t2', 2), word('edge', 1), word('above', 1)];
    const st = { edge: state('edge', 0.6, 2), above: state('above', 0.95, 6) };
    const lists = buildWordLists(ws, st);
    expect(ids(lists.learnNext)).toEqual(['t1', 't2', 't3', 't4']);
    const scores = lists.learnNext.map((w) => learnNextScore(w, st[w.id as keyof typeof st] ?? null, false));
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(learnNextScore(word('edge', 1), st.edge, false)).toBe(-1);
    expect(ids(lists.almostThere)).toEqual(['edge']);
  });
});

describe('My Words screen lists', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
    });
    const store = TestBed.inject(AppStore);
    const fixture = TestBed.createComponent(MyWordsComponent);
    const el = fixture.nativeElement as HTMLElement;
    const section = (id: string) =>
      Array.from(el.querySelectorAll(`[data-testid="list-${id}"] [data-testid="word-entry"] span.text-lg`)).map(
        (e) => e.textContent!.trim(),
      );
    return { fixture, store, section };
  }

  it('shows words in the matching sections and moves a word to Known on override', () => {
    const { words } = loadContent();
    const [a, b] = words;
    const { fixture, store, section } = setup();
    store.setWordState(state(a.id, 0.7, 4));
    fixture.detectChanges();
    expect(section('almost-there')).toEqual([a.english]);
    expect(section('known')).toEqual([]);
    expect(section('learn-next')).not.toContain(a.english);

    store.setWordState(applyManualOverride(store.getWordState(b.id), 'known'));
    fixture.detectChanges();
    expect(section('known')).toEqual([b.english]);
    expect(section('learn-next')).not.toContain(b.english);
  });
});
