# Requirements

← [Design](design.md) · [Tasks](tasks.md)

What Chinese Words I Know must do. The design in [Design](design.md) says how, and [Tasks](tasks.md) says in what order.

## Problem Statement

A parent and young child learn Mandarin Chinese together through a minimal, distraction-free app. The experience starts in "zen mode" — a full-screen image with audio — and reveals settings (pinyin, characters, difficulty controls) only as the learner chooses to unlock them. The app tracks ~1000 words using a confidence model and surfaces what you know, what you're close to knowing, and what to learn next.

---

## Requirements

Tasks cite these by number (for example `_Requirements: 5, 6_`).

1. **Learners:** Parent + child together, learning Mandarin
2. **Core interactions:** Flashcard recall (see → remember) and listening + tapping (hear → identify)
3. **Chinese:** Mandarin, simplified characters. Pinyin and character display are off by default, toggleable as settings
4. **Content:** Thematic categories (animals, food, colors, etc.) as the structure for learning. Lessons are a future feature. ~1000 word ceiling
5. **Word knowledge model:** App-driven confidence scoring (auto tracks right/wrong) with manual parent override (mark known/unknown). Confidence model is defined in [Confidence Model](core/confidence-model.md)
6. **Word lists:** "Words I Know" (Known), "Almost There" (close to known), "Learn Next" (recommended queue)
7. **Audio:** Pre-recorded audio files only. Audio is on by default and can be turned off in settings. Words without a recording show the English word as a text prompt instead. TTS fallback is a future feature
8. **Offline:** After the first load the app works without a connection (service worker). Progress is saved on the device and syncs when the connection returns
9. **Zen mode:** During a learning session, screen is full-screen image + word, only a small faint back button visible. Home screen is minimal
10. **Progressive disclosure:** Settings and complexity are hidden by default and revealed intentionally. No menus on first use
11. **Platform:** Web app first. Folder structure supports future iOS and Android targets (`src/ios`, `src/android`) via Capacitor
12. **Scope:** ~1000 words max for this version
13. **Progress sync:** Progress is always saved on the device. A parent can optionally create an account so progress also syncs to the cloud and survives a device change or reinstall. Sync is off by default, and the app works fully without an account. Settings shows a Save to Cloud button (Logout once signed in), the time of the last successful sync, a refresh icon that syncs on demand, and a plain-language error when a sync fails
