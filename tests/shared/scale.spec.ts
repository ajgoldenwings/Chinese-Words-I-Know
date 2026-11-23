import { describe, expect, it } from 'vitest';
import { loadContent, parseContent, selectStartNowCategory } from '@shared/content';
import type { Category, UserWordState, Word } from '@shared/entities';
import { buildWordLists } from '@shared/lists';
import { orderWordsForSession } from '@shared/session';
import { activeWordStates, migrateContent } from '@shared/store';

// Generous bounds: they catch accidental O(n^2) work, not small slowdowns.
const BOUND_MS = 1000;

function letters(n: number): string {
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function synthetic(wordCount: number, categoryCount = 40) {
  const categories: Category[] = Array.from({ length: categoryCount }, (_, i) => ({
    id: `cat-${letters(i)}`,
    name: `Category ${i}`,
    emoji: '🀄',
    coverImage: `cat-${letters(i)}`,
  }));
  const words: Word[] = Array.from({ length: wordCount }, (_, i) => ({
    id: `word-${letters(i)}`,
    simplified: '字',
    pinyin: 'zi',
    english: `word ${i}`,
    category: categories[i % categoryCount].id,
    imageAsset: null,
    audioAsset: null,
    tags: [],
    frequencyTier: ((i % 4) + 1) as 1 | 2 | 3 | 4,
  }));
  return { contentVersion: 1, words, categories };
}

function states(words: Word[]): Record<string, UserWordState> {
  const out: Record<string, UserWordState> = {};
  words.forEach((w, i) => {
    out[w.id] = {
      wordId: w.id,
      confidenceScore: (i % 20) / 20,
      timesSeenCount: i % 7,
      lastSeenAt: '',
      manualOverride: null,
      updatedAt: '',
      syncStatus: 'pending',
    };
  });
  return out;
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('scale', () => {
  const datasets: [string, ReturnType<typeof synthetic> | ReturnType<typeof loadContent>][] = [
    ['bundled content', loadContent()],
    ['synthetic 1000 words', synthetic(1000)],
    ['synthetic 5000 words', synthetic(5000)],
  ];

  it('loadContent returns the same parsed object on every call', () => {
    expect(loadContent()).toBe(loadContent());
  });

  it('bundled content is the full dataset', () => {
    expect(loadContent().words.length).toBeGreaterThanOrEqual(141);
  });

  for (const [name, content] of datasets) {
    it(`handles ${name} within the time bound`, () => {
      const wordStates = states(content.words);
      const firstCategory = content.categories[0].id;
      const inCategory = content.words.filter((w) => w.category === firstCategory);

      expect(time(() => parseContent({ contentVersion: content.contentVersion, words: content.words }, { contentVersion: content.contentVersion, categories: content.categories }))).toBeLessThan(BOUND_MS);
      expect(time(() => migrateContent({ wordStates: {}, lastContentVersion: null }, content))).toBeLessThan(BOUND_MS);
      expect(time(() => migrateContent({ wordStates, lastContentVersion: 0 }, content))).toBeLessThan(BOUND_MS);
      expect(time(() => buildWordLists(content.words, activeWordStates(wordStates, content).reduce<Record<string, UserWordState>>((m, s) => ((m[s.wordId] = s), m), {})))).toBeLessThan(BOUND_MS);
      expect(time(() => orderWordsForSession(inCategory, wordStates))).toBeLessThan(BOUND_MS);
      expect(time(() => orderWordsForSession(content.words, wordStates))).toBeLessThan(BOUND_MS);
      expect(time(() => selectStartNowCategory(content, wordStates))).toBeLessThan(BOUND_MS);
    });
  }

  it('lists stay correct and capped at 1000 words', () => {
    const c = synthetic(1000);
    const lists = buildWordLists(c.words, states(c.words));
    expect(lists.learnNext.length).toBe(20);
    expect(lists.known.length + lists.almostThere.length).toBeGreaterThan(0);
  });
});
