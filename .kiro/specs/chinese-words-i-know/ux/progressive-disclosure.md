# Progressive Disclosure Map

← [Design](../design.md)

Settings are individual boolean flags on `UserSettings`. All default to `false` except `audioEnabled`, which defaults to `true`. They are revealed in the settings panel only — the settings panel itself is hidden behind the faint gear icon on the home screen.

Each flag is independent; enabling one does not require enabling another. Settings are stored locally at all times, whether or not the user has signed in, and are not synced in this version.

| Flag | Default | What it adds | UI location when enabled |
|---|---|---|---|
| `showPinyin` | false | Pinyin romanization shown below the word image in all session screens. Also shown automatically as a fallback (see below) | Below word image; above character if both enabled |
| `showCharacters` | false | Simplified Chinese characters shown below the word image | Below pinyin if both shown; below image if only characters |
| `audioEnabled` | **true** | Pre-recorded audio plays automatically on card reveal and in listen + tap mode; degrades to English text prompt if no audio file exists for a word | No visible UI change; audio plays on interaction |
| `cloudSyncEnabled` | false | Set by signing in and cleared by logging out; activates `SyncService` background cloud sync. It is not a toggle row (see Cloud section below) | A Cloud section at the bottom of the settings panel only |

**Settings panel behavior:**
- Each setting has a toggle and a one-line plain-language description of what it does
- `audioEnabled` defaults to `true`; it can be toggled off in settings if the parent prefers a silent session
- `cloudSyncEnabled` has no toggle. See **Cloud section** below
- New flags are appended to this table as features are added; the settings panel renders them in the order defined here
- **Pinyin fallback:** when a word would otherwise give the learner no Chinese (no audio for the word, or `audioEnabled` is off) and both `showPinyin` and `showCharacters` are off, session screens show that word's pinyin anyway. The fallback applies per word and never changes the saved settings

**Cloud section (bottom of the settings panel):**
- Signed out: one **Save to Cloud** button with its one-line description. Tapping it opens the account panel (sign in or create account). Signing in successfully sets `cloudSyncEnabled` to true. Closing the account panel without signing in changes nothing
- Signed in: the button becomes **Logout**, with the account email above it. Tapping Logout signs out and sets `cloudSyncEnabled` to false. Progress on the device stays
- Signed in also shows a sync line: "Last synced: <date and time>" (or "Not synced yet"), and a **refresh icon button** beside it. Tapping the icon pushes pending changes, then pulls and merges cloud progress. While a sync runs the icon spins and is disabled, so a second sync never starts. The icon is at least 44×44pt, has an accessible label ("Sync now"), and spinning is motion, not color
- If the last sync failed, a plain-language error shows under the sync line and stays until a sync succeeds. See [Error Handling](error-handling.md)
- Signed out hides the sync line and refresh icon

**Future flags (not yet implemented):**
- `scoreDecayEnabled` — enables confidence score decay over time
- `analyticsEnabled` — enables usage analytics
- Additional per-feature flags as the app grows
