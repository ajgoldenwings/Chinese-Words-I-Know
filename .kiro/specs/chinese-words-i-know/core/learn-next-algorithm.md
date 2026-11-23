# Learn Next Algorithm

← [Design](../design.md)

## Goal

The "Learn Next" list surfaces the words that will most improve the learner's ability to converse in Mandarin. It favors words that are high-value given what the learner already knows, not only words that haven't been seen yet.

## Which words are candidates

A word is a candidate when its `confidenceScore` is below `0.6` (New or Learning), including words that have never been seen. Words at `0.6` or above are excluded because they belong in Almost There or Known. See [Confidence Model](confidence-model.md).

## Input signals

| Signal | Weight | Meaning |
|---|---|---|
| **Conversational frequency** | 50% | Derived from the word's `frequencyTier` (below), which is based on HSK level and SUBTLEX-CH spoken-frequency rank |
| **Category momentum** | 30% | `1.0` when the learner is active in the word's category, otherwise `0.5`. A category is active when the average confidence of its seen words is above `0.3`. Unseen words are not counted in that average |
| **Confidence gap** | 20% | How far the word is below the Almost There threshold (`0.6`). Unseen words score highest and the signal falls to `0` as the word approaches `0.6` |

## Frequency tiers

Each `Word` carries a `frequencyTier` from 1 to 4, set when content is authored (the field is defined in the [Design](../design.md#entity-model)).

| Tier | Meaning | Examples (illustrative) |
|---|---|---|
| 1 | Core survival, highest conversational return | 你好, 谢谢, 是, 不, 妈妈, 爸爸, numbers 1–10 |
| 2 | High-frequency everyday | Family members, food staples, common greetings, basic actions (eat, drink, sleep) |
| 3 | Useful but less frequent | Animals, household objects, colors, body parts |
| 4 | Supplementary | Less common vocabulary added to reach the 1000-word ceiling |

The frequency signal is `(5 - tier) / 4`: `1.0` for Tier 1, `0.75` for Tier 2, `0.5` for Tier 3 and `0.25` for Tier 4. A Tier 1 word therefore carries 4× the frequency signal of a Tier 4 word.

### Tier assignment rule

A word gets the best (lowest-numbered) tier that any of its criteria satisfies.

| Tier | Criteria |
|---|---|
| 1 | In the HSK 1 list, or SUBTLEX-CH word-frequency rank ≤ 500 |
| 2 | In the HSK 2 list, or rank 501–1,500 |
| 3 | In the HSK 3 list, or rank 1,501–5,000 |
| 4 | Everything else |

- The thresholds are a starting point to tune once real content is assigned.
- Use one HSK edition consistently and record which one in the content file.
- If an editor overrides a computed tier (for example because a word matters more to a young child), record the reason on that word's content entry.
- The tier table's examples are illustrative. The rule decides.

### Sources

- **HSK 1–2 vocabulary** (the international beginner benchmark, a few hundred words covering core daily communication) as described by [italki](https://www.italki.com/en/blog/hsk-1-vocabulary) and [mandarinmosaic](https://mandarinmosaic.com/blog/hsk-1-vocabulary-list)
- **SUBTLEX-CH** spoken-frequency corpus (Cai & Brysbaert, 2010), word frequencies from 33.5 million words of film and TV subtitle dialogue, a reliable proxy for natural spoken language as documented at [PLoS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0010729)

## Scoring function

```ts
function learnNextScore(word: Word, state: UserWordState | null, categoryActive: boolean): number {
  const confidence = state?.confidenceScore ?? 0

  // Not a candidate: already Almost There or Known
  if (confidence >= 0.6) return -1

  const frequencyScore = (5 - word.frequencyTier) / 4   // 1.0 for tier 1, 0.25 for tier 4
  const momentumScore = categoryActive ? 1.0 : 0.5
  const gapScore = (0.6 - confidence) / 0.6             // 1.0 at score 0, approaches 0 near 0.6

  return (frequencyScore * 0.5) + (momentumScore * 0.3) + (gapScore * 0.2)
}
```

## Output

The Learn Next list returns the top 20 candidates by score, highest first. Words scoring `-1` are excluded. Ties are broken by content order. The list is recomputed each time the My Words screen renders, so it reflects the current store.
