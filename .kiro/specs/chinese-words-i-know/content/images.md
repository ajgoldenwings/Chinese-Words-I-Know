# Images

← [Design](../design.md)

## Overview
The app logo is separate from word images. See [Logo](logo.md).


Each word requires one illustration displayed full-screen during flashcard and listen + tap sessions. Images must be immediately recognizable to a 3-year-old without any supporting text — the image alone should convey the concept.

## Style Requirements

All illustrations should follow a consistent visual language across the full word set:

- **Style:** Flat illustration, bold outlines, saturated but not garish colors — similar to children's picture book aesthetics
- **Subject:** Single subject centered on a plain or very simple background — no clutter, no scenes
- **Recognizability:** The subject must be instantly identifiable without labels; abstract or ambiguous depictions are not acceptable
- **Child-appropriate:** No frightening representations; animals should look friendly; nothing violent or upsetting
- **Consistency:** Same illustrator or same style guide for all images — visual inconsistency across categories will feel jarring

## Format and Quality

| Property | Value | Reason |
|---|---|---|
| Format | PNG with transparency | Allows flexible background color in the UI without white boxing |
| Dimensions | 800 × 800 px | Square; large enough for tablet full-screen, not so large it bloats the bundle |
| File size target | ≤ 150 KB per image | Compressed with tools like `pngquant`; acceptable quality loss for speech-sized illustrations |
| Approximate total size | ~150 MB | 1000 images × ~150 KB average |
| Color profile | sRGB | Standard for web and mobile display |

## File Naming Convention

Images use the same **ID slug** as audio (see [Slug Rules](audio.md#slug-rules)). One image per word.

```
assets/images/words/<slug>.png
```

Examples:

| Word | Simplified | Slug | File |
|---|---|---|---|
| Cat | 猫 | mao | `assets/images/words/mao.png` |
| Dog | 狗 | gou | `assets/images/words/gou.png` |
| Hello | 你好 | ni-hao | `assets/images/words/ni-hao.png` |
| Water | 水 | shui | `assets/images/words/shui.png` |

Category cover images follow the same convention under a separate folder:

```
assets/images/categories/<category-id>.png
```

Example: `assets/images/categories/animals.png`

**Category cover image spec:** Same format and quality as word images (PNG, 800×800, ≤150KB). The image should represent the category as a whole — a collage-style illustration or the most iconic word from the category (e.g. a panda for Animals). There are 10 seed categories, so 10 cover images are needed. These are included in the Phase 1 illustration commission alongside the word images.

## Entity Field Mapping

The `Word` entity's `imageAsset` field stores the slug, not the full path. `ImageService` builds the path at runtime, the same way `AudioService` does for audio:

```ts
// imageAsset stores the slug
word.imageAsset = "mao"   // null if not yet received

// ImageService builds a relative path, prefixed with environment.assetBaseUrl
// ('' while assets are bundled):
//   assets/images/words/mao.png
```

### Missing images

If `imageAsset` is `null` or the file fails to load, flashcard screens show a large emoji for the word's category (for example 🐾 for animals), so the screen is never blank.

The emoji is the same for every word in a category, so it cannot tell words apart. For that reason Listen & Tap is only offered for categories with at least 4 words that have an image (see [First-Run Experience](../ux/first-run.md)).

## Sourcing Strategy

Images are sourced in two phases:

**Phase 1 — Seed (first 157 words):** Commission a single illustrator or use a licensed flat-illustration pack (e.g. Streamline Icons children set, or a custom Fiverr commission with a consistent style guide). Budget for ~160 illustrations at this stage.

**Phase 2 — Full set (up to 1000 words):** Expand with the same illustrator or style guide. If using a licensed pack, verify the license covers the full word count before committing.

**Licensing requirement:** All images must be fully owned or licensed for use in a commercial/distributable app with no attribution required in the UI. Verify this before accepting any deliverable.

---

See [Word Lists](word-lists.md) for the full illustration checklist.
