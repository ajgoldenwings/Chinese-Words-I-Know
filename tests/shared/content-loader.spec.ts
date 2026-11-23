import { describe, expect, it } from 'vitest';
import {
  ContentValidationError,
  loadContent,
  parseCategories,
  parseContent,
  parseWords,
} from '@shared/content';
import wordsJson from '../../src/shared/content/words.json';
import categoriesJson from '../../src/shared/content/categories.json';

const SLUG = /^[a-z]+(-[a-z]+)*$/;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('content loader: seed content', () => {
  const content = loadContent();

  it('parses the full word list (11 categories, 141 words)', () => {
    expect(content.categories).toHaveLength(11);
    expect(content.words).toHaveLength(141);
    expect(content.contentVersion).toBe(4);
  });

  it('every word satisfies the type contract', () => {
    for (const w of content.words) {
      for (const key of ['id', 'simplified', 'pinyin', 'english', 'category'] as const) {
        expect(typeof w[key]).toBe('string');
        expect(w[key].length).toBeGreaterThan(0);
      }
      expect(Array.isArray(w.tags)).toBe(true);
      expect(w.tags.every((t) => typeof t === 'string')).toBe(true);
      expect(w.imageAsset === null || typeof w.imageAsset === 'string').toBe(true);
      expect(w.audioAsset === null || typeof w.audioAsset === 'string').toBe(true);
    }
  });

  it('every word belongs to a loaded category', () => {
    const ids = new Set(content.categories.map((c) => c.id));
    expect(content.words.every((w) => ids.has(w.category))).toBe(true);
  });

  it('every slug is unique and valid', () => {
    const ids = content.words.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SLUG);
  });

  it('every word has a frequencyTier of 1 to 4', () => {
    for (const w of content.words) expect([1, 2, 3, 4]).toContain(w.frequencyTier);
  });

  it('null asset fields cause no errors', () => {
    expect(content.words.every((w) => w.imageAsset === w.id && w.audioAsset === w.id)).toBe(true);
    expect(() => loadContent()).not.toThrow();
  });
});

describe('content loader: malformed data', () => {
  const word = () => clone(wordsJson.words[0]);
  const wrap = (words: unknown[]) => ({ contentVersion: 1, words });

  it('accepts a word with null assets', () => {
    expect(() => parseWords(wrap([{ ...word(), imageAsset: null, audioAsset: null }]))).not.toThrow();
  });

  it('rejects non-object roots', () => {
    expect(() => parseWords(null)).toThrow(ContentValidationError);
    expect(() => parseWords([])).toThrow(ContentValidationError);
    expect(() => parseCategories('x')).toThrow(ContentValidationError);
  });

  it('rejects a bad contentVersion', () => {
    expect(() => parseWords({ contentVersion: 0, words: [] })).toThrow(ContentValidationError);
    expect(() => parseWords({ words: [] })).toThrow(ContentValidationError);
  });

  it('rejects a missing words array', () => {
    expect(() => parseWords({ contentVersion: 1 })).toThrow(ContentValidationError);
  });

  it('rejects a missing required field', () => {
    const w: Record<string, unknown> = word();
    delete w['english'];
    expect(() => parseWords(wrap([w]))).toThrow(ContentValidationError);
  });

  it('rejects an invalid slug', () => {
    for (const id of ['Mao', 'mao2', 'mao_x', '-mao', 'mao--x', '']) {
      expect(() => parseWords(wrap([{ ...word(), id }]))).toThrow(ContentValidationError);
    }
  });

  it('rejects duplicate slugs', () => {
    expect(() => parseWords(wrap([word(), word()]))).toThrow(ContentValidationError);
  });

  it('rejects a missing or out-of-range frequencyTier', () => {
    const w: Record<string, unknown> = word();
    delete w['frequencyTier'];
    expect(() => parseWords(wrap([w]))).toThrow(ContentValidationError);
    expect(() => parseWords(wrap([{ ...word(), frequencyTier: 5 }]))).toThrow(ContentValidationError);
  });

  it('rejects wrongly typed assets and tags', () => {
    expect(() => parseWords(wrap([{ ...word(), audioAsset: 3 }]))).toThrow(ContentValidationError);
    expect(() => parseWords(wrap([{ ...word(), tags: [1] }]))).toThrow(ContentValidationError);
  });

  it('rejects an unknown category and mismatched versions', () => {
    expect(() =>
      parseContent(wrap([{ ...word(), category: 'nope' }]), clone(categoriesJson)),
    ).toThrow(ContentValidationError);
    expect(() =>
      parseContent(clone(wordsJson), { ...clone(categoriesJson), contentVersion: 5 }),
    ).toThrow(ContentValidationError);
  });
});
