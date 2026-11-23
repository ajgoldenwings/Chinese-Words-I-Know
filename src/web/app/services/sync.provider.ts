import {
  EnvironmentProviders,
  InjectionToken,
  effect,
  inject,
  provideAppInitializer,
  untracked,
} from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { UserWordState } from '@shared/entities';
import { AppStore } from '@shared/store';
import { SyncService } from '@shared/sync';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Base URL of the sync API. Empty means cloud sync is not set up and the wiring stays inert. */
export const SYNC_API_URL = new InjectionToken<string>('SYNC_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

/** Reads the Cognito ID token (the API authorizer checks its audience). Null when signed out. */
export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Token source for SyncService. Tests can override it. */
export const SYNC_GET_TOKEN = new InjectionToken<() => Promise<string | null>>('SYNC_GET_TOKEN', {
  providedIn: 'root',
  factory: () => getIdToken,
});

/**
 * Builds the SyncService, restores the sign-in state, runs `syncOnLoad` when signed in with
 * cloud sync on, and marks records dirty on every local word-state change.
 * Returns null (and does nothing) when the API URL is empty.
 */
export function startSync(): SyncService | null {
  const apiUrl = inject(SYNC_API_URL);
  const auth = inject(AuthService);
  // Restore the signed-in state either way. It does nothing when Cognito is not configured.
  void auth.restore();
  if (!apiUrl) {
    return null;
  }
  const store = inject(AppStore);
  const getToken = inject(SYNC_GET_TOKEN);

  const sync = new SyncService({
    store,
    apiBaseUrl: apiUrl,
    getToken: async () => (auth.signedIn() ? getToken() : null),
  });
  sync.start();

  // Mark local edits dirty. Records already marked synced (from the cloud or after a flush) are skipped.
  let previous: Record<string, UserWordState> = store.wordStates();
  effect(() => {
    const current = store.wordStates();
    untracked(() => {
      const active = auth.signedIn() && store.settings().cloudSyncEnabled;
      for (const [id, state] of Object.entries(current)) {
        if (previous[id] !== state && state.syncStatus === 'pending' && state.updatedAt !== '' && active) {
          sync.markDirty(id);
        }
      }
      previous = current;
    });
  });

  // Pull and merge whenever the parent is signed in with cloud sync on.
  effect(() => {
    if (auth.signedIn() && store.settings().cloudSyncEnabled) {
      untracked(() => void sync.syncOnLoad());
    }
  });

  return sync;
}

/** Add to `appConfig.providers`. Inert when `apiUrl` is empty or the user is signed out. */
export function provideCloudSync(): EnvironmentProviders {
  return provideAppInitializer(() => {
    startSync();
  });
}
