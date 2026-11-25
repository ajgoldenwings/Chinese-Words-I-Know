# Progressive Disclosure Map

← [Design](../design.md)

Settings are individual boolean flags on `UserSettings`. Learning settings are grouped by **session type**, because flashcards and Listen + Tap use pinyin, characters and sound differently. They are revealed in the settings panel only — the settings panel itself is hidden behind the faint gear icon on the home screen.

Each flag is independent; enabling one does not require enabling another, and a flashcard flag never affects Listen + Tap or the other way round. Settings are stored locally at all times, whether or not the user has signed in, and are not synced in this version.

## Settings panel pages

The panel is a set of drill-down pages inside the same slide-in panel. Every page except the first has a back arrow (`←`, at least 44×44pt, labelled "Back to <parent page>") next to the title, and the close button (`✕`) on every page closes the whole panel. The panel always opens on the first page.

```
Settings
├── Learning Settings ›          "Choose what shows and plays in each kind of session."
│   ├── Flashcard Settings ›     "Pinyin, characters and sound for flashcards."
│   │   ├── Show Pinyin          (switch)
│   │   ├── Show Characters      (switch)
│   │   └── Audio                (switch)
│   └── Listen + Tap Settings ›  "Pinyin, characters and the repeat button for Listen + Tap."
│       ├── Show Pinyin          (switch)
│       ├── Show Characters      (switch)
│       └── Audio                (switch)
└── Save to Cloud                (button; see Cloud section below)
```

A row that opens a page shows its title, a one-line summary, and a `›`. A switch row shows its label and a one-line plain-language description.

## Flags

| Page | Flag | Label | Description shown | Default | Behavior when on |
|---|---|---|---|---|---|
| Flashcard Settings | `flashcardShowPinyin` | Show Pinyin | "Show how each word is pronounced, in letters, after the card is tapped." | false | Pinyin shows under the word **only after the card is tapped**. Its space is kept before the tap (invisible, hidden from screen readers), so the image never moves. Each new card hides it again until tapped |
| Flashcard Settings | `flashcardShowCharacters` | Show Characters | "Show the Chinese characters for each word under the picture." | false | Characters **always** show with the image, before and after the tap. They sit above the pinyin |
| Flashcard Settings | `flashcardAudio` | Audio | "Play a recording of each word when a card is tapped." | **true** | The natural recording plays on every tap of the card. When off, a tap still reveals the pinyin and the ✓ and ✗ buttons, silently, and the card's label says "Tap to reveal" instead of "Tap to hear" |
| Listen + Tap Settings | `listenShowPinyin` | Show Pinyin | "Show how each word is pronounced under a picture after it is tapped." | false | Pinyin shows under a picture **only after that picture is tapped**, right or wrong. Untapped pictures show none. A new round starts with none |
| Listen + Tap Settings | `listenShowCharacters` | Show Characters | "Show the Chinese characters for each word under the picture." | false | Characters **always** show under every picture |
| Listen + Tap Settings | `listenRepeatButton` | Audio | "Show a repeat button." | **true** | A **Repeat** button (🔊 Repeat) at the bottom of the screen plays the round's word again, slow. It shows only when the round's word has a recording. Turning it off removes only the button: Listen + Tap sound still plays on its own (below) |
| (none) | `cloudSyncEnabled` | — | — | false | Set by signing in and cleared by logging out; activates `SyncService` background cloud sync. It is not a switch (see Cloud section below) |

**Settings saved before the split:** the app used to have one `showPinyin`, `showCharacters` and `audioEnabled` for every screen. When stored state loads, each old value is copied to the flags that replace it: `showPinyin` to both Show Pinyin flags, `showCharacters` to both Show Characters flags, and `audioEnabled` to `flashcardAudio`. `listenRepeatButton` is new and starts on. A flag already saved under its new name wins. The old keys are not written again.

## Behavior

- New flags are appended to the table above as features are added; the panel renders them in the order defined here
- **Flashcard audio:** the word's natural recording plays only when the card is pressed and `flashcardAudio` is on. Nothing plays when a card appears, including the next card after an answer. Every press plays the word again from the start, not only the first. The first press also reveals the pinyin (if shown) and the ✓ and ✗ buttons. Answering, or leaving the session, stops any sound still playing
- **Listen + tap audio:** this sound is part of the game and always plays; there is no setting to turn it off. The target word's slow recording plays as soon as a round's pictures are displayed. After every press of a picture, the slow recording of the pressed picture's word plays, whether the press was right or wrong and including a repeat press on a wrong picture. A new press stops any recording still playing. Presses after the round is solved do nothing, because the tiles are disabled. A word with no recording stays silent, and the English prompt shows when the target has no recording
- **Repeat button:** medium-sized and fully visible, never small or faint. It is a rounded outlined button about 60pt high (at least 56pt), with the label "🔊 Repeat" and the accessible name "Hear the word again". It sits in the bottom bar under the pictures, next to the "Next →" button or the "Almost! Try another picture." message. It never advances the round
- **Wrong pictures:** a wrong picture fades, but only the picture; its characters and pinyin stay at full contrast
- **Pinyin fallback:** when a word would otherwise give the learner no Chinese (no recording for the word, or the mode's audio is off) and both of that mode's text flags are off, the screen shows that word's pinyin anyway, at the same moment the mode would show pinyin: after the card is tapped in flashcards, and under a picture after it is tapped in Listen + Tap. Listen + Tap audio always counts as on, so there the fallback depends only on the word having a recording. The fallback applies per word and never changes the saved settings
- **My Words:** the word detail view is not a guessing game, so it ignores the learning settings: it always shows pinyin and never shows characters

**Not a setting:** the light or dark theme follows the device and has no flag or toggle. See [Accessibility](accessibility.md#dark-theme).

**Cloud section (first page of the settings panel, under Learning Settings):**
- Signed out: one **Save to Cloud** button with its one-line description. Tapping it opens the account panel (sign in or create account). Signing in successfully sets `cloudSyncEnabled` to true. Closing the account panel without signing in changes nothing
- Signed in: the button becomes **Logout**, with the account email above it. Tapping Logout signs out and sets `cloudSyncEnabled` to false. Progress on the device stays
- Signed in also shows a sync line: "Last synced: <date and time>" (or "Not synced yet"), and a **refresh icon button** beside it. Tapping the icon pushes pending changes, then pulls and merges cloud progress. While a sync runs the icon spins and is disabled, so a second sync never starts. The icon is at least 44×44pt, has an accessible label ("Sync now"), and spinning is motion, not color
- If the last sync failed, a plain-language error shows under the sync line and stays until a sync succeeds. See [Error Handling](error-handling.md)
- Signed out hides the sync line and refresh icon



**Future flags (not yet implemented):**
- `scoreDecayEnabled` — enables confidence score decay over time
- `analyticsEnabled` — enables usage analytics
- Additional per-feature flags as the app grows
