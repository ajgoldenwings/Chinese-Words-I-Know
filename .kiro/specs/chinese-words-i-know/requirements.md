# Requirements

← [Design](design.md) · [Tasks](tasks.md)

What Chinese Words I Know must do. The design in [Design](design.md) says how, and [Tasks](tasks.md) says in what order.

## Problem Statement

A parent and young child learn Mandarin Chinese together through a minimal, distraction-free app. The experience starts in "zen mode" — a full-screen image with audio — and reveals settings (pinyin, characters, difficulty controls) only as the learner chooses to unlock them. The app tracks ~1000 words using a confidence model and surfaces what you know, what you're close to knowing, and what to learn next.

---

## Requirements

Tasks cite these by number (for example `_Requirements: 5, 6_`).

1. **Learners:** Parent + child together, learning Mandarin
2. **Core interactions:** Flashcard recall (see → remember) and listening + tapping (hear → identify). In both, the next word is random
3. **Chinese:** Mandarin, simplified characters. Pinyin and character display are off by default, and set separately for each session type (flashcards and Listen + Tap) under Learning Settings
4. **Content:** Thematic categories (animals, food, colors, etc.) as the structure for learning. Lessons are a future feature. ~1000 word ceiling
5. **Word knowledge model:** App-driven confidence scoring (auto tracks right/wrong) with manual parent override (mark known/unknown). Confidence model is defined in [Confidence Model](core/confidence-model.md)
6. **Word lists:** "Words I Know" (Known), "Almost There" (the 10 highest-scoring words above 0 that are not yet known, each with its confidence state label), "Learn Next" (recommended queue)
7. **Audio:** Pre-recorded audio files only. Flashcard audio is on by default and can be turned off in Flashcard Settings. Listen + Tap sound always plays, because it is the game; its Audio setting shows or hides a Repeat button (on by default). Words without a recording show the English word as a text prompt instead. TTS fallback is a future feature
8. **Offline:** After the first load the app works without a connection (service worker). Progress is saved on the device and syncs when the connection returns
9. **Zen mode:** During a learning session, screen is full-screen image + word, with a small faint back button. The only other controls are the ones a session needs: the flashcard ✓ and ✗ buttons, and in Listen + Tap the Next button and an optional medium-sized Repeat button at the bottom. Home screen is minimal
10. **Progressive disclosure:** Settings and complexity are hidden by default and revealed intentionally. No menus on first use. Learning settings are grouped by session type in drill-down pages inside the settings panel
11. **Platform:** Web app first. Folder structure supports future iOS and Android targets (`src/ios`, `src/android`) via Capacitor
12. **Scope:** ~1000 words max for this version
13. **Progress sync:** Progress is always saved on the device. A parent can optionally create an account so progress also syncs to the cloud and survives a device change or reinstall. Sync is off by default, and the app works fully without an account. Settings shows a Save to Cloud button (Logout once signed in), the time of the last successful sync, a refresh icon that syncs on demand, and a plain-language error when a sync fails
14. **Dark theme:** The app follows the device's light or dark mode automatically, and changes as soon as the device setting changes, with no reload. There is no in-app theme toggle and no theme setting
