# Implementation Plan

← [Design](design.md)

## Overview

Tasks for Chinese Words I Know, in build order. Each `_Requirements: N_` refers to a numbered item in [Requirements](requirements.md). Design details live in [Design](design.md) and the sub-specs it links to. Every task has a `Demo:` line describing what you should be able to see when it is done.

Some setup is done by a person and is not a task here: setting the GitHub Pages source, `cdk bootstrap`, and creating the AWS OIDC provider and role. They are listed in [CI/CD](cloud/ci-cd.md#one-time-prerequisites).

## Tasks

- [x] 1. Project scaffold and shared entity types
  - Create the folder structure and define all TypeScript entity types in `src/shared/entities/`
  - Demo: `ng serve` starts an empty Angular app; all entity types are importable with no type errors
  - [x] 1.1 Scaffold the Angular app
    - Scaffold with the Angular CLI on Angular 22 and add Tailwind CSS v4 through the CLI's Tailwind setup (CSS-first config, no `tailwind.config.js`)
    - Set `sourceRoot` to `src/web` in `angular.json`
    - Add a tsconfig path alias `@shared/*` → `src/shared/*`
    - Add an `assets` glob in `angular.json` that copies the top-level `assets/` folder to `/assets`
    - _Requirements: 11_
  - [x] 1.2 Define the shared entity types
    - Define `Word`, `Category`, `UserWordState`, `UserSettings`, and `UserProfile` in `src/shared/entities/` as in [Design](design.md#entity-model)
    - _Requirements: 4, 5, 13_
  - [x] 1.3 Add platform placeholders and the CDK project
    - Add placeholder `src/ios/` and `src/android/` directories with a README
    - Initialize `infra/` with `cdk init app --language typescript`
    - _Requirements: 11_
  - [x] 1.4 Verify the build
    - `ng build` and `tsc --noEmit` pass
    - A type in `src/shared/` imports cleanly through the `@shared/*` alias
    - _Requirements: 11_

- [x] 2. CI pipeline: test, build, GitHub Pages
  - Make every later task deploy automatically. The AWS and CDK steps are added in task 16. See [CI/CD](cloud/ci-cd.md)
  - Demo: push to `main`; the Pages URL serves the empty app under its `/<repo>/` path, and a refresh on any route still loads
  - [x] 2.1 Create the deploy workflow
    - Create `.github/workflows/deploy.yml` that runs on every push to `main`: `npm ci`, Vitest, `ng build --configuration production --base-href /<repo>/`, then `actions/upload-pages-artifact` and `actions/deploy-pages`
    - Add a `concurrency` group so two deploys never run at once
    - _Requirements: 11_
  - [x] 2.2 Configure routing and environment files
    - Configure hash routing (`withHashLocation()`) so deep links survive a refresh
    - Add `src/web/environments/environment.ts` with an empty `assetBaseUrl` and empty cloud values
    - _Requirements: 11_
  - [x] 2.3 Verify the pipeline gates deploys
    - A deliberately failing test blocks the deploy
    - _Requirements: 11_

- [x] 3. Confidence scoring engine
  - Build and test the confidence model in `src/shared/confidence/`
  - Demo: tests pass and the output is readable; the engine is fully covered before any UI touches it
  - [x] 3.1 Implement the scoring functions
    - Pure functions: `applyCorrectAnswer(type)`, `applyIncorrectAnswer()`, `applyManualOverride(direction)`, `getWordState(state)`, `isKnown(state)`, and `isAlmostThere(state)`
    - All rules from [Confidence Model](core/confidence-model.md), including rounding to 2 decimals and the manual override rules
    - _Requirements: 5, 6_
  - [x] 3.2 Write unit tests
    - Every score transition, and clamping
    - Band boundaries at `0.3`, `0.6`, and `0.85`
    - 11 correct flashcard answers from `0` give exactly `0.88`
    - A "known" override lists the word as Known with `timesSeenCount` below 5
    - A wrong answer clears a "known" override
    - The next answer clears an "unknown" override
    - _Requirements: 5, 6_

- [x] 4. Seed content: first category
  - Add the first 20 words (Animals category) as structured JSON in `src/shared/content/`
  - Demo: a console log of the loaded Animals category shows all 20 words with their fields
  - [x] 4.1 Author the seed content
    - Create `words.json` and `categories.json` with `contentVersion: 1`
    - Each word has all entity fields, including a `frequencyTier` assigned by the rule in [Learn Next Algorithm](core/learn-next-algorithm.md)
    - `audioAsset` and `imageAsset` are both `null` at this stage; assets are added once recordings and illustrations are delivered
    - Slugs follow the [Slug Rules](content/audio.md#slug-rules)
    - _Requirements: 3, 4, 12_
  - [x] 4.2 Build the typed loader
    - Validate the JSON against the entity types
    - _Requirements: 4_
  - [x] 4.3 Write loader tests
    - The loader parses all 20 words and each satisfies the type contract
    - Every slug is unique and matches `^[a-z]+(-[a-z]+)*$`
    - Every word has a `frequencyTier`
    - Null asset fields cause no errors
    - _Requirements: 4_

- [x] 5. State store and content migration
  - Build `src/shared/store/`, an in-memory store persisted to `localStorage`
  - Demo: the store survives a page refresh; a word's confidence score persists correctly
  - [x] 5.1 Build the store
    - Functions to get and set `UserWordState` for any word, and to read and update `UserSettings`
    - Settings persist whether or not the user is signed in
    - Initialize `UserWordState` with `confidenceScore: 0, timesSeenCount: 0` for any word not yet seen
    - _Requirements: 5, 8_
  - [x] 5.2 Add content migration
    - On load, run the migration from [Content Versioning](core/content-versioning.md) and store `lastContentVersion`
    - _Requirements: 4, 5_
  - [x] 5.3 Write store and migration tests
    - Read and write, persistence across a simulated reload, and default initialization
    - Each migration case: new word, removed word, display-field fix, category move
    - _Requirements: 5, 8_

- [x] 6. AudioService and ImageService
  - Build the services that resolve and play assets, as specified in [Audio](content/audio.md) and [Images](content/images.md)
  - Demo: a test page plays a sample recording after a tap and shows an image, and falls back to silence and the emoji when files are missing
  - [x] 6.1 Implement AudioService
    - `AudioService.play(slug, speed)` plays through `HTMLAudioElement` and respects `audioEnabled`
    - It resolves silently for a null slug, a failed load, or a playback rejection
    - Paths are prefixed with `environment.assetBaseUrl`
    - _Requirements: 7_
  - [x] 6.2 Implement ImageService
    - Return a relative URL for a slug, or a null result that triggers the category emoji fallback
    - Paths are prefixed with `environment.assetBaseUrl`
    - _Requirements: 3, 7_
  - [x] 6.3 Write service tests
    - A null slug resolves without error
    - A rejected `play()` resolves silently
    - Paths are relative and correct with an empty base URL and with a CDN base URL
    - `audioEnabled: false` plays nothing
    - _Requirements: 7_

- [x] 7. Feedback components
  - Build the shared error and notice UI from [Error Handling](ux/error-handling.md)
  - Demo: a test page triggers each of the four treatments
  - [x] 7.1 Build the components and NotificationService
    - An inline field error, a toast (auto-dismiss after 4 seconds), a modal with one action button, and a full-screen error state with a retry button, all behind one `NotificationService`
    - All text is plain language written for a parent
    - _Requirements: 9_
  - [x] 7.2 Write component tests
    - Each treatment renders and dismisses correctly
    - A toast never blocks interaction
    - The full-screen state shows no stack trace
    - _Requirements: 9_

- [x] 8. Home screen: zen mode
  - Build the minimal home screen in `src/web/app/screens/home/`, following [First-Run Experience](ux/first-run.md)
  - Demo: the app loads to a calm home screen; a child can tap Start Now without guidance
  - [x] 8.1 Build the home layout
    - A large **Start Now** button in the center
    - Below it, smaller buttons: one per category (flashcards), **Listen & Tap** (shown only when a category has at least 4 words with an image), and **My Words**
    - A faint gear icon opens the settings panel
    - No navigation bar, tab bar, or visible menu
    - The screen scrolls vertically when the buttons do not fit
    - All tap targets are at least 44×44pt
    - _Requirements: 4, 9, 10_
  - [x] 8.2 Implement Start Now session selection
    - Apply the first-launch and returning-user rules, including the tie-break order
    - _Requirements: 9_
  - [x] 8.3 Write home screen tests
    - Renders without error
    - Start Now routes to the correct first and returning sessions, including the tie-break rules
    - Listen & Tap is hidden until a category qualifies
    - Tap targets meet 44×44pt
    - _Requirements: 9, 10_

- [x] 9. Flashcard learning session
  - Build the core zen-mode learning screen for flashcard interaction
  - Demo: parent and child tap through Animal flashcards continuously; scores update after each card; the session does not end on its own
  - [x] 9.1 Build the flashcard UI
    - Full-screen word image (or the category emoji when there is no image) with the English label below
    - Tap to reveal; on reveal, play the natural recording
    - After the reveal, two large buttons: ✓ (got it) and ✗ (not yet)
    - Only a small faint back button is shown; its tap target is still at least 44×44pt
    - Nothing times out or advances on its own
    - _Requirements: 2, 7, 9_
  - [x] 9.4 Play audio when the image is displayed and on every press
    - The natural recording plays once when the card's image loads, fails to the emoji, or has no image, and after 1.5 seconds at most if the image is slow
    - Every press of the card plays the word, not only the first; the first press also reveals ✓ and ✗
    - A press plays with no delay: no wait for the image, no reload of the same recording, and the lead-in silence skipped
    - A press before the image loads replaces the load sound. Answering stops the sound, and the next card plays when its image loads
    - `AudioService` is created at app start, reuses one audio element, and unlocks it with a short silence on the first tap, so the sound that plays when the image loads (outside a tap) still plays on iOS Safari (see [Web](platforms/web.md#audio-playback))
    - See [Progressive Disclosure](ux/progressive-disclosure.md) and [Audio](content/audio.md)
    - _Requirements: 2, 7_
  - [x] 9.2 Implement session logic
    - Each answer calls the confidence engine, updates the store, and advances to the next word
    - Sessions are **continuous**: words cycle through the category until the parent or child taps the faint back button
    - Words are ordered lowest confidence first, then cycle
    - Respect `showPinyin` and `showCharacters`, plus the pinyin fallback in [Progressive Disclosure](ux/progressive-disclosure.md)
    - _Requirements: 2, 3, 5, 10_
  - [x] 9.3 Write session tests
    - Taps update scores correctly
    - The session advances without any extra tap
    - The back button returns to the home screen
    - Pinyin appears automatically for a word with no audio when both text settings are off
    - The word plays once when the image loads or fails, after the 1.5 second wait at most, on every press, and for the next card when its image loads
    - `AudioService` reuses one element and plays the unlock silence once
    - Replaying the same recording rewinds instead of reloading, and `skipLeadIn` starts at 0.25 s
    - _Requirements: 2, 3, 5_

- [x] 10. Listen and tap mode
  - Build the second interaction type: hear a word, tap the matching image
  - Demo: a listen + tap round plays through words; scores update; the child gets clear right/wrong feedback
  - [x] 10.1 Build the tiles and prompt
    - Show 4 image tiles, one of which is the target
    - Audio plays automatically when `audioEnabled` is true and the word has a recording; otherwise the English word is shown as the prompt
    - Distractors are three other imaged words from the target's category
    - _Requirements: 2, 7_
  - [x] 10.2 Implement scoring, feedback, and availability
    - Tapping the correct tile gives a confidence increase and visual success feedback
    - Tapping a wrong tile gives a confidence penalty on the target and gentle feedback
    - Right and wrong feedback never relies on color alone; add a shape or motion change (see [Accessibility](ux/accessibility.md))
    - The mode is offered only for categories with at least 4 imaged words (see [First-Run Experience](ux/first-run.md))
    - _Requirements: 2, 5, 9_
  - [x] 10.4 Play audio on display and on every press
    - The target word's slow recording plays when a round's pictures are displayed
    - After each press of a picture, that picture's word plays (slow). A repeat press on a wrong picture plays it again. A word without a recording stays silent
    - See [Progressive Disclosure](ux/progressive-disclosure.md) and [Audio](content/audio.md)
    - _Requirements: 2, 7_
  - [x] 10.3 Write listen + tap tests
    - The correct tile always scores the target; a wrong tile penalizes the target
    - Distractors never include the target and come from the same category
    - The mode is unavailable below 4 imaged words
    - The text prompt shows when audio is unavailable
    - Pressing a tile plays that tile's word, including a repeat press on a wrong tile, and not after the round is solved
    - _Requirements: 2, 7_

- [x] 11. My Words screen
  - Build the three word lists: Known, Almost There, and Learn Next
  - Demo: after several flashcard rounds, words appear in the right lists; the parent can promote or demote a word
  - [x] 11.1 Build the lists
    - `MyWordsScreen`, opened from the home screen
    - List membership follows [Confidence Model](core/confidence-model.md#list-membership), and Learn Next follows [Learn Next Algorithm](core/learn-next-algorithm.md)
    - Each entry shows the image thumbnail and English label
    - _Requirements: 6_
  - [x] 11.2 Add the detail view and manual override
    - Tapping a word opens a detail view (image, English, and pinyin/characters per settings)
    - The parent can long-press a word (HammerJS press gesture) for "Mark as Known" / "Mark as Unknown"
    - _Requirements: 3, 5_
  - [x] 11.3 Write list tests
    - Words appear in the correct lists from mock data
    - A "known" override puts a word in Known immediately
    - Learn Next returns words in score order and excludes words at `0.6` or above
    - _Requirements: 5, 6_
  - [x] 11.4 Limit Almost There to the top 10 and show the confidence state label
    - Almost There shows at most 10 words that are not Known and score above 0, with no score threshold; highest score first, content order on ties (see [Confidence Model](core/confidence-model.md#list-membership))
    - Each Almost There entry shows its confidence state label ("New", "Learning", "Almost There", "I Know This") as a text badge
    - Tests: the limit, the order, words below 0.6 included, score 0 and Known left out, the label for each band, and no label in Known or Learn Next
    - _Requirements: 6_

- [x] 12. Settings panel
  - Build the settings panel and wire every `UserSettings` flag to the UI
  - Demo: the parent taps the gear, enables pinyin, returns to the flashcards, and pinyin is shown; it is still on after a refresh
  - [x] 12.1 Build the panel and toggles
    - Tapping the faint gear icon opens an overlay or slide-in panel
    - Toggles: Show Pinyin, Show Characters, Audio (on by default), and Save to Cloud (starts the account flow in task 17)
    - Each toggle has a one-line plain-language description
    - All flags persist locally and are read by session screens immediately
    - _Requirements: 3, 7, 10, 13_
  - [x] 12.2 Write settings tests
    - Each toggle flips its flag and persists across reload
    - Pinyin and character changes show in the flashcard screen
    - The panel opens only from the gear icon
    - _Requirements: 3, 10_

- [x] 13. Offline support (PWA)
  - Make the app usable offline after the first load. See [Web](platforms/web.md#offline-pwa)
  - Demo: load a category online, switch to airplane mode, reload, and keep practicing the cached words
  - [x] 13.1 Add the service worker
    - Add the Angular service worker (`ng add @angular/pwa`) and precache the app shell
    - Cache images and audio at runtime on first use (cache-first) rather than precaching the full ~310 MB set
    - Make sure it works under the `/<repo>/` base href
    - A new version activates on the next launch
    - _Requirements: 8_
  - [x] 13.2 Write offline tests
    - With the network disabled after one online visit, the app shell loads
    - Cached words show their image and play audio
    - Uncached words show the emoji fallback and stay silent
    - _Requirements: 8_

- [x] 14. Expand content to the full 1000-word set
  - Populate all categories with the full word list
  - Demo: the full category list is browsable on the home screen; My Words shows a realistic distribution across the lists after test play
  - [x] 14.1 Add the remaining content
    - Add the remaining categories and words to `src/shared/content/`
    - Assign every word a slug following the slug rules and a `frequencyTier` following the tier rule
    - All `audioAsset` and `imageAsset` fields remain `null` until assets arrive
    - Bump `contentVersion`
    - _Requirements: 4, 12_
  - [x] 14.2 Verify scale
    - The loader, store, and all screens handle the full dataset without a performance regression
    - _Requirements: 12_
  - [x] 14.3 Write content tests
    - All words load and parse; slugs are unique; every word has a tier
    - The home screen renders and scrolls with all category buttons
    - Content migration runs correctly when the version increments
    - _Requirements: 4, 12_

- [x] 15. Cloud infrastructure: CDK stateful stack
  - Provision DynamoDB and Cognito via CDK in `infra/`
  - Demo: `cdk deploy ChineseWordsStatefulStack` succeeds; the table and User Pool are visible in the AWS console
  - [x] 15.1 Build the stateful stack
    - `ChineseWordsStatefulStack` with a DynamoDB table (`userId` PK, `wordId` SK, PAY_PER_REQUEST, `removalPolicy: RETAIN`)
    - A Cognito User Pool with email sign-in and self sign-up, and a public App Client
    - Pass the table and User Pool to the API stack as props
    - Export `UserPoolId` and `UserPoolClientId` as stack outputs
    - _Requirements: 13_
  - [x] 15.2 Write stack tests
    - `cdk synth` produces valid CloudFormation
    - `cdk-nag` AwsSolutionsChecks pass
    - _Requirements: 13_

- [x] 16. Cloud infrastructure: CDK API stack and CI deploy
  - Provision the API and add the cloud steps to the CI pipeline
  - Demo: a push to `main` deploys the stacks and the app; `GET /progress` and `PUT /progress` behave correctly with a valid Cognito JWT
  - [x] 16.1 Build the API stack and Lambdas
    - `ChineseWordsApiStack` taking the stateful stack's resources as props
    - `GetProgress` queries DynamoDB by `userId`
    - `PutProgress` writes up to 25 records as individual conditional `PutItem` calls and returns `accepted` and `rejected`, as in [Cloud Infrastructure](cloud/infrastructure.md)
    - _Requirements: 13_
  - [x] 16.2 Add the HTTP API
    - HTTP API with a Cognito JWT authorizer and least-privilege grants
    - CORS for `https://<username>.github.io` and `http://localhost:4200`
    - An `ApiUrl` output
    - _Requirements: 13_
  - [x] 16.3 Extend the CI pipeline
    - Extend `deploy.yml` per [CI/CD](cloud/ci-cd.md): authenticate with the OIDC role and run `cdk deploy --all --outputs-file`
    - Generate `environment.generated.ts` from the outputs, then build and deploy the app
    - _Requirements: 11, 13_
  - [x] 16.4 Write API tests
    - `cdk synth` succeeds
    - Lambda unit tests with mocked DynamoDB, including a stale write being rejected with the current record returned
    - _Requirements: 13_

- [x] 17. Account sign-up, sign-in, and sign-out
  - Build the account screens from [Cloud Infrastructure](cloud/infrastructure.md#account-flows)
  - Demo: a parent creates an account, verifies the email, signs in, signs out, and resets the password
  - [x] 17.1 Build the account screens
    - Using Amplify Auth: sign up with email and password, enter the emailed verification code, sign in, reset a forgotten password, and sign out
    - Errors use the inline, toast, and modal treatments from task 7
    - _Requirements: 13_
  - [x] 17.2 Wire the Save to Cloud toggle
    - Turning on Save to Cloud opens sign-in with a "Create account" option; turning it off signs out
    - _Requirements: 10, 13_
  - [x] 17.3 Write account tests
    - Each flow succeeds and fails gracefully with the right error treatment
    - Signing out keeps local progress
    - _Requirements: 13_

- [x] 18. Client SyncService
  - Wire the client-side sync into the Angular app
  - Demo: progress made on one device appears on another after signing in; reinstalling and signing back in restores progress from DynamoDB
  - [x] 18.1 Implement load and merge
    - Build `SyncService` in `src/shared/sync/`
    - On load: fetch cloud state, merge with local by `updatedAt`, and write the merged result to the store
    - `SyncService` does nothing when signed out
    - _Requirements: 8, 13_
  - [x] 18.2 Implement dirty tracking and flush
    - After each confidence update: mark the record dirty and debounce a flush to the API (30 seconds at most)
    - Map `manualOverride` `null` to and from `"none"` at the API boundary
    - When a write is rejected, adopt the returned cloud record
    - _Requirements: 8, 13_
  - [x] 18.3 Write sync tests
    - Merge logic covers local newer, cloud newer, and equal timestamps
    - `flush()` sends the correct batch
    - A rejected write adopts the cloud record
    - Signing out silences the service
    - _Requirements: 13_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Demo: `ng test --no-watch` and the CDK tests pass, and the full flow works: Start Now, flashcards, listen and tap, My Words, settings, offline, and sync

- [x] 20. Fix cloud sync between devices and rework Save to Cloud
  - Fix words not matching across devices, replace the Save to Cloud toggle with a button, and show sync status. See [Cloud Sync](cloud/sync.md#sync-status-and-refresh) and [Progressive Disclosure](ux/progressive-disclosure.md)
  - Demo: sign in on two devices, change a word on one, tap the refresh icon on the other, and the word matches. Turning off the network and tapping refresh shows a plain-language error
  - [x] 20.1 Fix the sync causes
    - `PutProgress` accepts `""` for `lastSeenAt`
    - `SyncService` skips a batch the API refuses (4xx other than 401 and 403) and sends the remaining batches
    - Signing in sets `cloudSyncEnabled` to true and logging out sets it to false
    - _Requirements: 8, 13_
  - [x] 20.2 Report sync status
    - `SyncService` reports `syncing`, `lastSyncedAt`, and a plain-language `error`, and has `refresh()`
    - Add `SyncStatusService` and show a toast when sync moves from working to failed
    - _Requirements: 13_
  - [x] 20.3 Rework the Cloud section of settings
    - Replace the Save to Cloud toggle with a button that becomes Logout once signed in
    - When signed in, show the last synced time, a refresh icon button (at least 44×44pt), and the sync error if any
    - _Requirements: 10, 13_
  - [x] 20.4 Write tests
    - Status, error, and refresh cases in the sync tests; skipped batch; the Lambda accepts an empty `lastSeenAt`; settings and account tests updated for the button
    - _Requirements: 13_
- [x] 21. Apply the logo
  - Use the supplied logo as the favicon, app icon, boot image, and launch screen source. See [Logo](content/logo.md)
  - Demo: the browser tab shows the logo, the logo shows while the app loads, and the installed web app uses the logo as its icon
  - [x] 21.1 Store and generate the logo files
    - Put the supplied image at `assets/images/logo/logo-source.png`
    - Add `scripts/logo/gen.py` and generate the sizes and formats listed in [Logo](content/logo.md)
    - _Requirements: 11_
  - [x] 21.2 Wire the logo into the web app
    - Add the favicon, touch icon, theme color, and manifest links to `index.html`, add `manifest.webmanifest` to `src/web/public/`, and put the boot image inside `<app-root>`
    - Remove the default `favicon.ico` from `src/web/public/`
    - Precache the logo files and the manifest in `ngsw-config.json`
    - _Requirements: 11_
  - [x] 21.3 Write tests
    - The generated files exist with the sizes in the logo spec, the apple touch icon is opaque, and the manifest and `index.html` reference only files that exist, with relative paths
    - _Requirements: 11_
## Notes

- The design has no Correctness Properties section, so this plan uses unit and integration tests only and no property-based tests
- Each task references numbered items in [Requirements](requirements.md) for traceability
- Requirement 1 (learners) and requirement 12 (scope) shape content and UX rather than a single task, and are covered by tasks 4, 8, 9, and 14

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "3.1"] },
    { "id": 3, "tasks": ["2.1", "2.2", "3.2", "4.1"] },
    { "id": 4, "tasks": ["2.3", "4.2", "15.1"] },
    { "id": 5, "tasks": ["4.3", "5.1", "7.1", "15.2"] },
    { "id": 6, "tasks": ["5.2", "6.1", "6.2", "7.2", "16.1"] },
    { "id": 7, "tasks": ["5.3", "6.3", "16.2"] },
    { "id": 8, "tasks": ["8.1", "16.4"] },
    { "id": 9, "tasks": ["8.2", "9.1"] },
    { "id": 10, "tasks": ["8.3", "9.2"] },
    { "id": 11, "tasks": ["9.3", "10.1", "11.1"] },
    { "id": 12, "tasks": ["10.2", "11.2", "12.1"] },
    { "id": 13, "tasks": ["10.3", "11.3", "12.2", "13.1"] },
    { "id": 14, "tasks": ["13.2", "14.1", "17.1"] },
    { "id": 15, "tasks": ["14.2", "14.3", "17.2", "18.1"] },
    { "id": 16, "tasks": ["16.3", "17.3", "18.2"] },
    { "id": 17, "tasks": ["18.3"] },
    { "id": 18, "tasks": ["19"] },
    { "id": 19, "tasks": ["20.1"] },
    { "id": 20, "tasks": ["20.2", "20.4"] },
    { "id": 21, "tasks": ["20.3", "21.1"] },
    { "id": 22, "tasks": ["21.2"] },
    { "id": 23, "tasks": ["21.3"] }
  ]
}
```
