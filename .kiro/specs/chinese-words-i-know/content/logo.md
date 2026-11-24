# Logo
← [Design](../design.md)
## Overview
The app has one logo. The project supplies it as a single source image, and every icon, favicon, boot image and launch screen is generated from that image. Replacing the source and re-running the generator updates all of them. The logo is a brand mark, not a word image, so it follows none of the style rules in [Images](images.md).
## Location
All logo files live in `assets/images/logo/`. Components never build these paths. The web page and manifest reference them by relative path (`assets/images/logo/...`, never starting with `/`), like every other asset ([Web](../platforms/web.md)).
| File | Size | Format | Used for |
|---|---|---|---|
| `logo-source.png` | as supplied | PNG, transparent background | The only hand-supplied file. Input to the generator |
| `logo.png` | 512×512 | PNG, transparent | General-purpose logo, square |
| `favicon.ico` | 16, 32 and 48 in one file | ICO | Browser tab icon (older browsers) |
| `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | 16, 32, 48 | PNG, transparent | Browser tab icon |
| `apple-touch-icon.png` | 180×180 | PNG, **opaque** white background | iOS home screen. iOS fills transparency with black, so this one has no transparency |
| `icon-192.png`, `icon-512.png` | 192, 512 | PNG, transparent | Web app manifest icons (`purpose: any`) and Android launcher source |
| `icon-maskable-512.png` | 512×512 | PNG, solid theme-color background | Web app manifest icon (`purpose: maskable`). The face stays inside the central 60% so any mask shape keeps it whole |
| `boot.png` | 240×240 | PNG, transparent | Boot image shown in the page while the app loads |
| `splash.png` | 2732×2732 | PNG, white background | Source for the iOS and Android launch screens (Capacitor) |
## Rules
- Every generated image is square. The face is centered and scaled to fit, never stretched. The source is not square, so the generator pads it
- The generator is `scripts/logo/gen.py` (Python and Pillow). It reads `logo-source.png` and writes every other file in the folder. Do not edit the generated files by hand
- Keep the source at 512 px high or more where possible. A smaller source is scaled up and looks soft at the larger sizes
- The theme color (`#c87f51`) is taken from the logo itself and is used for the browser theme color, the manifest, and the maskable icon background. If the logo changes, the generator prints the new value, and `index.html` and `manifest.webmanifest` are updated to match
- The logo is not shown on the home screen or in a session. The home screen keeps one large Start Now button, smaller activity buttons, and a faint settings gear ([Progressive Disclosure](../ux/progressive-disclosure.md))
## Where it appears
| Place | How |
|---|---|
| Browser tab and bookmarks | `<link rel="icon">` entries in `src/web/index.html` for the `.ico` and the 16 and 32 px PNGs |
| iOS "Add to Home Screen" | `<link rel="apple-touch-icon">` |
| Installed web app (PWA) | `manifest.webmanifest` in `src/web/public/`, linked from `index.html`, with `name`, `theme_color`, `background_color`, and the three icons |
| Boot image | `boot.png` is inside `<app-root>` in `index.html`, centered on white. Angular replaces it as soon as the app starts. It needs no script and works offline once cached |
| Offline | The service worker precaches `assets/images/logo/**` and the manifest with the app shell, so the icons and boot image work without a connection |
| iOS and Android apps (future) | `splash.png` and `icon-512.png` are the sources for the launch screen and app icon assets. See [iOS](../platforms/ios.md) and [Android](../platforms/android.md) |
## Fallback
The logo never blocks the app. If a logo file is missing, the browser shows its default icon and the boot area shows the alt text "Chinese Words I Know". Nothing throws.
