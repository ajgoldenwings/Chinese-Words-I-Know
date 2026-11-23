/** Stored locally at all times, independent of sign-in. Not synced in this version. */
export interface UserSettings {
  /** Shows pinyin under each word. */
  showPinyin: boolean;
  /** Shows simplified Chinese characters. */
  showCharacters: boolean;
  /** Plays pre-recorded audio on card reveal and in listen + tap mode. */
  audioEnabled: boolean;
  /** Enables Cognito sign-in and DynamoDB sync. */
  cloudSyncEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  showPinyin: false,
  showCharacters: false,
  audioEnabled: true,
  cloudSyncEnabled: false,
};
