import { SESSION_RANDOM } from '../../src/web/app/services/session-random';

/**
 * Makes session order predictable in tests: with a random value just under 1, every shuffle
 * keeps its input order, so passes and Listen + Tap targets follow content order.
 * Tests that check the randomness itself provide their own source instead.
 */
export const FIXED_ORDER = { provide: SESSION_RANDOM, useValue: () => 0.999999 };
