import { describe, expect, it } from 'vitest';
import type { UserWordState } from '@shared/entities';
import {
  applyCorrectAnswer,
  applyIncorrectAnswer,
  applyManualOverride,
  getWordState,
  isAlmostThere,
  isKnown,
} from '@shared/confidence';

const NOW = '2025-01-01T00:00:00.000Z';

function make(overrides: Partial<UserWordState> = {}): UserWordState {
  return {
    wordId: 'w1',
    confidenceScore: 0,
    timesSeenCount: 0,
    lastSeenAt: '',
    manualOverride: null,
    updatedAt: '',
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('score transitions', () => {
  it('flashcard correct adds 0.08', () => {
    expect(applyCorrectAnswer(make({ confidenceScore: 0.3 }), 'flashcard', NOW).confidenceScore).toBe(0.38);
  });

  it('listening correct adds 0.05', () => {
    expect(applyCorrectAnswer(make({ confidenceScore: 0.3 }), 'listening', NOW).confidenceScore).toBe(0.35);
  });

  it('incorrect subtracts 0.12', () => {
    expect(applyIncorrectAnswer(make({ confidenceScore: 0.5 }), NOW).confidenceScore).toBe(0.38);
  });

  it('clamps at 0 on incorrect', () => {
    expect(applyIncorrectAnswer(make({ confidenceScore: 0.05 }), NOW).confidenceScore).toBe(0);
  });

  it('clamps at 1 on correct', () => {
    expect(applyCorrectAnswer(make({ confidenceScore: 0.97 }), 'flashcard', NOW).confidenceScore).toBe(1);
    expect(applyCorrectAnswer(make({ confidenceScore: 1 }), 'listening', NOW).confidenceScore).toBe(1);
  });

  it('every answer increments timesSeenCount, sets timestamps and marks pending', () => {
    const c = applyCorrectAnswer(make({ timesSeenCount: 2 }), 'listening', NOW);
    const w = applyIncorrectAnswer(make({ timesSeenCount: 2 }), NOW);
    for (const s of [c, w]) {
      expect(s.timesSeenCount).toBe(3);
      expect(s.lastSeenAt).toBe(NOW);
      expect(s.updatedAt).toBe(NOW);
      expect(s.syncStatus).toBe('pending');
    }
  });

  it('does not mutate its input', () => {
    const s = make({ confidenceScore: 0.5 });
    applyCorrectAnswer(s, 'flashcard', NOW);
    expect(s.confidenceScore).toBe(0.5);
    expect(s.timesSeenCount).toBe(0);
  });

  it('11 correct flashcard answers from 0 give exactly 0.88', () => {
    let s = make();
    for (let i = 0; i < 11; i++) s = applyCorrectAnswer(s, 'flashcard', NOW);
    expect(s.confidenceScore).toBe(0.88);
  });

  it('repeated listening steps do not drift', () => {
    let s = make();
    for (let i = 0; i < 17; i++) s = applyCorrectAnswer(s, 'listening', NOW);
    expect(s.confidenceScore).toBe(0.85);
  });
});

describe('band boundaries', () => {
  const band = (confidenceScore: number) => getWordState(make({ confidenceScore }));

  it('lower bounds are inclusive', () => {
    expect(band(0)).toBe('new');
    expect(band(0.3)).toBe('learning');
    expect(band(0.6)).toBe('almost-there');
    expect(band(0.85)).toBe('known');
    expect(band(1)).toBe('known');
  });

  it('upper bounds are exclusive', () => {
    expect(band(0.29)).toBe('new');
    expect(band(0.59)).toBe('learning');
    expect(band(0.84)).toBe('almost-there');
  });
});

describe('list membership', () => {
  it('score >= 0.85 needs 5 answered prompts to be Known', () => {
    expect(isKnown(make({ confidenceScore: 0.88, timesSeenCount: 4 }))).toBe(false);
    expect(isKnown(make({ confidenceScore: 0.88, timesSeenCount: 5 }))).toBe(true);
    expect(isKnown(make({ confidenceScore: 0.84, timesSeenCount: 9 }))).toBe(false);
  });

  it('Almost There is score >= 0.6 and not Known', () => {
    expect(isAlmostThere(make({ confidenceScore: 0.59 }))).toBe(false);
    expect(isAlmostThere(make({ confidenceScore: 0.6 }))).toBe(true);
    expect(isAlmostThere(make({ confidenceScore: 0.9, timesSeenCount: 2 }))).toBe(true);
    expect(isAlmostThere(make({ confidenceScore: 0.9, timesSeenCount: 5 }))).toBe(false);
  });
});

describe('manual overrides', () => {
  it('"known" sets 0.9 and lists the word as Known with timesSeenCount below 5', () => {
    const s = applyManualOverride(make({ timesSeenCount: 1 }), 'known', NOW);
    expect(s.confidenceScore).toBe(0.9);
    expect(s.manualOverride).toBe('known');
    expect(s.timesSeenCount).toBe(1);
    expect(isKnown(s)).toBe(true);
    expect(isAlmostThere(s)).toBe(false);
  });

  it('"unknown" sets 0.1 and the word is not Known', () => {
    const s = applyManualOverride(make({ confidenceScore: 0.95, timesSeenCount: 8 }), 'unknown', NOW);
    expect(s.confidenceScore).toBe(0.1);
    expect(s.manualOverride).toBe('unknown');
    expect(isKnown(s)).toBe(false);
  });

  it('a correct answer keeps a "known" override and raises the score', () => {
    const s = applyCorrectAnswer(applyManualOverride(make(), 'known', NOW), 'flashcard', NOW);
    expect(s.manualOverride).toBe('known');
    expect(s.confidenceScore).toBe(0.98);
    expect(isKnown(s)).toBe(true);
  });

  it('a wrong answer clears a "known" override and the standard rule applies', () => {
    const s = applyIncorrectAnswer(applyManualOverride(make(), 'known', NOW), NOW);
    expect(s.manualOverride).toBeNull();
    expect(s.confidenceScore).toBe(0.78);
    expect(isKnown(s)).toBe(false);
    expect(isAlmostThere(s)).toBe(true);
  });

  it('the next answer of any kind clears an "unknown" override', () => {
    const base = applyManualOverride(make(), 'unknown', NOW);
    const right = applyCorrectAnswer(base, 'flashcard', NOW);
    const listen = applyCorrectAnswer(base, 'listening', NOW);
    const wrong = applyIncorrectAnswer(base, NOW);
    expect(right.manualOverride).toBeNull();
    expect(right.confidenceScore).toBe(0.18);
    expect(listen.manualOverride).toBeNull();
    expect(listen.confidenceScore).toBe(0.15);
    expect(wrong.manualOverride).toBeNull();
    expect(wrong.confidenceScore).toBe(0);
  });
});
