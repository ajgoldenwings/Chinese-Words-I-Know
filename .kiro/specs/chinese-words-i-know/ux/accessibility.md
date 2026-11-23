# Accessibility

← [Design](../design.md)

These rules apply globally across all screens and both platforms (web and Capacitor native).

## Touch targets
- Every interactive element must meet a minimum hit area of **44 × 44 pt** (CSS pixels on web; logical pixels on iOS/Android)
- This applies to the faint back button, the settings icon, and all card/tile/button elements — even when visually small

## Color and contrast
- Text over any background must meet **WCAG AA contrast ratio** (4.5:1 for normal text, 3:1 for large text ≥ 18pt)
- Word labels (English, pinyin, characters) must remain legible when displayed over word images — use a text-shadow or semi-transparent backdrop if the image is light
- Never convey information through color alone (e.g. correct/incorrect feedback must include a shape change or animation, not just a color change)

## Audio is not required
- The app must be fully usable with audio off (the parent can turn it off in settings, and words without a recording have no audio)
- During listen + tap mode with no audio, the English word is shown as the prompt — the interaction does not break

## No time pressure
- No session element should time out or auto-advance
- The child (or parent) controls all pacing; nothing moves forward without a tap

## Font size
- English word labels: minimum **24pt** in session screens
- Pinyin labels (when shown): minimum **18pt**
- Chinese character labels (when shown): minimum **28pt**
- Home screen and category button text: minimum **20pt**

## Motion
- Animations should be calm and brief (≤ 300ms for transitions)
- No flashing or strobing effects
- Future: respect the device `prefers-reduced-motion` media query to disable animations for users with vestibular disorders

## Screen readers
- Every word image has alt text equal to the word's English label (plus the pinyin when pinyin is shown)
- Every icon-only control has an accessible name: "Got it", "Not yet", "Back", "Settings"
- Answer feedback (correct or incorrect) is announced through an `aria-live` region as well as shown visually
- Focus order follows reading order on every screen
