import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi } from 'vitest';
import { loadContent } from '@shared/content';
import { buildWordLists } from '@shared/lists';
import { APP_STORAGE, AppStore, MemoryStorage, createDefaultWordState } from '@shared/store';
import { AudioService } from '../../src/web/app/services/audio.service';
import { FlashcardComponent } from '../../src/web/app/screens/flashcard/flashcard.component';

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

  it('shows pinyin automatically, after the tap, when Flashcard Audio and both text settings are off', async () => {
    const { el, store, harness, tap } = await setup();
    store.updateSettings({ flashcardShowPinyin: false, flashcardShowCharacters: false, flashcardAudio: false });
    harness.detectChanges();
    const pinyin = () => el.querySelector('.pinyin') as HTMLElement | null;
    expect(pinyin()?.classList.contains('invisible')).toBe(true);
    tap('main > button');
    expect(pinyin()?.classList.contains('invisible')).toBe(false);
    expect(pinyin()?.textContent?.trim()).toBe(words[0].pinyin);
    expect(el.querySelector('.characters')).toBeNull();
  });
  it('Show Pinyin shows pinyin only after the card is tapped; space is kept so the image does not move', async () => {
    const { el, store, harness, tap } = await setup();
    store.updateSettings({ flashcardShowPinyin: true });
    harness.detectChanges();
    const pinyin = () => el.querySelector('.pinyin') as HTMLElement;
    expect(pinyin().classList.contains('invisible')).toBe(true);
    expect(pinyin().getAttribute('aria-hidden')).toBe('true');
    tap('main > button');
    expect(pinyin().classList.contains('invisible')).toBe(false);
    expect(pinyin().getAttribute('aria-hidden')).toBe('false');
    // The next card hides it again until tapped.
    tap('.got-it');
    expect(pinyin().classList.contains('invisible')).toBe(true);
  });
  it('Show Characters shows characters with the image before any tap', async () => {
    const { el, store, harness } = await setup();
    store.updateSettings({ flashcardShowCharacters: true });
    harness.detectChanges();
    expect(el.querySelector('.characters')?.textContent?.trim()).toBe(words[0].simplified);
  });
  it('ignores the Listen + Tap settings', async () => {
    const { el, store, harness, tap } = await setup();
    store.updateSettings({ listenShowPinyin: true, listenShowCharacters: true });
    harness.detectChanges();
    tap('main > button');
    expect(el.querySelector('.characters')).toBeNull();
    // Every animal has a recording, so there is no pinyin fallback either.
    expect(el.querySelector('.pinyin')).toBeNull();
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
    const press = () => {
      (el.querySelector('main > button') as HTMLElement).click();
      harness.detectChanges();
    };
    const fire = (type: 'load' | 'error') => {
      el.querySelector('img')?.dispatchEvent(new Event(type));
      harness.detectChanges();
    };
    return { harness, el, play, press, fire };
  }
  it('plays nothing when a card appears, even after its image loads or fails', async () => {
    vi.useFakeTimers();
    try {
      const { play, fire } = await audioSetup();
      fire('load');
      fire('error');
      await vi.advanceTimersByTimeAsync(5000);
      expect(play).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it('plays the word from the start on every press of the card', async () => {
    const { el, play, press } = await audioSetup();
    press();
    press();
    press();
    expect(play).toHaveBeenCalledTimes(3);
    for (const call of play.mock.calls) expect(call).toEqual([words[0].audioAsset, 'natural']);
    expect(el.querySelector('.got-it')).not.toBeNull();
  });
  it('plays nothing on a press when Flashcard Audio is off, and the card still reveals', async () => {
    const { el, play, press } = await audioSetup();
    TestBed.inject(AppStore).updateSettings({ flashcardAudio: false });
    press();
    expect(play).not.toHaveBeenCalled();
    expect(el.querySelector('.got-it')).not.toBeNull();
    expect((el.querySelector('main > button') as HTMLElement).getAttribute('aria-label')).toMatch(/^Tap to reveal /);
  });
  it('the next card stays silent until it is pressed', async () => {
    const { el, harness, play, press, fire } = await audioSetup();
    press();
    (el.querySelector('.got-it') as HTMLElement).click();
    harness.detectChanges();
    play.mockClear();
    fire('load');
    expect(play).not.toHaveBeenCalled();
    press();
    expect(play).toHaveBeenCalledWith(words[1].audioAsset, 'natural');
  });
});
describe('Learn Next session (Start Now)', () => {
  async function learnNextSetup(seed: (store: InstanceType<typeof AppStore>) => void = () => undefined) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'session/learn-next', component: FlashcardComponent, data: { source: 'learn-next' } }]),
        { provide: APP_STORAGE, useValue: new MemoryStorage() },
      ],
    });
    const store = TestBed.inject(AppStore);
    seed(store);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/session/learn-next');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    const answer = () => {
      (el.querySelector('main > button') as HTMLElement).click();
      harness.detectChanges();
      (el.querySelector('.got-it') as HTMLElement).click();
      harness.detectChanges();
    };
    return { el, store, answer };
  }
  it('shows the Learn Next words in Learn Next order, across categories', async () => {
    const content = loadContent();
    const { el, store, answer } = await learnNextSetup();
    const expected = buildWordLists(content.words, store.wordStates()).learnNext.map((w) => w.english);
    expect(expected.length).toBeGreaterThan(0);
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < Math.min(expected.length, 5); i++) {
      seen.push(english(el));
      answer();
    }
    expect(seen).toEqual(expected.slice(0, seen.length));
  });
  it('uses each word\'s own category emoji when there is no image', async () => {
    const content = loadContent();
    const { el, store } = await learnNextSetup();
    const first = buildWordLists(content.words, store.wordStates()).learnNext[0];
    el.querySelector('img')?.dispatchEvent(new Event('error'));
    TestBed.tick();
    const emoji = content.categories.find((c) => c.id === first.category)!.emoji;
    expect(el.querySelector('main button span[aria-hidden="true"]')?.textContent?.trim()).toBe(emoji);
  });
  it('falls back to a category when every word is at 0.6 or above', async () => {
    const content = loadContent();
    const { el } = await learnNextSetup((store) => {
      for (const w of content.words) store.setWordState({ ...createDefaultWordState(w.id), confidenceScore: 0.7, timesSeenCount: 2 });
    });
    expect(english(el)).toBeTruthy();
  });
});
