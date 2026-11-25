/**
 * Stored locally at all times, independent of sign-in. Not synced in this version.
 * Every setting is one boolean flag. Learning settings are grouped by session type
 * (ux/progressive-disclosure.md): `flashcard*` and `listen*`.
 */
export interface UserSettings {
  /** Flashcards: shows pinyin under the word after the card is tapped. */
  flashcardShowPinyin: boolean;
  /** Flashcards: shows simplified Chinese characters with the image at all times. */
  flashcardShowCharacters: boolean;
  /** Flashcards: plays the natural recording each time the card is tapped. */
  flashcardAudio: boolean;
  /** Listen + Tap: shows pinyin under a picture after it is tapped, right or wrong. */
  listenShowPinyin: boolean;
  /** Listen + Tap: shows simplified Chinese characters under every picture. */
  listenShowCharacters: boolean;
  /** Listen + Tap: shows a button that plays the word again. The word always plays on its own. */
  listenRepeatButton: boolean;
  /** Enables Cognito sign-in and DynamoDB sync. Set by signing in, cleared by logging out. */
  cloudSyncEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  flashcardShowPinyin: false,
  flashcardShowCharacters: false,
  flashcardAudio: true,
  listenShowPinyin: false,
  listenShowCharacters: false,
  listenRepeatButton: true,
  cloudSyncEnabled: false,
};

/**
 * Settings saved before they were split by session type, mapped to the flags that replace them.
 * Read once when stored state loads (`parsePersistedState`); a new flag that is already saved wins.
 */
export const LEGACY_SETTING_KEYS: Readonly<Record<string, readonly (keyof UserSettings)[]>> = {
  showPinyin: ['flashcardShowPinyin', 'listenShowPinyin'],
  showCharacters: ['flashcardShowCharacters', 'listenShowCharacters'],
  audioEnabled: ['flashcardAudio'],
};
