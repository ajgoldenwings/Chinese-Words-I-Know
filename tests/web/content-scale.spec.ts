import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { loadContent } from '@shared/content';
import { AppStore, APP_STORAGE, MemoryStorage, migrateContent } from '@shared/store';
import { HomeComponent } from '../../src/web/app/screens/home/home.component';

/** Validates: Requirements 4, 12 */
describe('real content: home screen', () => {
  it('renders a button for every category in a vertically scrollable container', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const { categories } = loadContent();
    const buttons = Array.from(el.querySelectorAll('[data-testid="category"]'));
    expect(buttons).toHaveLength(categories.length);
    for (const c of categories) {
      expect(buttons.some((b) => b.textContent?.includes(c.name))).toBe(true);
    }
    const container = el.querySelector('main') as HTMLElement;
    expect(container.className).toMatch(/\boverflow-y-(auto|scroll)\b/);
  });
});

describe('real content: migration v1 -> v2', () => {
  it('gives new words zero state and keeps existing progress', () => {
    const real = loadContent();
    const v1Words = real.words.slice(0, 20);
    const v1 = migrateContent(
      { wordStates: {}, lastContentVersion: null },
      { contentVersion: 1, words: v1Words },
    );
    const kept = v1Words[0].id;
    v1.wordStates[kept] = { ...v1.wordStates[kept], confidenceScore: 0.7, timesSeenCount: 5 };

    const v2 = migrateContent(v1, real);
    const expectedNew = real.words.slice(20).map((w) => w.id);
    expect(v2.migrated).toBe(true);
    expect(v2.lastContentVersion).toBe(real.contentVersion);
    expect(v2.added).toEqual(expectedNew);
    expect(v2.orphaned).toEqual([]);
    expect(v2.wordStates[kept]).toMatchObject({ confidenceScore: 0.7, timesSeenCount: 5 });
    for (const id of expectedNew) {
      expect(v2.wordStates[id]).toMatchObject({ confidenceScore: 0, timesSeenCount: 0 });
    }
    expect(Object.keys(v2.wordStates)).toHaveLength(real.words.length);
  });
});
