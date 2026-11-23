# Project structure

The spec lives in `.kiro/specs/chinese-words-i-know/`. The full folder tree is in its `design.md` (Folder Structure).

```
src/shared/   platform-neutral logic: entities, confidence, content (JSON), sync, store
src/web/      the Angular app (the `sourceRoot`); screens in src/web/app/screens/
src/ios/      future Capacitor target
src/android/  future Capacitor target
assets/       source audio and images shared by every platform
infra/        AWS CDK app (TypeScript)
tests/        shared/ and web/
```

## Conventions

- Import shared code through the `@shared/*` path alias (`src/shared/*`), never with long relative paths.
- Angular copies the top-level `assets/` folder into the build through an `assets` glob in `angular.json`.
- Asset files are named by word slug:
  - `assets/audio/words/<slug>/<slug>-natural.mp3` and `<slug>-slow.mp3`
  - `assets/images/words/<slug>.png`
  - `assets/images/categories/<category-id>.png`
- Slug rules are in `.kiro/specs/chinese-words-i-know/content/audio.md` (Slug Rules).
- Generated app configuration (`src/web/environments/environment.generated.ts`) is written by CI. Do not edit it by hand.
