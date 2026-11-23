import { Injectable, InjectionToken, inject } from '@angular/core';
import { AppStore } from '@shared/store';
import { environment } from '../../environments/environment';

export type AudioSpeed = 'natural' | 'slow';

/** Creates the element that plays one file. Replaceable in tests. */
export const AUDIO_ELEMENT_FACTORY = new InjectionToken<(src: string) => HTMLAudioElement>(
  'AUDIO_ELEMENT_FACTORY',
  { providedIn: 'root', factory: () => (src: string) => new Audio(src) },
);

/** Builds the relative asset path for a word recording. */
export function audioPath(slug: string, speed: AudioSpeed): string {
  const base = (environment.assetBaseUrl ?? '').replace(/\/+$/, '');
  const path = `assets/audio/words/${slug}/${slug}-${speed}.mp3`;
  return base ? `${base}/${path}` : path;
}

/**
 * Plays pre-recorded word audio. Components pass a slug and never build paths.
 * `play()` never rejects: a null slug, audio turned off, a missing file, or
 * a browser that blocks playback all resolve silently (see content/audio.md).
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly store = inject(AppStore);
  private readonly createElement = inject(AUDIO_ELEMENT_FACTORY);
  private current: HTMLAudioElement | null = null;

  async play(slug: string | null | undefined, speed: AudioSpeed): Promise<void> {
    try {
      if (!slug || !this.store.settings().audioEnabled) {
        return;
      }
      this.stop();
      const element = this.createElement(audioPath(slug, speed));
      this.current = element;
      await element.play();
    } catch {
      // Missing file or blocked playback is expected. The UI shows the English word instead.
    }
  }

  /** Stops the sound that is playing, if any. */
  stop(): void {
    try {
      this.current?.pause();
    } catch {
      // Nothing to stop.
    }
    this.current = null;
  }
}
