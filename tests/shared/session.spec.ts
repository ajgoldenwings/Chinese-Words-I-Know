import { describe, expect, it } from 'vitest';
import { applyCorrectAnswer, applyIncorrectAnswer } from '@shared/confidence';
import { flashcardDisplaySettings, getWordDisplay, listenDisplaySettings, pickNextTarget, shufflePass } from '@shared/session';
import { createDefaultWordState } from '@shared/store';
import { seededRandom as seeded } from '../seeded-random';
import { DEFAULT_USER_SETTINGS, type Word } from '@shared/entities';

const w = (id: string, audioAsset: string | null = null) => ({ id, audioAsset }) as unknown as Word;

describe('session logic', () => {
  it('flashcard ✓ is +0.08 and ✗ is -0.12', () => {
    const s = { ...createDefaultWordState('cat'), confidenceScore: 0.5 };
    expect(applyCorrectAnswer(s, 'flashcard').confidenceScore).toBe(0.58);
    expect(applyIncorrectAnswer(s).confidenceScore).toBe(0.38);
  });

  const ws = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => w(id));
  it('a pass contains every word exactly once, in a random order', () => {
    const random = seeded(1);
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const ids = shufflePass(ws, null, random).map((x) => x.id);
      expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      orders.add(ids.join(''));
    }
    expect(orders.size).toBeGreaterThan(20); // not one fixed order
  });
  it('a pass never starts with the word that ended the previous one', () => {
    const random = seeded(2);
    for (let i = 0; i < 200; i++) expect(shufflePass(ws, 'c', random)[0].id).not.toBe('c');
    // A single word has nothing to swap with, so it simply repeats.
    expect(shufflePass([w('a')], 'a', random).map((x) => x.id)).toEqual(['a']);
  });
  it('the next target is random and never the previous one', () => {
    const random = seeded(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = pickNextTarget(ws, 'a', random)!;
      expect(t.id).not.toBe('a');
      seen.add(t.id);
    }
    expect([...seen].sort()).toEqual(['b', 'c', 'd', 'e', 'f']); // every other word gets picked
    expect(pickNextTarget([w('a')], 'a', random)?.id).toBe('a');
    expect(pickNextTarget([], null, random)).toBeNull();
  });

  it('falls back to pinyin when there is no audio and both text settings are off', () => {
    const off = { showPinyin: false, showCharacters: false, audioEnabled: true };
    expect(getWordDisplay(w('x'), off)).toEqual({ showPinyin: true, showCharacters: false });
    expect(getWordDisplay(w('x', 'x'), off).showPinyin).toBe(false);
    expect(getWordDisplay(w('x', 'x'), { ...off, audioEnabled: false }).showPinyin).toBe(true);
    expect(getWordDisplay(w('x'), { ...off, showCharacters: true }).showPinyin).toBe(false);
  });
  it('each mode reads only its own settings', () => {
    const settings = { ...DEFAULT_USER_SETTINGS, flashcardShowPinyin: true, listenShowCharacters: true, flashcardAudio: false };
    expect(flashcardDisplaySettings(settings)).toEqual({ showPinyin: true, showCharacters: false, audioEnabled: false });
    expect(listenDisplaySettings(settings)).toEqual({ showPinyin: false, showCharacters: true, audioEnabled: true });
  });
  it('Listen + Tap audio always counts as on, so its fallback depends only on the word having a recording', () => {
    const settings = { ...DEFAULT_USER_SETTINGS, listenRepeatButton: false };
    expect(getWordDisplay(w('x', 'x'), listenDisplaySettings(settings)).showPinyin).toBe(false);
    expect(getWordDisplay(w('x'), listenDisplaySettings(settings)).showPinyin).toBe(true);
  });
});
