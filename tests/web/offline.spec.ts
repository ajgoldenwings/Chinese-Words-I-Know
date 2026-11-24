/**
 * Offline support (requirement 8).
 *
 * What this file covers, and what it does not:
 * - Covered: the real service worker config generator (the one `ng build` uses) is run on
 *   ngsw-config.json for two base hrefs. We assert the app shell is prefetched and the media
 *   `dataGroups` pattern matches audio and image URLs that did not exist at build time.
 * - Covered: components show a cached image and play audio, and fall back to the emoji and
 *   silence when files are missing.
 * - NOT covered: the browser's service worker runtime (install, fetch interception, cache
 *   storage, airplane mode). That needs a real browser and is a manual check.
 */
import { Generator } from '@angular/service-worker/config';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { APP_STORAGE, AppStore, MemoryStorage } from '@shared/store';
import { AUDIO_ELEMENT_FACTORY, AudioService } from '../../src/web/app/services/audio.service';
import { ImageService } from '../../src/web/app/services/image.service';
import { FlashcardComponent } from '../../src/web/app/screens/flashcard/flashcard.component';
import swConfig from '../../ngsw-config.json';

const files = ['/index.html', '/manifest.webmanifest', '/main-ABC.js', '/styles-ABC.css'];
async function generate(baseHref: string) {
  const fs = {
    list: async () => files,
    read: async () => 'x',
    hash: async (path: string) => `hash-${path}`,
    write: async () => undefined,
  };
  return (await new Generator(fs, baseHref).process(swConfig as never)) as {
    index: string;
    assetGroups: { name: string; urls: string[]; installMode: string }[];
    dataGroups: { name: string; patterns: string[]; strategy: string }[];
  };
}

describe('service worker config (app shell and runtime media cache)', () => {
  for (const base of ['/', '/chinese-words-i-know/']) {
    it(`prefetches the shell and matches media URLs under base ${base}`, async () => {
      const out = await generate(base);
      expect(out.index).toBe(`${base}index.html`);
      const shell = out.assetGroups.find((g) => g.name === 'app-shell')!;
      expect(shell.installMode).toBe('prefetch');
      expect(shell.urls).toContain(`${base}index.html`);
      expect(shell.urls).toContain(`${base}main-ABC.js`);
      // Only the app shell and the small logo folder are precached, never the large media set.
      expect(out.assetGroups.map((g) => g.name)).toEqual(['app-shell', 'logo']);

      const media = out.dataGroups.find((g) => g.name === 'media')!;
      expect(media.strategy).toBe('performance'); // cache-first
      const matches = (url: string) => media.patterns.some((p) => new RegExp(p).test(url));
      expect(matches(`${base}assets/audio/words/mao/mao-natural.mp3`)).toBe(true);
      expect(matches(`${base}assets/audio/words/mao/mao-slow.mp3`)).toBe(true);
      expect(matches(`${base}assets/images/words/mao.png`)).toBe(true);
      expect(matches(`${base}assets/images/categories/animals.png`)).toBe(true);
      expect(matches(`${base}main-ABC.js`)).toBe(false);
    });
  }

  it('does not match media paths that lack the base href (wrong subpath)', async () => {
    const media = (await generate('/chinese-words-i-know/')).dataGroups[0];
    expect(media.patterns.some((p) => new RegExp(p).test('/assets/audio/x.mp3'))).toBe(false);
  });
});

/**
 * The seed content has no assets yet, so `hasImage` swaps in an ImageService that returns a
 * URL for any word (a "cached" image). Without it the real ImageService returns null (no image).
 * URL building itself is covered in image.service.spec.ts.
 */
async function open(hasImage: boolean) {
  const played: { slug: string | null | undefined; speed: string }[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'session/flashcard/:categoryId', component: FlashcardComponent }]),
      { provide: APP_STORAGE, useValue: new MemoryStorage() },
      {
        provide: AudioService,
        useValue: {
          play: async (slug: string | null | undefined, speed: string) => {
            played.push({ slug, speed });
          },
          stop: () => undefined,
        },
      },
      ...(hasImage
        ? [{ provide: ImageService, useValue: { wordImageUrl: () => 'assets/images/words/test-cat.png' } }]
        : [{ provide: ImageService, useValue: { wordImageUrl: () => null } }]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/session/flashcard/animals');
  harness.detectChanges();
  return { harness, el: harness.routeNativeElement as HTMLElement, played };
}

const emojiOf = (el: HTMLElement) => el.querySelector('span[aria-hidden="true"]')?.textContent?.trim();

describe('cached and uncached words offline (flashcard)', () => {
  it('a cached word shows its image and asks for its natural audio on reveal', async () => {
    const { harness, el, played } = await open(true);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('assets/images/words/test-cat.png');
    expect(emojiOf(el)).toBeUndefined();
    (el.querySelector('main > button') as HTMLElement).click();
    harness.detectChanges();
    expect(played.map((p) => p.speed)).toEqual(['natural']);
  });

  it('an image that fails to load (not cached, offline) swaps to the category emoji', async () => {
    const { harness, el } = await open(true);
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    harness.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(emojiOf(el)).toBeTruthy();
    // The English word is still shown as the prompt.
    expect(el.querySelector('main button span.text-4xl')?.textContent?.trim()).toBeTruthy();
  });

  it('a word with no image file shows the emoji and no broken image', async () => {
    const { el } = await open(false);
    expect(el.querySelector('img')).toBeNull();
    expect(emojiOf(el)).toBeTruthy();
  });

  it('a word with no audio file reveals silently and the card still works', async () => {
    const { harness, el, played } = await open(false);
    (el.querySelector('main > button') as HTMLElement).click();
    harness.detectChanges();
    // Once when the emoji is shown, once on the press. AudioService resolves silently if the file is missing.
    expect(played.map((p) => p.speed)).toEqual(['natural', 'natural']);
    expect(el.querySelector('.got-it')).not.toBeNull();
  });
});

describe('AudioService with cached and uncached files', () => {
  function audioSetup(play: () => Promise<void>) {
    const sources: string[] = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_STORAGE, useValue: new MemoryStorage() },
        {
          provide: AUDIO_ELEMENT_FACTORY,
          // One element is reused, so record the source each time it plays.
          useValue: (src: string) => {
            const el = {
              src,
              play: () => {
                if (!el.src.startsWith('data:')) sources.push(el.src);
                return play();
              },
              pause: () => undefined,
            };
            return el as unknown as HTMLAudioElement;
          },
        },
      ],
    });
    return { sources, audio: TestBed.inject(AudioService) };
  }

  it('plays a cached recording', async () => {
    const { audio, sources } = audioSetup(() => Promise.resolve());
    await audio.play('mao', 'natural');
    expect(sources).toEqual(['assets/audio/words/mao/mao-natural.mp3']);
  });

  it('stays silent and does not throw when the file is not cached offline', async () => {
    const { audio } = audioSetup(() => Promise.reject(new Error('NotSupportedError')));
    await expect(audio.play('mao', 'natural')).resolves.toBeUndefined();
  });
});
