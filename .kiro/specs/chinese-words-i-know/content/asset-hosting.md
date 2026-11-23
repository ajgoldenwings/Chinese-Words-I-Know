# Asset Hosting & Distribution

← [Design](../design.md)

## Current approach — bundled with the app

In the initial version, all assets (images and audio) are bundled directly with the Angular build output and committed to the repository. This keeps the setup simple and makes the app fully self-contained.

**Web (GitHub Pages):**
- Assets live in the top-level `assets/` folder (shared by all platforms) and the Angular build copies them into the `dist/` output via the `assets` entry in `angular.json`
- The full `dist/` output is deployed to GitHub Pages via the CI/CD pipeline
- GitHub Pages supports repositories up to 1 GB — sufficient for the initial ~300 MB of combined images and audio
- No CDN or separate hosting required at this stage
- `AudioService` and `ImageService` build relative paths prefixed with `environment.assetBaseUrl`, which is an empty string while assets are bundled

**On-device (Capacitor — future):**
- When the iOS or Android targets are built, Capacitor copies the Angular build output (including assets) into the native app bundle
- Assets are served from the device's local storage — no network required after install
- App Store / Play Store size limits (varies by platform) will need to be evaluated when the full 1000-word asset set is complete

## Future — offload assets to S3 + CloudFront

As the word list grows toward 1000 words (~160 MB audio + ~150 MB images = ~310 MB), bundling all assets into the app will become impractical for web and hit size limits for native app stores. When that threshold is reached:

- A new CDK construct (`AssetStack`) will provision an S3 bucket and CloudFront distribution
- Assets will be uploaded to S3 and served via the CloudFront URL
- Set `environment.assetBaseUrl` to the CloudFront URL. `AudioService` and `ImageService` already prefix every asset path with it, so no other code changes
- The app bundle will ship without asset files; assets will be loaded on demand
- This migration is a future task and does not affect the current architecture

## Transition trigger

Move to S3 + CloudFront when **any of the following** are true:
- Repository size exceeds 500 MB
- GitHub Pages deployment time exceeds 3 minutes
- Native app bundle size approaches platform store limits (100 MB for iOS OTA, 150 MB for Android)
