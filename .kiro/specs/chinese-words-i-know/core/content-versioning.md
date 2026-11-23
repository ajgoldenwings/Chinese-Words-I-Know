# Content Versioning

← [Design](../design.md)

## Problem

The word list in `src/shared/content/` will change over time — new words added, slugs corrected, pinyin fixed, categories reorganized. A user's `UserWordState` records are keyed by `wordId` slug. If a slug changes or a word is removed, their progress silently orphans.

## Slugs are permanent

A word's slug is its ID. Once a slug is published it never changes, even when the word's pinyin is later corrected. Fix the display fields (`pinyin`, `english`, `simplified`) and keep the slug. Renaming a slug orphans every learner's progress for that word (see the migration table below). The slug rules are in [Audio](../content/audio.md#slug-rules).

## Version field

The content JSON files carry a top-level `contentVersion` field — a monotonically incrementing integer:

```json
{
  "contentVersion": 1,
  "categories": [...],
  "words": [...]
}
```

The app stores the last-seen `contentVersion` in `localStorage` alongside user state.

## Migration rules

On app load, after content is loaded and before the store is hydrated:

1. Read `contentVersion` from the loaded JSON
2. Read `lastContentVersion` from `localStorage`
3. If they match — no migration needed, proceed normally
4. If `contentVersion` is higher — run the migration strategy below, then update `lastContentVersion`

## Migration strategy

| Change type | Action |
|---|---|
| **New word added** (new slug) | Initialize `UserWordState` for that slug with `confidenceScore: 0, timesSeenCount: 0` — no existing progress to migrate |
| **Word removed** (slug deleted from JSON) | Orphaned `UserWordState` records are retained in `localStorage` and DynamoDB but excluded from all UI queries; they do not affect scores or lists |
| **Slug renamed** | The old slug is treated as removed (retained, excluded) and the new slug is treated as added (initialized at zero) — progress is not carried over; this is intentional since a slug rename indicates a data correction |
| **Pinyin / English / simplified corrected** | No migration needed — these are display fields only; `wordId` slug is unchanged |
| **Category reorganization** | Words move between categories; `UserWordState` is keyed by `wordId` only so no migration needed — progress is preserved |

## DynamoDB orphan cleanup (future)

Orphaned records in DynamoDB (from removed words) are not deleted automatically. A future admin Lambda can sweep records whose `wordId` is not in the current content JSON and archive or delete them. This is not in scope for the current version.
