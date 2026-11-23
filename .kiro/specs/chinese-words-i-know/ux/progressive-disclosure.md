# Progressive Disclosure Map

← [Design](../design.md)

Settings are individual boolean flags on `UserSettings`. All default to `false` except `audioEnabled`, which defaults to `true`. They are revealed in the settings panel only — the settings panel itself is hidden behind the faint gear icon on the home screen.

Each flag is independent; enabling one does not require enabling another. Settings are stored locally at all times, whether or not the user has signed in, and are not synced in this version.

| Flag | Default | What it adds | UI location when enabled |
|---|---|---|---|
| `showPinyin` | false | Pinyin romanization shown below the word image in all session screens. Also shown automatically as a fallback (see below) | Below word image; above character if both enabled |
| `showCharacters` | false | Simplified Chinese characters shown below the word image | Below pinyin if both shown; below image if only characters |
| `audioEnabled` | **true** | Pre-recorded audio plays automatically on card reveal and in listen + tap mode; degrades to English text prompt if no audio file exists for a word | No visible UI change; audio plays on interaction |
| `cloudSyncEnabled` | false | Triggers Cognito sign-in; activates `SyncService` background cloud sync | A sync status indicator appears faintly in settings panel only |

**Settings panel behavior:**
- Each setting has a toggle and a one-line plain-language description of what it does
- `audioEnabled` defaults to `true`; it can be toggled off in settings if the parent prefers a silent session
- `cloudSyncEnabled` toggle triggers the Cognito sign-in flow on first enable; subsequent app opens re-authenticate silently
- New flags are appended to this table as features are added; the settings panel renders them in the order defined here
- **Pinyin fallback:** when a word would otherwise give the learner no Chinese (no audio for the word, or `audioEnabled` is off) and both `showPinyin` and `showCharacters` are off, session screens show that word's pinyin anyway. The fallback applies per word and never changes the saved settings

**Future flags (not yet implemented):**
- `scoreDecayEnabled` — enables confidence score decay over time
- `analyticsEnabled` — enables usage analytics
- Additional per-feature flags as the app grows
