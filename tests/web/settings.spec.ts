import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { loadContent } from '@shared/content';
import { APP_STORAGE, AppStore, MemoryStorage } from '@shared/store';
import { FlashcardComponent } from '../../src/web/app/screens/flashcard/flashcard.component';
import { HomeComponent } from '../../src/web/app/screens/home/home.component';

const FLAGS = ['showPinyin', 'showCharacters', 'audioEnabled'] as const;
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
  return { harness, store, q, click };
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

  for (const flag of FLAGS) {
    it(`${flag} toggle flips its flag and persists across reload`, async () => {
      const storage = new MemoryStorage();
      const { store, click } = await boot(storage);
      const before = store.settings()[flag];
      click('settings');
      click(`toggle-${flag}`);
      expect(store.settings()[flag]).toBe(!before);

      const reloaded = await boot(storage);
      expect(reloaded.store.settings()[flag]).toBe(!before);
      reloaded.click('settings');
      const box = reloaded.q(`toggle-${flag}`) as HTMLInputElement;
      expect(box.checked).toBe(!before);
    });
  }

  it('audio is on by default', async () => {
    const { store } = await boot(new MemoryStorage());
    expect(store.settings().audioEnabled).toBe(true);
  });

  it('pinyin and character toggles show in the flashcard screen', async () => {
    const { harness, store, q, click } = await boot(new MemoryStorage());
    store.updateSettings({ showPinyin: false, showCharacters: false });
    click('settings');
    click('toggle-showCharacters');
    await harness.navigateByUrl('/session/flashcard/animals');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('.characters')?.textContent?.trim()).toBe(firstWord.simplified);
    expect(el.querySelector('.pinyin')).toBeNull();

    await harness.navigateByUrl('/');
    click('settings');
    click('toggle-showPinyin');
    click('toggle-showCharacters');
    await harness.navigateByUrl('/session/flashcard/animals');
    harness.detectChanges();
    const el2 = harness.routeNativeElement as HTMLElement;
    expect(q('settings-panel')).toBeNull();
    expect(el2.querySelector('.pinyin')?.textContent?.trim()).toBe(firstWord.pinyin);
    expect(el2.querySelector('.characters')).toBeNull();
  });
});
