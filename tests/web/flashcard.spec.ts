import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '@shared/content';
import { APP_STORAGE, AppStore, MemoryStorage, createDefaultWordState } from '@shared/store';
import { AudioService } from '../../src/web/app/services/audio.service';
import { CARD_AUDIO_MAX_WAIT_MS, FlashcardComponent } from '../../src/web/app/screens/flashcard/flashcard.component';

@Component({ template: 'home' })
class HomeStub {}

const words = loadContent().words.filter((w) => w.category === 'animals');
const english = (el: HTMLElement) =>
  el.querySelector('main button span.text-4xl')?.textContent?.trim();

async function setup(seed: Record<string, number> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: HomeStub },
        { path: 'session/flashcard/:categoryId', component: FlashcardComponent },
      ]),
      { provide: APP_STORAGE, useValue: new MemoryStorage() },
    ],
  });
  const store = TestBed.inject(AppStore);
  for (const [id, score] of Object.entries(seed)) {
    store.setWordState({ ...createDefaultWordState(id), confidenceScore: score });
  }
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/session/flashcard/animals');
  harness.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  const tap = (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    harness.detectChanges();
  };
  return { harness, el, store, tap };
}

describe('FlashcardComponent session', () => {
  it('✓ adds 0.08 and ✗ subtracts 0.12 on the answered word', async () => {
    const { el, store, tap } = await setup({ [words[1].id]: 0.5 });
    // Words are lowest-first, so words[0] (score 0) is first.
    tap('main > button');
    tap('.got-it');
    expect(store.getWordState(words[0].id).confidenceScore).toBe(0.08);

    // Next lowest is words[2] (score 0).
    expect(english(el)).toBe(words[2].english);
    tap('main > button');
    tap('.not-yet');
    expect(store.getWordState(words[2].id).confidenceScore).toBe(0);
  });

  it('✗ lowers a nonzero score by 0.12, rounded to 2 decimals', async () => {
    const { store, tap } = await setup(Object.fromEntries(words.map((w) => [w.id, 0.5])));
    tap('main > button');
    tap('.not-yet');
    expect(store.getWordState(words[0].id).confidenceScore).toBe(0.38);
  });

  it('advances after one answer tap and cycles continuously', async () => {
    const { el, tap } = await setup();
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < words.length * 2 + 1; i++) {
      seen.push(english(el));
      expect(el.querySelector('.got-it')).toBeNull(); // answers hidden until reveal
      tap('main > button');
      tap('.got-it');
    }
    // Every word is shown, and the session is still showing a card after two full passes.
    expect(new Set(seen).size).toBe(words.length);
    expect(english(el)).toBeTruthy();
  });

  it('shows the lowest-confidence word first', async () => {
    const seed = Object.fromEntries(words.map((w, i) => [w.id, 0.9 - i * 0.01]));
    const lowest = words[words.length - 1];
    const { el } = await setup(seed);
    expect(english(el)).toBe(lowest.english);
  });

  it('back button returns to the home screen', async () => {
    const { harness, tap } = await setup();
    tap('a[aria-label="Back"]');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('shows pinyin automatically for a word with no audio when both text settings are off', async () => {
    const { el, store, harness } = await setup();
    store.updateSettings({ showPinyin: false, showCharacters: false, audioEnabled: false });
    harness.detectChanges();
    expect(el.querySelector('.pinyin')?.textContent?.trim()).toBe(words[0].pinyin);
    expect(el.querySelector('.characters')).toBeNull();
  });
});
describe('FlashcardComponent audio', () => {
  async function audioSetup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'session/flashcard/:categoryId', component: FlashcardComponent }]),
        { provide: APP_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    const play = vi.spyOn(TestBed.inject(AudioService), 'play').mockResolvedValue(undefined);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/session/flashcard/animals');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    const card = () => el.querySelector('main > button') as HTMLElement;
    const press = () => {
      card().click();
      harness.detectChanges();
    };
    const fire = (type: 'load' | 'error') => {
      el.querySelector('img')!.dispatchEvent(new Event(type));
      harness.detectChanges();
    };
    return { harness, el, play, press, fire };
  }
  it('plays the word once when the card image loads', async () => {
    const { play, fire } = await audioSetup();
    expect(play).not.toHaveBeenCalled();
    fire('load');
    expect(play).toHaveBeenCalledWith(words[0].audioAsset, 'natural');
    fire('load');
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('plays when the image fails and the emoji shows instead', async () => {
    const { play, fire } = await audioSetup();
    fire('error');
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('plays on every press of the card, not only the first', async () => {
    const { el, play, press, fire } = await audioSetup();
    fire('load');
    press();
    press();
    press();
    expect(play).toHaveBeenCalledTimes(4);
    expect(el.querySelector('.got-it')).not.toBeNull();
  });
  it('a press before the image loads replaces the load sound', async () => {
    const { play, press, fire } = await audioSetup();
    press();
    fire('load');
    expect(play).toHaveBeenCalledTimes(1);
  });
  it('plays anyway after a short wait if the image is slow', async () => {
    vi.useFakeTimers();
    try {
      const { play } = await audioSetup();
      expect(play).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(CARD_AUDIO_MAX_WAIT_MS);
      expect(play).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('the next card plays when its image loads', async () => {
    const { el, harness, play, press, fire } = await audioSetup();
    fire('load');
    press();
    (el.querySelector('.got-it') as HTMLElement).click();
    harness.detectChanges();
    play.mockClear();
    fire('load');
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith(words[1].audioAsset, 'natural');
  });
});
