# Audio

← [Design](../design.md)

## Overview

All audio is pre-recorded by a native Mandarin speaker. No TTS is used in this version. Each session type has its own audio setting (see [Progressive Disclosure](../ux/progressive-disclosure.md)). In flashcards, `flashcardAudio` (on by default) plays the word on every tap of the card. In Listen + Tap the sound always plays, because hearing the word is the game; its Audio setting, `listenRepeatButton` (on by default), only adds a Repeat button that plays the word again. Words without a recording stay silent and the UI shows the English word instead. If pinyin and character display are both off, the word's pinyin is shown as a fallback so the learner still sees some Chinese (see [Progressive Disclosure](../ux/progressive-disclosure.md)).

Each word has two recordings:
- **Natural** — spoken at a normal conversational pace; plays in flashcard mode on every press of the card
- **Slow** — spoken clearly and slowly; plays in listen + tap mode to help young learners isolate the sounds. It plays twice per round: when the pictures appear (the target word), and after every press of a picture (the pressed picture's word). See [Progressive Disclosure](../ux/progressive-disclosure.md)

## Format and Quality

| Property | Value | Reason |
|---|---|---|
| Format | MP3 | Universal support across all browsers, iOS, and Android |
| Sample rate | 44.1 kHz | Standard for speech recordings |
| Bit rate | 128 kbps mono | High enough quality for clear speech; ~60–80 KB per file |
| Silence padding | 0.3s before, 0.3s after | Prevents clipping; gives the child a moment before and after the word. Playback always starts at `0`. The lead-in is never skipped: browsers seek in an MP3 in steps of about 26 ms, and the audio output can take a moment to start (especially on Bluetooth), so a shorter lead-in clips the start of the word |
| Approximate total size | ~160 MB | 2000 files × ~80 KB average |

## File Naming Convention

Files are named using the word's **ID slug**, a lowercase ASCII string derived from the word's pinyin (see [Slug Rules](#slug-rules)). This avoids Chinese characters and diacritics in filenames across all operating systems.

```
assets/audio/words/<slug>/<slug>-natural.mp3
assets/audio/words/<slug>/<slug>-slow.mp3
```

Examples:

| Word | Simplified | Pinyin | Slug | Natural file | Slow file |
|---|---|---|---|---|---|
| Cat | 猫 | māo | mao | `mao/mao-natural.mp3` | `mao/mao-slow.mp3` |
| Dog | 狗 | gǒu | gou | `gou/gou-natural.mp3` | `gou/gou-slow.mp3` |
| Hello | 你好 | nǐ hǎo | ni-hao | `ni-hao/ni-hao-natural.mp3` | `ni-hao/ni-hao-slow.mp3` |
| Water | 水 | shuǐ | shui | `shui/shui-natural.mp3` | `shui/shui-slow.mp3` |

## Slug Rules

The slug is the word's permanent ID. It is used as `Word.id`, as `UserWordState.wordId`, and in file and folder names.

1. Take the word's pinyin without tone marks.
2. Separate syllables with a single hyphen: `xióngmāo` → `xiong-mao`, `tùzi` → `tu-zi`.
3. Write `ü` as `v`: `lǜsè` → `lv-se`.
4. Drop apostrophes: `wǎn'ān` → `wan-an`.
5. If two words would get the same slug, the first word added keeps the bare slug and later ones append their English gloss: `shi` (ten, 十) and `shi-yes` (yes, 是); `he` (river) and `he-drink`.
6. A slug never changes once published, even if the pinyin is later corrected (see [Content Versioning](../core/content-versioning.md)).
7. Slugs are unique across all words. The content loader test enforces this and checks each slug against `^[a-z]+(-[a-z]+)*$`.

## Entity Field Mapping

The `Word` entity's `audioAsset` field stores the slug, not the full path. `AudioService` builds the path at runtime from the slug and the playback speed:

```ts
// audioAsset stores the slug only
word.audioAsset = "mao"   // null if not yet recorded

// AudioService builds a relative path, prefixed with environment.assetBaseUrl
// ('' while assets are bundled):
//   assets/audio/words/mao/mao-natural.mp3
```

The path is relative, so it resolves against `<base href>` on web (including the GitHub Pages subpath) and against Capacitor's local origin on iOS and Android. While assets are bundled, no per-platform URL logic is needed.

## AudioService

A single `AudioService` in `src/shared/` abstracts path construction and playback. All consumers call `AudioService.play(slug, speed)`. No component touches a raw file path.

```ts
AudioService.play(slug: string, speed: 'natural' | 'slow'): Promise<void>
```

- Plays through the native `HTMLAudioElement` on every platform. Capacitor's WebView supports it, so no native audio plugin is needed.
- Reads no setting. Each screen checks its own audio setting before calling `play()` (flashcards check `flashcardAudio`; Listen + Tap always plays).
- Resolves immediately without error when the word's `audioAsset` is `null`, when the file fails to load, or when the browser rejects playback because the user has not interacted yet. The UI handles missing audio gracefully (no sound, no crash).
- Browsers block audio until the first user tap. The first tap on Start Now or a category button unlocks playback.

## Recording Session Guide for Native Speaker

The following instructions should be shared with the native Mandarin speaker before the recording session.

**Setup:**
- Record in a quiet room with no echo
- Use a condenser microphone if available; a phone voice memo app is acceptable as a fallback
- Speak directly into the mic at a consistent distance (~20cm)
- Record all files at 44.1 kHz, export as MP3 at 128 kbps mono

**Per word, record two takes:**
1. **Natural** — say the word once at a normal, friendly conversational pace, as if saying it to a child you know
2. **Slow** — say the word once more, clearly and slowly, stretching each syllable slightly; do not over-exaggerate

**Tone quality:**
- Warm, calm, encouraging — this is for a 3-year-old
- Consistent volume and energy across all recordings
- Do not whisper, shout, or use a sing-song tone

**File handoff:**
- Name each file exactly as specified in the naming convention above
- Deliver as a zip organized by word folder: `mao/mao-natural.mp3`, `mao/mao-slow.mp3`, etc.
- After delivery, files drop directly into `assets/audio/words/` with no renaming needed

---

See [Word Lists](word-lists.md) for the full recording checklist.
