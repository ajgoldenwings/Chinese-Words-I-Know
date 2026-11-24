# Platform: Web

← [Design](../design.md)

## Status

Primary platform for this version.

## Build

- Framework: Angular 22 (standalone components)
- Build tool: Angular CLI (esbuild application builder)
- Command: `ng build --configuration production --base-href /<repo>/`
- Output: static HTML/JS/CSS in `dist/`
- Source: `src/web/` (set as `sourceRoot` in `angular.json`). Shared logic is imported from `src/shared/` through the `@shared/*` path alias
- Assets: the top-level `assets/` folder is copied into the build by an `assets` glob in `angular.json`

## Hosting under a subpath

GitHub Pages project sites are served from `https://<username>.github.io/<repo>/`, not from the domain root. Three rules follow:

1. Build with `--base-href /<repo>/`
2. Asset URLs are always relative (`assets/...`) and resolve against `<base href>`. They never start with `/`
3. The router uses hash location (`withHashLocation()`). GitHub Pages has no server-side rewrites, so a refresh on a deep link would otherwise return a 404

## Deployment

- Host: GitHub Pages, with the Pages source set to **GitHub Actions**
- Deploy: `actions/upload-pages-artifact` followed by `actions/deploy-pages` on every push to `main`
- Full pipeline: [CI/CD](../cloud/ci-cd.md)

## Asset URL scheme

Assets are served from the build output with relative paths, prefixed by `environment.assetBaseUrl`. The prefix is an empty string while assets are bundled and becomes the CDN URL when assets move to S3 + CloudFront.

- Images: `assets/images/words/<slug>.png`
- Audio: `assets/audio/words/<slug>/<slug>-<speed>.mp3`

`AudioService` and `ImageService` build these paths at runtime. See [Audio](../content/audio.md) and [Images](../content/images.md).

## Logo, favicon, and boot image
- The logo files live in `assets/images/logo/` and are served at `assets/images/logo/...` like every other asset. See [Logo](../content/logo.md)
- `src/web/index.html` links the favicon (`.ico` and PNG), the Apple touch icon, the web app manifest, and a theme color. All links are relative
- `src/web/public/manifest.webmanifest` sets the app name, `start_url` and `scope` of `./`, `display: standalone`, the theme and background colors, and the icons. Its paths are relative, so it works under the `/<repo>/` subpath
- The boot image is inside `<app-root>` in `index.html`. It shows while the app loads, and Angular replaces it on start
- The web build has no `favicon.ico` in `src/web/public/`. The logo folder is the only source for icons

## Audio playback

- Uses the native `HTMLAudioElement`. No third-party library
- Browsers block audio until the user has interacted with the page. The first tap on Start Now or a category button unlocks playback. If a `play()` call is still rejected, `AudioService` resolves silently and the next tap tries again

## Offline (PWA)

The app registers an Angular service worker so it keeps working without a connection after the first load.

- The app shell (HTML, JS, CSS, the manifest) and the logo files in `assets/images/logo/` are precached
- Images and audio are cached at runtime on first use (cache-first). They are not precached, because the full set is about 310 MB
- The very first load needs a connection
- A new app version activates on the next launch
- Cached words work offline. Uncached words show the emoji fallback and play no audio
- Future: a "download for offline" action per category

## Local storage

- Progress and settings are persisted to `localStorage`
- Scope is per origin, so progress is tied to the domain the app is served from (on GitHub Pages: `https://<username>.github.io`)
- Clearing site data removes local progress. Cloud sync (see [Cloud Sync](../cloud/sync.md)) is the backup. Settings are local-only in this version

## Error handling

Toast, modal, inline, and full-screen error treatments are rendered as in-page UI. See [Error Handling](../ux/error-handling.md).

## Size limits

GitHub Pages sites are capped at 1 GB. The initial asset bundle is within that limit. See [Asset Hosting](../content/asset-hosting.md) for the point at which assets move to S3 + CloudFront.
