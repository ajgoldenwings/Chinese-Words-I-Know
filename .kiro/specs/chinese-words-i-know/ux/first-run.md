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
| **Listen & Tap** | Starts a listen + tap session. Shown only once at least one category has 4 or more words with an image, because the mode needs distinct images to tap. Target words come from the qualifying categories, lowest confidence first. The three distractors come from the same category as the target |
| **My Words** | Opens the My Words screen |

When the buttons do not fit on one screen, the home screen scrolls vertically. Start Now stays at the top. There is no pagination and no menu.

## Returning user

When prior data exists, **Start Now** resumes the recommended next session. Its mode is always flashcards. The category is chosen in this order:

1. The category with the most words in the Learning state (`[0.3, 0.6)`). Ties go to the category that comes first in content order
2. If no word is in the Learning state, the first category in content order that still has a word below Known
3. If every word is Known, the first category in content order

The faint settings icon stays in the corner.

## Predetermined first session

The first session is always **Animals, flashcard mode**. This category has the most universally recognizable images for young children and is the best cold start.

## Home screen UI rules

- Background: a single calm solid color or very subtle gradient, with no imagery that competes with the Start Now button
- No navigation bar, no tab bar, no hamburger menu
- The only persistent UI element besides the content is the faint settings icon
- "My Words" is one of the smaller activity buttons, not a separate top-level nav item
