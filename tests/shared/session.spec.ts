import { describe, expect, it } from 'vitest';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import { getWordDisplay, orderWordsForSession } from '@shared/session';
import { createDefaultWordState } from '@shared/store';
import type { Word } from '@shared/entities';

const w = (id: string, audioAsset: string | null = null) => ({ id, audioAsset }) as unknown as Word;

describe('session logic', () => {
  it('flashcard ✓ is +0.08 and ✗ is -0.12', () => {
    const s = { ...createDefaultWordState('cat'), confidenceScore: 0.5 };
    expect(applyCorrectAnswer(s, 'flashcard').confidenceScore).toBe(0.58);
    expect(applyIncorrectAnswer(s).confidenceScore).toBe(0.38);
  });

  it('orders lowest confidence first, ties in content order, missing state as 0', () => {
    const states = {
      a: { ...createDefaultWordState('a'), confidenceScore: 0.5 },
      c: { ...createDefaultWordState('c'), confidenceScore: 0.2 },
    };
    const ids = orderWordsForSession([w('a'), w('b'), w('c'), w('d')], states).map((x) => x.id);
    expect(ids).toEqual(['b', 'd', 'c', 'a']);
  });

  it('falls back to pinyin when there is no audio and both text settings are off', () => {
    const off = { showPinyin: false, showCharacters: false, audioEnabled: true };
    expect(getWordDisplay(w('x'), off)).toEqual({ showPinyin: true, showCharacters: false });
    expect(getWordDisplay(w('x', 'x'), off).showPinyin).toBe(false);
    expect(getWordDisplay(w('x', 'x'), { ...off, audioEnabled: false }).showPinyin).toBe(true);
    expect(getWordDisplay(w('x'), { ...off, showCharacters: true }).showPinyin).toBe(false);
  });
});
