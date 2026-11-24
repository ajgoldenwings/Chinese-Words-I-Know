# Platform: iOS

← [Design](../design.md)

## Status

Future. Placeholder until iOS work begins. The architecture is designed so `src/shared/` is reused unchanged.

## Approach

- Capacitor wraps the Angular web build output in a native iOS shell.
- Confidence engine, store, and sync logic in `src/shared/` are used without modification.
- Assets are bundled into the app package until they move to S3 + CloudFront (see [Asset Hosting](../content/asset-hosting.md)).
- iOS-specific code and config live in `src/ios/`.

## Icon and launch screen
The iOS app icon and launch screen are generated from the project logo (`icon-512.png` and `splash.png` in `assets/images/logo/`). See [Logo](../content/logo.md). Platform-specific icon sizes are produced from those two files when the iOS target is added, not hand-drawn.

## Asset URL scheme

Assets are referenced by relative path (`assets/...`, see [Audio](../content/audio.md)), so the WebView resolves them against Capacitor's local origin and no per-platform URL logic is needed. For reference, that origin is `capacitor://localhost` on iOS.

## App Store considerations

- The full asset set is about 310 MB (see [Asset Hosting](../content/asset-hosting.md)). Decide between bundling and on-demand download before submission.
- Verify current App Store size and cellular-download limits at submission time. The figures in the asset hosting spec are planning estimates.

## Release prerequisites

- **Account deletion:** Apple requires an in-app way to delete the account when an app lets users create one (App Store Review Guideline 5.1.1(v)). The deferred "Data deletion / account closure" feature in [Future Features](../roadmap/future-features.md) must ship before an iOS release.
- **Privacy policy** and the App Privacy answers describing the data collected (parent email, learning progress).
- **Kids-directed apps:** if the app is submitted to the Kids Category, Apple's additional rules apply (for example parental gates). Review them before choosing a category.
- Verify these requirements at submission time. Store policies change.

## Capacitor setup (when work begins)

```
npm install @capacitor/core @capacitor/ios
npx cap init
npx cap add ios
npx cap sync        # after each ng build
npx cap open ios
```

## Interaction notes

- Minimum tap target: 44 pt (matches [Accessibility](../ux/accessibility.md)).
- HammerJS long-press and swipe behavior should be tested on a physical device; Safari gesture handling differs from desktop browser emulation.
