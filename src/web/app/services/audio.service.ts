import { Injectable, InjectionToken, inject } from '@angular/core';
import { AppStore } from '@shared/store';
import { environment } from '../../environments/environment';

export type AudioSpeed = 'natural' | 'slow';
export interface PlayOptions {
  /**
   * Start just after the 0.3 s of silence every recording begins with (content/audio.md),
   * so a press sounds at once. Used for presses, not for sound that plays by itself.
   */
  skipLeadIn?: boolean;
}
/** Seconds skipped with `skipLeadIn`. A little under the 0.3 s padding so no speech is cut. */
export const LEAD_IN_SKIP_S = 0.25;

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

/** `HTMLMediaElement.HAVE_METADATA`: the duration is known, so `currentTime` can be set. */
const HAVE_METADATA = 1;

/** A tenth of a second of silence (8 kHz, 8-bit mono WAV). Played once on the first tap to unlock audio. */
export const SILENT_WAV = (() => {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence is the midpoint
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
})();
/**
 * Plays pre-recorded word audio. Components pass a slug and never build paths.
 * `play()` never rejects: a null slug, audio turned off, a missing file, or
 * a browser that blocks playback all resolve silently (see content/audio.md).
 *
 * One audio element is reused for every sound. iOS Safari and some other browsers only
 * allow `play()` outside a tap on an element that has already played from a tap. The first
 * tap anywhere in the app plays a short silence on that element, so later sounds (for example
 * the word that plays when a Listen + Tap round's pictures have loaded) are allowed.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly store = inject(AppStore);
  private readonly createElement = inject(AUDIO_ELEMENT_FACTORY);
  private element: HTMLAudioElement | null = null;
  private unlocked = false;
  /** Path of the recording loaded in the element, or null for none or the unlock silence. */
  private loadedPath: string | null = null;
  constructor() {
    const doc = globalThis.document;
    if (!doc?.addEventListener) return;
    const onGesture = () => {
      doc.removeEventListener('pointerdown', onGesture, true);
      doc.removeEventListener('keydown', onGesture, true);
      this.unlock();
    };
    doc.addEventListener('pointerdown', onGesture, true);
    doc.addEventListener('keydown', onGesture, true);
  }
  /** Plays a silence from inside a tap so later sounds may play. Safe to call more than once. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const el = this.getElement(SILENT_WAV);
      el.src = SILENT_WAV;
      this.loadedPath = null;
      void Promise.resolve(el.play()).catch(() => undefined);
    } catch {
      // Unlocking is best effort.
    }
  }
  async play(slug: string | null | undefined, speed: AudioSpeed, options: PlayOptions = {}): Promise<void> {
    try {
      if (!slug || !this.store.settings().audioEnabled) {
        return;
      }
      this.stop();
      const path = audioPath(slug, speed);
      const start = options.skipLeadIn ? LEAD_IN_SKIP_S : 0;
      const element = this.getElement(path);
      if (this.loadedPath === path && element.readyState >= HAVE_METADATA) {
        // Same recording again: rewind instead of reloading, so it plays without a delay.
        element.currentTime = start;
      } else {
        // A media fragment (#t=) starts playback at the offset as soon as the file loads.
        element.src = start > 0 ? `${path}#t=${start}` : path;
        this.loadedPath = path;
      }
      this.unlocked = true;
      await element.play();
    } catch {
      // Missing file or blocked playback is expected. The UI shows the English word instead.
    }
  }
  /** Stops the sound that is playing, if any. */
  stop(): void {
    try {
      this.element?.pause();
    } catch {
      // Nothing to stop.
    }
  }
  private getElement(src: string): HTMLAudioElement {
    this.element ??= this.createElement(src);
    return this.element;
  }
}
