import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { loadContent } from '@shared/content';
import { APP_STORAGE, AppStore, MemoryStorage } from '@shared/store';
import { FlashcardComponent } from '../../src/web/app/screens/flashcard/flashcard.component';
import { HomeComponent } from '../../src/web/app/screens/home/home.component';

/** Every learning switch and the submenu page it is on. */
const FLAGS = [
  ['flashcardShowPinyin', 'flashcard'],
  ['flashcardShowCharacters', 'flashcard'],
  ['flashcardAudio', 'flashcard'],
  ['listenShowPinyin', 'listen'],
  ['listenShowCharacters', 'listen'],
  ['listenRepeatButton', 'listen'],
] as const;
const firstWord = loadContent().words.filter((w) => w.category === 'animals')[0];

/** Boots a fresh app over the given storage, which simulates a page reload. */
async function boot(storage: MemoryStorage) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: HomeComponent },
        { path: 'session/flashcard/:categoryId', component: FlashcardComponent },
      ]),
      { provide: APP_STORAGE, useValue: storage },
    ],
  });
  const store = TestBed.inject(AppStore);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/');
  harness.detectChanges();
  const q = (testId: string) =>
    document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const click = (testId: string) => {
    q(testId)!.click();
    harness.detectChanges();
  };
  /** Opens the settings panel on a submenu page: Settings → Learning Settings → page. */
  const openPage = (page: 'flashcard' | 'listen') => {
    click('settings');
    click('open-learning');
    click(`open-${page}`);
  };
  return { harness, store, q, click, openPage };
}

describe('Settings panel', () => {
  it('is closed on the home screen until the gear is tapped, and closes again', async () => {
    const { q, click } = await boot(new MemoryStorage());
    expect(q('settings-panel')).toBeNull();
    click('settings');
    expect(q('settings-panel')).not.toBeNull();
    click('settings-close');
    expect(q('settings-panel')).toBeNull();
  });

  it('is not present on the flashcard screen', async () => {
    const { harness, q } = await boot(new MemoryStorage());
    await harness.navigateByUrl('/session/flashcard/animals');
    harness.detectChanges();
    expect(q('settings')).toBeNull();
    expect(q('settings-panel')).toBeNull();
  });

  it('Save to Cloud is a button, not a toggle, and opens the account panel; the flag stays off until signed in', async () => {
    const { store, q, click } = await boot(new MemoryStorage());
    click('settings');
    expect(q('toggle-cloudSyncEnabled')).toBeNull();
    expect(q('cloud-logout')).toBeNull();
    expect(q('sync-refresh')).toBeNull();
    click('cloud-save');
    expect(q('account-panel')).not.toBeNull();
    expect(store.settings().cloudSyncEnabled).toBe(false);
    click('account-close');
    expect(q('account-panel')).toBeNull();
    expect(store.settings().cloudSyncEnabled).toBe(false);
  });

  it('the main page has Learning Settings and Save to Cloud, and no switches', async () => {
    const { q, click } = await boot(new MemoryStorage());
    click('settings');
    expect(q('settings-title')?.textContent?.trim()).toBe('Settings');
    expect(q('open-learning')?.textContent).toContain('Learning Settings');
    expect(q('cloud-section')).not.toBeNull();
    expect(document.querySelectorAll('[data-testid^="toggle-"]').length).toBe(0);
    expect(q('settings-back')).toBeNull();
  });
  it('Learning Settings opens Flashcard Settings and Listen + Tap Settings, and back returns step by step', async () => {
    const { q, click } = await boot(new MemoryStorage());
    click('settings');
    click('open-learning');
    expect(q('settings-title')?.textContent?.trim()).toBe('Learning Settings');
    expect(q('cloud-section')).toBeNull();
    expect(q('open-flashcard')?.textContent).toContain('Flashcard Settings');
    expect(q('open-listen')?.textContent).toContain('Listen + Tap Settings');
    click('open-listen');
    expect(q('settings-title')?.textContent?.trim()).toBe('Listen + Tap Settings');
    expect(q('settings-back')?.getAttribute('aria-label')).toBe('Back to Learning Settings');
    click('settings-back');
    expect(q('settings-title')?.textContent?.trim()).toBe('Learning Settings');
    click('settings-back');
    expect(q('settings-title')?.textContent?.trim()).toBe('Settings');
  });
  it('each submenu shows only its own three switches, with the agreed wording', async () => {
    const { q, click, openPage } = await boot(new MemoryStorage());
    const rows = () =>
      Array.from(document.querySelectorAll('[data-testid="settings-panel"] label')).map((l) =>
        Array.from(l.querySelectorAll('span.block')).map((e) => e.textContent!.trim()).join(' '),
      );
    openPage('flashcard');
    expect(rows()).toEqual([
      'Show Pinyin Show how each word is pronounced, in letters, after the card is tapped.',
      'Show Characters Show the Chinese characters for each word under the picture.',
      'Audio Play a recording of each word when a card is tapped.',
    ]);
    click('settings-back');
    click('open-listen');
    expect(rows()).toEqual([
      'Show Pinyin Show how each word is pronounced under a picture after it is tapped.',
      'Show Characters Show the Chinese characters for each word under the picture.',
      'Audio Show a repeat button.',
    ]);
    expect(q('toggle-flashcardAudio')).toBeNull();
  });
  it('reopening the panel starts on the main page', async () => {
    const { q, click, openPage } = await boot(new MemoryStorage());
    openPage('flashcard');
    click('settings-close');
    click('settings');
    expect(q('settings-title')?.textContent?.trim()).toBe('Settings');
  });
  for (const [flag, page] of FLAGS) {
    it(`${flag} switch flips its flag and persists across reload`, async () => {
      const storage = new MemoryStorage();
      const { store, click, openPage } = await boot(storage);
      const before = store.settings()[flag];
      openPage(page);
      click(`toggle-${flag}`);
      expect(store.settings()[flag]).toBe(!before);
      const reloaded = await boot(storage);
      expect(reloaded.store.settings()[flag]).toBe(!before);
      reloaded.openPage(page);
      const box = reloaded.q(`toggle-${flag}`) as HTMLInputElement;
      expect(box.checked).toBe(!before);
    });
  }
  it('defaults: pinyin and characters off in both modes, Flashcard Audio and the repeat button on', async () => {
    const { store } = await boot(new MemoryStorage());
    expect(store.settings()).toMatchObject({
      flashcardShowPinyin: false,
      flashcardShowCharacters: false,
      flashcardAudio: true,
      listenShowPinyin: false,
      listenShowCharacters: false,
      listenRepeatButton: true,
    });
  });
  it('flashcard switches change the flashcard screen: characters at once, pinyin after the tap', async () => {
    const { harness, q, click, openPage } = await boot(new MemoryStorage());
    openPage('flashcard');
    click('toggle-flashcardShowCharacters');
    click('toggle-flashcardShowPinyin');
    click('settings-close');
    await harness.navigateByUrl('/session/flashcard/animals');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(q('settings-panel')).toBeNull();
    expect(el.querySelector('.characters')?.textContent?.trim()).toBe(firstWord.simplified);
    const pinyin = el.querySelector('.pinyin') as HTMLElement;
    expect(pinyin.classList.contains('invisible')).toBe(true);
    (el.querySelector('main > button') as HTMLElement).click();
    harness.detectChanges();
    expect(pinyin.classList.contains('invisible')).toBe(false);
    expect(pinyin.textContent?.trim()).toBe(firstWord.pinyin);
  });
});
