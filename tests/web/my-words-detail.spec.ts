import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_STORAGE, AppStore, MemoryStorage } from '@shared/store';
import { MyWordsComponent } from '../../src/web/app/screens/my-words/my-words.component';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: APP_STORAGE, useValue: new MemoryStorage() }],
  });
  const store = TestBed.inject(AppStore);
  const fixture = TestBed.createComponent(MyWordsComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (s: string) => el.querySelector(s) as HTMLElement | null;
  const entry = () => q('[data-testid="word-button"]') as HTMLElement;
  return { fixture, store, el, q, entry };
}

describe('My Words detail view and manual override', () => {
  afterEach(() => vi.useRealTimers());

  it('tapping a word opens the detail view with the English label and emoji fallback', () => {
    const { fixture, q, entry } = setup();
    entry().click();
    fixture.detectChanges();
    expect(q('[data-testid="detail"]')).not.toBeNull();
    const english = entry().querySelector('span.text-lg')!.textContent!.trim();
    expect(q('[data-testid="detail-english"]')?.textContent).toContain(english);
    expect(
      q('[data-testid="detail"] img') ?? q('[data-testid="detail"] [aria-hidden="true"]'),
    ).toBeTruthy();
  });

  it('the detail view always shows pinyin and never characters, whatever the learning settings', () => {
    for (const on of [false, true]) {
      const { fixture, store, q, entry } = setup();
      store.updateSettings({
        flashcardShowPinyin: on,
        flashcardShowCharacters: on,
        listenShowPinyin: on,
        listenShowCharacters: on,
      });
      entry().click();
      fixture.detectChanges();
      expect(q('[data-testid="detail"] .pinyin')?.textContent?.trim()).toBeTruthy();
      expect(q('[data-testid="detail"] .characters')).toBeNull();
    }
  });
  it('visible buttons mark a word Known, then Unknown', () => {
    const { fixture, store, q, entry } = setup();
    entry().click();
    fixture.detectChanges();
    q('[data-testid="mark-known"]')!.click();
    fixture.detectChanges();
    const known = Object.values(store.wordStates()).find((s) => s.manualOverride === 'known');
    expect(known).toBeDefined();
    expect(q('[data-testid="detail-status"]')?.textContent).toContain('Known');
    q('[data-testid="mark-unknown"]')!.click();
    fixture.detectChanges();
    expect(store.getWordState(known!.wordId).manualOverride).toBe('unknown');
    expect(q('[data-testid="detail-status"]')?.textContent).toContain('Still learning');
  });

  it('a long press opens the override menu and does not also open as a tap', () => {
    vi.useFakeTimers();
    const { fixture, q, entry } = setup();
    entry().dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(600);
    entry().dispatchEvent(new Event('pointerup'));
    entry().click();
    fixture.detectChanges();
    expect(q('[data-testid="detail"]')).not.toBeNull();
    expect(q('[data-testid="mark-known"]')).not.toBeNull();
    expect(q('[data-testid="detail"]')?.textContent).toContain('What would you like to do');
  });

  it('a short press is a plain tap', () => {
    vi.useFakeTimers();
    const { fixture, q, entry } = setup();
    entry().dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(100);
    entry().dispatchEvent(new Event('pointerup'));
    entry().click();
    fixture.detectChanges();
    expect(q('[data-testid="detail"]')).not.toBeNull();
    expect(q('[data-testid="detail"]')?.textContent).not.toContain('What would you like to do');
  });
});
