import { InjectionToken } from '@angular/core';

/**
 * Random source for session order (which word comes next, and Listen + Tap tiles).
 * Returns a number in [0, 1). Defaults to `Math.random`; tests replace it to fix the order.
 */
export const SESSION_RANDOM = new InjectionToken<() => number>('SESSION_RANDOM', {
  providedIn: 'root',
  factory: () => Math.random,
});
