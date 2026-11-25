# Product

Chinese Words I Know helps a parent and a young child (around age 3) learn Mandarin words together. The full spec is in `.kiro/specs/chinese-words-i-know/` (`requirements.md`, `design.md`, `tasks.md`). Read it before changing behavior.

## Rules for any UI change

- A learning session shows a full-screen image and the word, with a small, faint back button. The only other controls are the ones the session needs: the flashcard ✓ and ✗ buttons, and in Listen + Tap the Next button and an optional medium-sized Repeat button at the bottom.
- The home screen has one large Start Now button, smaller activity buttons below it, and a faint settings gear. No navigation bar, tab bar, or menu.
- Complexity stays hidden. Settings are individual boolean flags that appear only in the settings panel. Learning settings are grouped by session type (Flashcard, Listen + Tap) on drill-down pages under Learning Settings.
- Every tap target is at least 44×44pt, even when it looks smaller.
- Nothing times out or advances on its own. The child sets the pace.
- Never show a raw error or stack trace in a session. Error text is plain language written for a parent.
- Never signal right or wrong by color alone. Add a shape or motion change.
- Flashcard audio is on by default but optional. Listen + Tap sound always plays; its Audio setting only shows a Repeat button. Every screen must work with no audio file and no image file: show the English word as the prompt, and the category emoji in place of the image.
- The language is Mandarin in simplified characters. Pinyin and characters are off by default, and set separately per session type. Pinyin is shown for a word as a fallback when that word would otherwise give the learner no Chinese.
