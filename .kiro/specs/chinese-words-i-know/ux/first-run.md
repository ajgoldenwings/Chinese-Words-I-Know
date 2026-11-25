# First-Run Experience & Home Screen

← [Design](../design.md)

## First launch (no prior data)

When no `localStorage` data exists, the app shows the home screen with one prominent affordance:

- A large **"Start Now"** button in the center. Tapping it immediately begins the predetermined first session (Animals category, flashcard mode)
- Below it, smaller activity buttons so the parent can choose a different starting point (see below)
- A faint settings icon (gear) in a corner. It is visible but understated; the child will not notice or tap it accidentally

The app does not show a splash screen, tutorial overlay, or onboarding flow. The parent and child just tap Start Now and begin.

## Activity buttons

The smaller buttons below Start Now are:

| Button | What it does |
|---|---|
| **One per category** | Starts a flashcard session for that category |
| **Listen & Tap** | Starts a listen + tap session. Shown only once at least one category has 4 or more words with an image, because the mode needs distinct images to tap. Target words come from a qualifying category, in random order (see [Session order](#session-order)). The three distractors come from the same category as the target |
| **My Words** | Opens the My Words screen |

When the buttons do not fit on one screen, the home screen scrolls vertically. Start Now stays at the top. There is no pagination and no menu.

## Returning user

When prior data exists, **Start Now** opens a flashcard session over the **Learn Next** list (see [Learn Next Algorithm](../core/learn-next-algorithm.md)) at `/session/learn-next`:

- The words are the Learn Next list, up to 20. They can come from any category. Learn Next decides **which** words are in the session; they are shown in random order (see [Session order](#session-order))
- The list is rebuilt and shuffled again at the start of every pass, so a new pass follows the latest scores. The session is continuous like any flashcard session
- A word with no image shows the emoji of its own category
- If the Learn Next list is empty (every word is at `0.6` or above), Start Now opens a single category instead, chosen in this order:
  1. The category with the most words in the Learning state (`[0.3, 0.6)`). Ties go to the category that comes first in content order
  2. If no word is in the Learning state, the first category in content order that still has a word below Known
  3. If every word is Known, the first category in content order
- The same fallback applies if every word reaches `0.6` during a Learn Next session

The first launch (no prior data) still opens the predetermined first session below, not Learn Next.

The faint settings icon stays in the corner.

## Session order

The **next word is random** in every session. Confidence scores do not decide the order. They still decide which words Start Now picks (Learn Next), the My Words lists, and the scores themselves.

**Flashcards** (a category, or the Learn Next session):
- The session runs in **passes**. Each pass shows every word in the session exactly once, in a new random order (a Fisher-Yates shuffle)
- When a pass ends, the next pass is shuffled again. If its first word would be the word that ended the previous pass, it is swapped with another word, so the same card never shows twice in a row
- A session with a single word simply shows it again

**Listen + Tap:**
- Each round's target is a random word with an image from the category, never the previous round's target (when the category has another word)
- The four pictures are also in random order, and the three distractors are random words with an image from the same category

**Implementation:** the shared functions `shufflePass` and `pickNextTarget` in `src/shared/session/` take the random source as an argument. The web app injects it through `SESSION_RANDOM` (default `Math.random`), so tests can fix the order.

## Predetermined first session

The first session is always **Animals, flashcard mode**. This category has the most universally recognizable images for young children and is the best cold start.

## Home screen UI rules

- Background: a single calm solid color or very subtle gradient, with no imagery that competes with the Start Now button
- No navigation bar, no tab bar, no hamburger menu
- The only persistent UI element besides the content is the faint settings icon
- "My Words" is one of the smaller activity buttons, not a separate top-level nav item
