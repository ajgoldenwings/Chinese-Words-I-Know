import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { applyManualOverride, confidenceLabel } from '@shared/confidence';
import { loadContent } from '@shared/content';
import type { FrequencyTier, UserWordState, Word } from '@shared/entities';
import { ALMOST_THERE_LIMIT, buildWordLists, learnNextScore } from '@shared/lists';
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
    // Any score above 0 that is not Known, highest first. 'fresh' has no progress.
    expect(ids(lists.almostThere)).toEqual(['almost', 'learning']);
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

describe('Almost There', () => {
  it('is the top 10 by confidence, highest first, with content order on ties', () => {
    const ws = Array.from({ length: 14 }, (_, i) => word(`w${i}`, 1));
    // Scores from 0.60 to 0.84 in content order; w13 and w12 are the highest. The cap applies to any score.
    const st = Object.fromEntries(ws.map((w, i) => [w.id, state(w.id, Math.round((0.6 + i * 0.018) * 100) / 100, 2)]));
    st['w0'] = state('w0', 0.84, 2); // ties with w13 and comes first in content order
    const lists = buildWordLists(ws, st);
    expect(lists.almostThere).toHaveLength(ALMOST_THERE_LIMIT);
    expect(ids(lists.almostThere).slice(0, 3)).toEqual(['w0', 'w13', 'w12']);
    const scores = lists.almostThere.map((w) => st[w.id].confidenceScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(ids(lists.almostThere)).not.toContain('w1'); // the lowest are left out
  });
  it('ignores the 0.6 threshold: any score above 0 counts, 0 and Known do not', () => {
    const ws = [word('a', 1), word('b', 1), word('c', 1), word('zero', 1), word('known', 1), word('low', 1)];
    const lists = buildWordLists(ws, {
      a: state('a', 0.7, 1),
      b: state('b', 0.3, 1),
      c: state('c', 0.05, 1),
      zero: state('zero', 0, 3), // seen but no progress
      known: state('known', 0.9, 6),
      low: state('low', 0.1, 0, 'known'), // a "known" override is Known
    });
    expect(ids(lists.almostThere)).toEqual(['a', 'b', 'c']);
  });
});
describe('confidenceLabel', () => {
  it('uses the labels from the confidence model, by score band', () => {
    expect(confidenceLabel(state('x', 0))).toBe('New');
    expect(confidenceLabel(state('x', 0.3))).toBe('Learning');
    expect(confidenceLabel(state('x', 0.6))).toBe('Almost There');
    expect(confidenceLabel(state('x', 0.85))).toBe('I Know This');
    expect(confidenceLabel(state('x', 1))).toBe('I Know This');
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

    const labels = () =>
      Array.from(fixture.nativeElement.querySelectorAll('[data-testid="confidence-label"]')).map((e) =>
        (e as HTMLElement).textContent!.trim(),
      );
    expect(labels()).toEqual(['Almost There']);
    store.setWordState(applyManualOverride(store.getWordState(b.id), 'known'));
    fixture.detectChanges();
    expect(section('known')).toEqual([b.english]);
    expect(section('learn-next')).not.toContain(b.english);
  });
});
describe('My Words Almost There labels', () => {
  it('lists any word above 0 that is not Known, labels each with its confidence state, and labels no other list', () => {
    const { words } = loadContent();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
    });
    const store = TestBed.inject(AppStore);
    // 0.9 with only 2 answers is not Known yet, so it stays in Almost There with the "I Know This" label.
    store.setWordState(state(words[0].id, 0.65, 2));
    store.setWordState(state(words[1].id, 0.9, 2));
    store.setWordState(state(words[2].id, 0.95, 6)); // Known
    store.setWordState(state(words[3].id, 0.4, 3));
    store.setWordState(state(words[4].id, 0.08, 1));
    store.setWordState(state(words[5].id, 0, 2)); // no progress: not listed
    const fixture = TestBed.createComponent(MyWordsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const entries = Array.from(el.querySelectorAll('[data-testid="list-almost-there"] [data-testid="word-entry"]'));
    expect(entries.map((e) => e.querySelector('span.text-lg')!.textContent!.trim())).toEqual([
      words[1].english,
      words[0].english,
      words[3].english,
      words[4].english,
    ]);
    expect(entries.map((e) => e.querySelector('[data-testid="confidence-label"]')!.textContent!.trim())).toEqual([
      'I Know This',
      'Almost There',
      'Learning',
      'New',
    ]);
    expect(el.querySelector('[data-testid="list-known"] [data-testid="confidence-label"]')).toBeNull();
    expect(el.querySelector('[data-testid="list-learn-next"] [data-testid="confidence-label"]')).toBeNull();
  });
});
