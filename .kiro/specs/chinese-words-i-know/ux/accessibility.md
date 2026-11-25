# Accessibility

← [Design](../design.md)

These rules apply globally across all screens and both platforms (web and Capacitor native).

## Touch targets
- Every interactive element must meet a minimum hit area of **44 × 44 pt** (CSS pixels on web; logical pixels on iOS/Android)
- This applies to the faint back button, the settings icon, the settings back arrow, and all card/tile/button elements — even when visually small
- The Listen + Tap Repeat button is deliberately larger, at least 56pt high, and fully visible, because a child uses it

## Color and contrast
- Text over any background must meet **WCAG AA contrast ratio** (4.5:1 for normal text, 3:1 for large text ≥ 18pt)
- Word labels (English, pinyin, characters) must remain legible when displayed over word images — use a text-shadow or semi-transparent backdrop if the image is light
- Never convey information through color alone (e.g. correct/incorrect feedback must include a shape change or animation, not just a color change)

## Dark theme
The app follows the device's theme. There is no toggle in the app, and the theme is not one of the settings flags.
- **Source:** the CSS media feature `prefers-color-scheme`. Tailwind's `dark:` variant uses it by default, so no theme state is stored, and nothing is written to `UserSettings` or `localStorage`
- **Live:** when the device switches between light and dark (by hand, or on a schedule such as sunset), the app changes at once, mid-session, with no reload and no lost progress
- **Native controls:** `:root` sets `color-scheme: light dark`, and `index.html` has `<meta name="color-scheme" content="light dark">`, so inputs, checkboxes, and scrollbars follow the theme too
- **Boot screen and browser bar:** the boot screen in `index.html` has its own dark background, because it shows before the app stylesheet loads. `theme-color` has a light value (the logo color) and a dark value (`#020617`), each with a `media` query. The installed-app splash uses the manifest's single `background_color` (white), which cannot follow the theme
- **Palette:** every color class has a `dark:` partner. Pages and panels use dark slate backgrounds (`slate-950` on the home screen, `slate-900` elsewhere) with light slate text. Dark buttons turn light with dark text. Status colors keep their meaning: success stays green, and errors use a dark red background with light red text
- **Contrast:** the WCAG AA rules above apply in both themes
- **Word images:** they are transparent PNGs, and some are mostly black (for example the color black). In dark mode each word image gets a thin light outline that follows the drawing's shape (`.word-image`, a CSS `drop-shadow`), so it stays visible without a light box on a dark screen. The category emoji fallback needs no change
- **Feedback:** right and wrong still use a shape or motion change, never color alone, in both themes

## Audio is not required
- The app must be fully usable with audio off (the parent can turn it off in settings, and words without a recording have no audio)
- During listen + tap mode, when the round's word has no recording, the English word is shown as the prompt and the Repeat button is hidden — the interaction does not break

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
