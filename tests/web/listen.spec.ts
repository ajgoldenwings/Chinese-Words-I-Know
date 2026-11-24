import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import type { Content } from '@shared/content';
import type { Word } from '@shared/entities';
import { APP_STORAGE, AppStore, MemoryStorage, createDefaultWordState } from '@shared/store';
import { ListenComponent } from '../../src/web/app/screens/listen/listen.component';
import { AudioService } from '../../src/web/app/services/audio.service';

const word = (id: string, category: string, imaged: boolean, audio = false): Word => ({
  id,
  simplified: id,
  pinyin: id,
  english: `en-${id}`,
  category,
  imageAsset: imaged ? id : null,
  audioAsset: audio ? id : null,
  tags: [],
  frequencyTier: 1,
});

/** `imaged` animals words (w1 has a recording), one unimaged animal, and one imaged food word. */
const content = (imaged: number): Content => ({
  contentVersion: 1,
  categories: [
    { id: 'animals', name: 'Animals', emoji: '🐾', coverImage: 'x' },
    { id: 'food', name: 'Food', emoji: '🍎', coverImage: 'y' },
  ],
  words: [
    ...Array.from({ length: imaged }, (_, i) => word(`w${i}`, 'animals', true, i === 1)),
    word('noimg', 'animals', false),
    word('rice', 'food', true),
  ],
});

function setup(imaged = 6) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const play = vi.spyOn(TestBed.inject(AudioService), 'play').mockResolvedValue(undefined);
  const store = TestBed.inject(AppStore);
  const fixture = TestBed.createComponent(ListenComponent);
  // Content is read lazily by computed signals, so swapping it before the first render is enough.
  (fixture.componentInstance as unknown as { content: Content }).content = content(imaged);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tiles = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="tile"]'));
  const tile = (id: string) => tiles().find((t) => t.dataset['wordId'] === id)!;
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };
  const score = (id: string) => store.getWordState(id).confidenceScore;
  return { fixture, el, store, navigate, play, tiles, tile, click, score };
}

describe('ListenComponent', () => {
  it('shows 4 distinct tiles from the target category, including the target', () => {
    const { tiles } = setup();
    const ids = tiles().map((t) => t.dataset['wordId']!);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => /^w\d$/.test(id))).toBe(true); // no unimaged or other-category words
    expect(ids).toContain('w0'); // lowest confidence, first in content order
  });

  it('correct tile raises the target by 0.05 and shows a check mark', () => {
    const { el, tile, click, score } = setup();
    click(tile('w0'));
    expect(score('w0')).toBe(0.05);
    expect(el.querySelector('[data-testid="correct-mark"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="next"]')).not.toBeNull();
  });

  it('a wrong tile lowers the target by 0.12, only once per round', () => {
    const { store, tiles, click, score } = setup();
    store.setWordState({ ...createDefaultWordState('w0'), confidenceScore: 0.5 });
    const wrong = tiles().filter((t) => t.dataset['wordId'] !== 'w0');
    click(wrong[0]);
    expect(score('w0')).toBe(0.38);
    expect(score(wrong[0].dataset['wordId']!)).toBe(0); // the distractor is not scored
    click(wrong[1]);
    click(wrong[0]);
    expect(score('w0')).toBe(0.38);
  });

  it('shows the English prompt when the target has no recording', () => {
    const { el, play } = setup();
    expect(el.querySelector('[data-testid="prompt"]')?.textContent?.trim()).toBe('en-w0');
    expect(play).not.toHaveBeenCalled();
  });

  it('plays audio instead of the prompt when a recording exists, and shows the prompt when audio is off', () => {
    const { el, store, fixture, tile, click, play } = setup();
    click(tile('w0'));
    // w0 is now at 0.05, so w1 (score 0, has audio) is the next target.
    click(el.querySelector<HTMLElement>('[data-testid="next"]')!);
    expect(play).toHaveBeenCalledWith('w1', 'slow');
    expect(el.querySelector('[data-testid="prompt"]')).toBeNull();
    store.updateSettings({ audioEnabled: false });
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="prompt"]')?.textContent?.trim()).toBe('en-w1');
  });

  it('plays the pressed word on every press of a wrong tile, including a repeat', () => {
    const { tiles, click, play } = setup();
    // w0 is the target and has no recording. Only w1 has one.
    const wrong = tiles().filter((t) => t.dataset['wordId'] !== 'w0');
    play.mockClear();
    click(wrong[0]);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenLastCalledWith(wrong[0].dataset['wordId'] === 'w1' ? 'w1' : null, 'slow');
    click(wrong[0]);
    expect(play).toHaveBeenCalledTimes(2);
    click(wrong[1]);
    expect(play).toHaveBeenCalledTimes(3);
  });
  it('plays the pressed word for a tile that has a recording', () => {
    const { tiles, click, play } = setup();
    const withAudio = tiles().find((t) => t.dataset['wordId'] === 'w1');
    expect(withAudio).toBeDefined();
    play.mockClear();
    click(withAudio!);
    expect(play).toHaveBeenCalledWith('w1', 'slow');
  });
  it('plays the pressed word on the correct tile, and nothing after the round is solved', () => {
    const { tile, tiles, click, play } = setup();
    play.mockClear();
    click(tile('w0'));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith(null, 'slow');
    click(tiles().find((t) => t.dataset['wordId'] !== 'w0')!); // disabled once solved
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('redirects home when no category has 4 imaged words', () => {
    const { navigate, tiles } = setup(3);
    expect(navigate).toHaveBeenCalledWith('/');
    expect(tiles()).toHaveLength(0);
  });
});
