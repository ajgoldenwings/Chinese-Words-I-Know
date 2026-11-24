# Platform: Android

← [Design](../design.md)

## Status

Future. Placeholder until Android work begins. The architecture is designed so `src/shared/` is reused unchanged.

## Approach

- Capacitor wraps the Angular web build output in a native Android shell.
- Confidence engine, store, and sync logic in `src/shared/` are used without modification.
- Assets are bundled into the app package until they move to S3 + CloudFront (see [Asset Hosting](../content/asset-hosting.md)).
- Android-specific code and config live in `src/android/`.

## Icon and launch screen
The Android app icon and launch screen are generated from the project logo (`icon-512.png` and `splash.png` in `assets/images/logo/`). See [Logo](../content/logo.md). Platform-specific icon sizes are produced from those two files when the Android target is added, not hand-drawn.

## Asset URL scheme

Assets are referenced by relative path (`assets/...`, see [Audio](../content/audio.md)), so the WebView resolves them against Capacitor's local origin and no per-platform URL logic is needed. For reference, the Android origin is `http://localhost` or `https://localhost`, depending on the Capacitor version and the `server.androidScheme` setting. Because the paths are relative, the choice does not affect asset loading.

## Play Store considerations

- The full asset set is about 310 MB (see [Asset Hosting](../content/asset-hosting.md)). Decide between bundling, Play Asset Delivery, and on-demand download before submission.
- Verify current Play Store size limits at submission time. The figures in the asset hosting spec are planning estimates.

## Release prerequisites

- **Account deletion:** to my knowledge, Google Play also requires apps that let users create accounts to offer a deletion path. Treat the deferred "Data deletion / account closure" feature in [Future Features](../roadmap/future-features.md) as a prerequisite for an Android release.
- **Privacy policy** and the Data safety form.
- **Families policy:** review it if the app targets children.
- Verify these requirements at submission time. Store policies change.

## Capacitor setup (when work begins)

```
npm install @capacitor/core @capacitor/android
npx cap init        # skip if already done for iOS
npx cap add android
npx cap sync        # after each ng build
npx cap open android
```

## Interaction notes

- Minimum tap target: 44 pt per [Accessibility](../ux/accessibility.md). Material Design recommends 48 dp, so consider 48 dp on Android.
- HammerJS long-press and swipe behavior should be tested on physical devices; WebView gesture handling can vary by manufacturer.
