# Product

Chinese Words I Know helps a parent and a young child (around age 3) learn Mandarin words together. The full spec is in `.kiro/specs/chinese-words-i-know/` (`requirements.md`, `design.md`, `tasks.md`). Read it before changing behavior.

## Rules for any UI change

- A learning session shows a full-screen image and the word. The only other control is a small, faint back button.
- The home screen has one large Start Now button, smaller activity buttons below it, and a faint settings gear. No navigation bar, tab bar, or menu.
- Complexity stays hidden. Settings are individual boolean flags that appear only in the settings panel.
- Every tap target is at least 44×44pt, even when it looks smaller.
- Nothing times out or advances on its own. The child sets the pace.
- Never show a raw error or stack trace in a session. Error text is plain language written for a parent.
- Never signal right or wrong by color alone. Add a shape or motion change.
- Audio is on by default but optional. Every screen must work with no audio file and no image file: show the English word as the prompt, and the category emoji in place of the image.
- The language is Mandarin in simplified characters. Pinyin and characters are off by default. Pinyin is shown for a word as a fallback when that word would otherwise give the learner no Chinese.
