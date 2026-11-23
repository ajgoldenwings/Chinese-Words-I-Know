import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AppStore, APP_STORAGE, MemoryStorage } from '@shared/store';
import { environment } from '../../src/web/environments/environment';
import { AUDIO_ELEMENT_FACTORY, AudioService } from '../../src/web/app/services/audio.service';

function setup(play: () => Promise<void> = () => Promise.resolve()) {
  const sources: string[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_STORAGE, useValue: new MemoryStorage() },
      {
        provide: AUDIO_ELEMENT_FACTORY,
        useValue: (src: string) => {
          sources.push(src);
          return { play, pause: () => undefined } as unknown as HTMLAudioElement;
        },
      },
    ],
  });
  return { sources, service: TestBed.inject(AudioService), store: TestBed.inject(AppStore) };
}

describe('AudioService', () => {
  it('plays the natural and slow files by relative path', async () => {
    const { service, sources } = setup();
    await service.play('mao', 'natural');
    await service.play('ni-hao', 'slow');
    expect(sources).toEqual([
      'assets/audio/words/mao/mao-natural.mp3',
      'assets/audio/words/ni-hao/ni-hao-slow.mp3',
    ]);
  });

  it('does nothing when audio is disabled or the slug is null', async () => {
    const { service, sources, store } = setup();
    await service.play(null, 'natural');
    store.updateSettings({ audioEnabled: false });
    await service.play('mao', 'natural');
    expect(sources).toEqual([]);
  });

  it('resolves when playback is rejected', async () => {
    const { service } = setup(() => Promise.reject(new Error('NotAllowedError')));
    await expect(service.play('mao', 'natural')).resolves.toBeUndefined();
  });

  it('prefixes a CDN base URL with or without a trailing slash', async () => {
    const original = environment.assetBaseUrl;
    try {
      for (const base of ['https://cdn.example.com', 'https://cdn.example.com/']) {
        environment.assetBaseUrl = base;
        const { service, sources } = setup();
        await service.play('mao', 'natural');
        expect(sources).toEqual(['https://cdn.example.com/assets/audio/words/mao/mao-natural.mp3']);
      }
    } finally {
      environment.assetBaseUrl = original;
    }
  });

  it('resolves when the element cannot be created', async () => {
    const { service } = setup(() => {
      throw new Error('boom');
    });
    await expect(service.play('mao', 'slow')).resolves.toBeUndefined();
  });
});
