# Confidence Model

← [Design](../design.md)

Each word carries a `confidenceScore` between `0.0` and `1.0`, rounded to 2 decimals.

| Score Range | State | Label |
|---|---|---|
| [0.00, 0.30) | Not yet learned | "New" |
| [0.30, 0.60) | Exposure started | "Learning" |
| [0.60, 0.85) | Near mastery | "Almost There" |
| [0.85, 1.00] | Known | "I Know This" |

Each range includes its lower bound and excludes its upper bound. The last range includes `1.00`.

## Score Update Rules

- Correct answer (flashcard recall): `+0.08`
- Correct answer (listening tap): `+0.05`
- Incorrect answer: `-0.12`
- Scores clamp to `[0.0, 1.0]`
- Round to 2 decimals after every update. Without rounding, repeated `0.08` and `0.05` steps can drift (for example to `0.8499999`) and miss a threshold. Storing points as integers from 0 to 100 is an equivalent alternative.

## What counts as "seen"

`timesSeenCount` increases by 1 each time a word is the target of an answered prompt:
- a flashcard answered with ✓ or ✗
- a tap in listen + tap mode when the word is the target

A word that is only displayed, or only appears as a distractor, does not count.

## Manual overrides

The parent can long-press a word in My Words to override its state.

- **Mark as known:** set the score to `0.9` and `manualOverride` to `"known"`. The word is listed as Known immediately, regardless of `timesSeenCount`.
  - While the override is set, correct answers raise the score as normal and leave the override in place.
  - A wrong answer lowers the score as normal and clears the override. The word is then judged by the standard Known rule below.
- **Mark as unknown:** set the score to `0.1` and `manualOverride` to `"unknown"`. The next answer of any kind clears the override, and the score evolves normally from there.

## List membership

| List | A word belongs when |
|---|---|
| **Words I Know** (Known) | `manualOverride` is `"known"`, or the score is `≥ 0.85` and `timesSeenCount ≥ 5` |
| **Almost There** | the score is `≥ 0.6` and the word is not Known |
| **Learn Next** | see [Learn Next Algorithm](learn-next-algorithm.md) |
