import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Word } from '@shared/entities';
import { AppStore, APP_STORAGE, MemoryStorage, createDefaultWordState } from '@shared/store';
import { HomeComponent } from '../../src/web/app/screens/home/home.component';

interface TestContent {
  contentVersion: number;
  categories: Category[];
  words: Word[];
}

const cat = (id: string): Category => ({ id, name: id, emoji: '🐾' }) as unknown as Category;
const word = (id: string, category: string, imageAsset: string | null = null): Word =>
  ({
    id,
    simplified: id,
    pinyin: id,
    english: id,
    category,
    imageAsset,
    audioAsset: null,
    tags: [],
    frequencyTier: 1,
  }) as unknown as Word;

const content = (imaged: number): TestContent => ({
  contentVersion: 1,
  categories: [cat('colors'), cat('animals'), cat('food')],
  words: [
    word('red', 'colors'),
    ...Array.from({ length: 5 }, (_, i) => word(`a${i}`, 'animals', i < imaged ? `a${i}` : null)),
    word('rice', 'food'),
    word('egg', 'food'),
  ],
});

function setup(custom?: TestContent) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
  });
  const fixture: ComponentFixture<HomeComponent> = TestBed.createComponent(HomeComponent);
  // The content is read lazily, so swapping it before the first render is enough.
  if (custom) {
    (fixture.componentInstance as unknown as { content: TestContent }).content = custom;
    (fixture.componentInstance as unknown as { categories: Category[] }).categories =
      custom.categories;
  }
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const store = TestBed.inject(AppStore);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (testId: string) => {
    (el.querySelector(`[data-testid="${testId}"]`) as HTMLElement).click();
  };
  return { fixture, el, navigate, store, click };
}

function learn(store: InstanceType<typeof AppStore>, id: string, score = 0.4, seen = 6) {
  store.setWordState({ ...createDefaultWordState(id), confidenceScore: score, timesSeenCount: seen });
}

describe('HomeComponent', () => {
  it('renders Start Now, category buttons, My Words and the settings gear', () => {
    const { el } = setup();
    expect(el.querySelector('[data-testid="start-now"]')?.textContent).toContain('Start Now');
    expect(el.querySelectorAll('[data-testid="category"]').length).toBeGreaterThan(0);
    expect(el.querySelector('[data-testid="my-words"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="settings"]')).not.toBeNull();
    expect(el.querySelector('[role="tablist"], [role="menubar"]')).toBeNull();
  });

  describe('Start Now', () => {
    it('first launch goes to the animals flashcards', () => {
      const { click, navigate } = setup(content(0));
      click('start-now');
      expect(navigate).toHaveBeenCalledWith(['/session/flashcard', 'animals']);
    });

    it('returning user goes to the category with the most Learning words', () => {
      const { click, navigate, store } = setup(content(0));
      learn(store, 'rice');
      learn(store, 'egg');
      learn(store, 'red');
      click('start-now');
      expect(navigate).toHaveBeenCalledWith(['/session/flashcard', 'food']);
    });

    it('breaks a Learning tie by content order', () => {
      const { click, navigate, store } = setup(content(0));
      learn(store, 'a0');
      learn(store, 'red');
      click('start-now');
      expect(navigate).toHaveBeenCalledWith(['/session/flashcard', 'colors']);
    });

    it('with no Learning words, picks the first category with a word below Known', () => {
      const { click, navigate, store } = setup(content(0));
      learn(store, 'red', 0.9);
      learn(store, 'a0', 0.1);
      click('start-now');
      expect(navigate).toHaveBeenCalledWith(['/session/flashcard', 'animals']);
    });
  });

  describe('Listen & Tap', () => {
    it('is hidden when no category has 4 imaged words', () => {
      const { el } = setup(content(3));
      expect(el.querySelector('[data-testid="listen"]')).toBeNull();
    });

    it('is shown with the real seed content, which now has images', () => {
      const { el } = setup();
      expect(el.querySelector('[data-testid="listen"]')).not.toBeNull();
    });

    it('appears once a category has 4 imaged words', () => {
      const { el } = setup(content(4));
      expect(el.querySelector('[data-testid="listen"]')).not.toBeNull();
    });
  });

  describe('tap targets', () => {
    it('every interactive element declares at least 44px (11 rem units) of height', () => {
      const { el } = setup(content(4));
      const targets = el.querySelectorAll<HTMLElement>('button, a');
      expect(targets.length).toBeGreaterThan(4);
      for (const t of Array.from(targets)) {
        const cls = t.className;
        const ok =
          /\bsize-(1[1-9]|[2-9]\d)\b/.test(cls) || /\bmin-h-(1[1-9]|[2-9]\d|\[\d{2,}px\])/.test(cls);
        expect(ok, `${t.getAttribute('data-testid')} classes: ${cls}`).toBe(true);
      }
    });
  });
});
