import { describe, expect, it } from 'vitest';
import { selectStartNowCategory, selectStartNowTarget } from '@shared/content';
import type { Word } from '@shared/entities';
import { createDefaultWordState } from '@shared/store';
import type { UserWordState } from '@shared/entities';

const content = {
  categories: [{ id: 'colors' }, { id: 'animals' }, { id: 'food' }],
  words: [
    { id: 'red', category: 'colors' },
    { id: 'cat', category: 'animals' },
    { id: 'dog', category: 'animals' },
    { id: 'rice', category: 'food' },
    { id: 'egg', category: 'food' },
  ],
};

function states(scores: Record<string, number>, seen = 6): Record<string, UserWordState> {
  const out: Record<string, UserWordState> = {};
  for (const w of content.words) out[w.id] = createDefaultWordState(w.id);
  for (const [id, confidenceScore] of Object.entries(scores)) {
    out[id] = { ...out[id], confidenceScore, timesSeenCount: seen };
  }
  return out;
}

describe('selectStartNowCategory', () => {
  it('first launch picks animals even when it is not first in content order', () => {
    expect(selectStartNowCategory(content, {})).toBe('animals');
    expect(selectStartNowCategory(content, states({}))).toBe('animals');
  });

  it('picks the category with the most Learning words', () => {
    expect(selectStartNowCategory(content, states({ rice: 0.4, egg: 0.5, red: 0.4 }))).toBe('food');
  });

  it('breaks Learning ties by content order', () => {
    expect(selectStartNowCategory(content, states({ red: 0.4, cat: 0.4, rice: 0.4 }))).toBe('colors');
  });

  it('with no Learning words, picks the first category with a word below Known', () => {
    expect(selectStartNowCategory(content, states({ red: 0.9, cat: 0.9, dog: 0.1 }))).toBe('animals');
  });

  it('with every word Known, picks the first category in content order', () => {
    const all = Object.fromEntries(content.words.map((w) => [w.id, 0.9]));
    expect(selectStartNowCategory(content, states(all))).toBe('colors');
  });
});

describe('selectStartNowTarget', () => {
  const full = {
    categories: content.categories,
    words: content.words.map((w) => ({ ...w, frequencyTier: 1 }) as unknown as Word),
  };
  it('first launch opens the Animals flashcards, not Learn Next', () => {
    expect(selectStartNowTarget(full, {})).toEqual({ kind: 'category', categoryId: 'animals' });
    expect(selectStartNowTarget(full, states({}))).toEqual({ kind: 'category', categoryId: 'animals' });
  });
  it('a returning user gets the Learn Next session', () => {
    expect(selectStartNowTarget(full, states({ rice: 0.4 }))).toEqual({ kind: 'learn-next' });
  });
  it('falls back to the recommended category when Learn Next is empty', () => {
    const all = Object.fromEntries(content.words.map((w) => [w.id, 0.9]));
    expect(selectStartNowTarget(full, states({ ...all, egg: 0.7 }))).toEqual({ kind: 'category', categoryId: 'food' });
  });
  it('returns null without categories', () => {
    expect(selectStartNowTarget({ categories: [], words: [] }, {})).toBeNull();
  });
});
