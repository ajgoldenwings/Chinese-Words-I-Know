# Future Features

← [Design](../design.md)

The following items are explicitly deferred from the current version. They are noted here so the architecture is designed to accommodate them without requiring structural changes.

- **TTS audio fallback** — when no recorded audio exists for a word, use device or cloud TTS as a fallback
- **Confidence score decay** — reduce `confidenceScore` over time for words not seen recently; prevents "Words I Know" from becoming a permanent ratchet
- **Data deletion / account closure** — parent-initiated full progress reset and Cognito account deletion with GDPR-compliant DynamoDB purge. Required before an iOS or Android store release (see [iOS](../platforms/ios.md))
- **Multiple environments** — dev, staging, and prod stacks with separate CDK deployments and Angular environment configs
- **Analytics / observability** — CloudWatch metrics, session length tracking, category usage; no data collected on the child
- **S3 + CloudFront asset hosting** — offload images and audio from the app bundle as content grows (see [Asset Hosting](../content/asset-hosting.md))
- **Story / scene-based mode** — words appear in illustrated scenes (e.g. a kitchen with labeled objects)
- **Character tracing** — trace Chinese characters with a finger (requires a canvas-based input component)
- **Multiple learner profiles** — separate `UserProfile` and progress per family member on a shared device
- **Lessons** — ordered word sets with their own screen (a `Lesson` entity with `id`, `title`, and `wordIds`). Categories stay the only structure until then
- **Settings sync** — sync `UserSettings` across devices. Settings are local-only in this version
- **Download for offline** — pre-download a category's images and audio into the service-worker cache
