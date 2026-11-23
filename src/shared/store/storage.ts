import { InjectionToken } from '@angular/core';

/** Minimal key-value storage. `localStorage` satisfies it; tests use the in-memory version. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function browserStorage(): KeyValueStorage {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      return ls;
    }
  } catch {
    // Access can throw when storage is blocked. Fall through to memory.
  }
  return new MemoryStorage();
}

export const APP_STORAGE = new InjectionToken<KeyValueStorage>('APP_STORAGE', {
  providedIn: 'root',
  factory: browserStorage,
});

export const STORE_STORAGE_KEY = 'cwik.store.v1';
