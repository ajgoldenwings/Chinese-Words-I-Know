import { inject } from '@angular/core';
import { patchState, signalStore, watchState, withHooks, withMethods, withState } from '@ngrx/signals';
import { normalizeScore } from '../confidence';
import { DEFAULT_USER_SETTINGS } from '../entities';
import type { UserSettings, UserWordState } from '../entities';
import { migrateContent, type MigrationContent, type MigrationResult } from './migration';
import { APP_STORAGE, STORE_STORAGE_KEY } from './storage';

export interface AppState {
  /** Keyed by wordId. Only words that have been written appear here. */
  wordStates: Record<string, UserWordState>;
  settings: UserSettings;
  /** Content version last migrated to. `null` until a migration runs. */
  lastContentVersion: number | null;
}

export const initialAppState: AppState = {
  wordStates: {},
  settings: { ...DEFAULT_USER_SETTINGS },
  lastContentVersion: null,
};

/** State for a word that has not been seen yet. */
export function createDefaultWordState(wordId: string): UserWordState {
  return {
    wordId,
    confidenceScore: 0,
    timesSeenCount: 0,
    lastSeenAt: '',
    manualOverride: null,
    updatedAt: '',
    syncStatus: 'pending',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads persisted state defensively. Bad or missing data yields defaults, never an error. */
export function parsePersistedState(raw: string | null): AppState {
  if (!raw) {
    return initialAppState;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return initialAppState;
    }
    const wordStates: Record<string, UserWordState> = {};
    if (isRecord(parsed['wordStates'])) {
      for (const [id, value] of Object.entries(parsed['wordStates'])) {
        if (isRecord(value)) {
          wordStates[id] = {
            ...createDefaultWordState(id),
            ...(value as Partial<UserWordState>),
            wordId: id,
          };
        }
      }
    }
    const settings: UserSettings = { ...DEFAULT_USER_SETTINGS };
    if (isRecord(parsed['settings'])) {
      for (const key of Object.keys(DEFAULT_USER_SETTINGS) as (keyof UserSettings)[]) {
        const v = parsed['settings'][key];
        if (typeof v === 'boolean') {
          settings[key] = v;
        }
      }
    }
    const version = parsed['lastContentVersion'];
    return {
      wordStates,
      settings,
      lastContentVersion: typeof version === 'number' ? version : null,
    };
  } catch {
    return initialAppState;
  }
}

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>(initialAppState),
  withMethods((store) => ({
    /** Returns the stored state, or a fresh default (score 0, seen 0) for an unseen word. */
    getWordState(wordId: string): UserWordState {
      return store.wordStates()[wordId] ?? createDefaultWordState(wordId);
    },
    /** Writes the state for a word. The score is rounded to 2 decimals. */
    setWordState(state: UserWordState): void {
      const next: UserWordState = {
        ...state,
        confidenceScore: normalizeScore(state.confidenceScore),
      };
      patchState(store, (s) => ({ wordStates: { ...s.wordStates, [next.wordId]: next } }));
    },
    /** Applies a partial update to the settings. Works whether or not the user is signed in. */
    updateSettings(changes: Partial<UserSettings>): void {
      patchState(store, (s) => ({ settings: { ...s.settings, ...changes } }));
    },
    setLastContentVersion(version: number): void {
      patchState(store, { lastContentVersion: version });
    },
    /** Run on app load, after content loads. Migrates when the content version is newer. */
    migrateContent(content: MigrationContent): MigrationResult {
      const result = migrateContent(
        { wordStates: store.wordStates(), lastContentVersion: store.lastContentVersion() },
        content,
      );
      if (result.migrated) {
        patchState(store, {
          wordStates: result.wordStates,
          lastContentVersion: result.lastContentVersion,
        });
      }
      return result;
    },
  })),
  withHooks({
    onInit(store) {
      const storage = inject(APP_STORAGE);
      let loaded: AppState;
      try {
        loaded = parsePersistedState(storage.getItem(STORE_STORAGE_KEY));
      } catch {
        loaded = initialAppState;
      }
      patchState(store, loaded);
      // The first callback runs immediately with the loaded state, which rewrites it harmlessly.
      watchState(store, (state) => {
        try {
          storage.setItem(STORE_STORAGE_KEY, JSON.stringify(state));
        } catch {
          // A full or blocked storage must not break a session.
        }
      });
    },
  }),
);
