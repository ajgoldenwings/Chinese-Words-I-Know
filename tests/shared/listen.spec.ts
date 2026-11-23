import { describe, expect, it } from 'vitest';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import type { Word } from '@shared/entities';
import {
  buildListenTiles,
  isListenAvailable,
  pickDistractors,
  selectListenCategory,
} from '@shared/session';
import { createDefaultWordState } from '@shared/store';

const word = (id: string, category: string, imageAsset: string | null = id): Word =>
  ({ id, category, imageAsset, audioAsset: null, english: id }) as unknown as Word;

const cats = ['a', 'b'];
const words: Word[] = [
  ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => word(id, 'a')),
  word('a6', 'a', null),
  ...['b1', 'b2', 'b3'].map((id) => word(id, 'b')),
  word('b4', 'b', null),
];

describe('listen + tap scoring', () => {
  it('correct tile adds 0.05 and a wrong tile subtracts 0.12', () => {
    const s = { ...createDefaultWordState('a1'), confidenceScore: 0.5 };
    expect(applyCorrectAnswer(s, 'listening').confidenceScore).toBe(0.55);
    expect(applyIncorrectAnswer(s).confidenceScore).toBe(0.38);
  });
});

describe('listen + tap distractors and tiles', () => {
  it('never include the target and come from the same category, imaged only', () => {
    for (const target of words.filter((w) => w.category === 'a' && w.imageAsset)) {
      for (let i = 0; i < 20; i++) {
        const d = pickDistractors(words, target);
        expect(d).toHaveLength(3);
        expect(d.map((x) => x.id)).not.toContain(target.id);
        expect(new Set(d.map((x) => x.id)).size).toBe(3);
        expect(d.every((x) => x.category === 'a' && x.imageAsset)).toBe(true);
      }
    }
  });

  it('builds 4 tiles that contain the target exactly once', () => {
    const target = words[0];
    const tiles = buildListenTiles(words, target);
    expect(tiles).toHaveLength(4);
    expect(tiles.filter((t) => t.id === target.id)).toHaveLength(1);
  });
});

describe('listen + tap availability', () => {
  it('needs at least 4 imaged words in the category', () => {
    expect(isListenAvailable(words, 'a')).toBe(true);
    expect(isListenAvailable(words, 'b')).toBe(false); // 3 imaged + 1 without image
  });

  it('falls back to a qualifying category, or null when none qualifies', () => {
    const content = { categories: cats.map((id) => ({ id })), words };
    expect(selectListenCategory(content, 'b')).toBe('a');
    expect(selectListenCategory(content, 'a')).toBe('a');
    expect(selectListenCategory({ ...content, words: words.filter((w) => w.category === 'b') }, null)).toBeNull();
  });
});
