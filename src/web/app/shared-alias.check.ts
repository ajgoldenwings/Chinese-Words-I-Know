import { DEFAULT_USER_SETTINGS, type Word } from '@shared/entities';

/** Build check: proves the @shared/* alias resolves from app code. */
export type AliasCheckWord = Word;
export const aliasCheckSettings = DEFAULT_USER_SETTINGS;
