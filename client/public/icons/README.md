# PWA Icons

Place the following icon files here for PWA support:

- `icon-192.png` — 192×192px app icon
- `icon-512.png` — 512×512px app icon
- `icon-512-maskable.png` — 512×512px maskable icon (with safe zone padding)

## How to generate

1. Use the `favicon.svg` in the `public/` folder as your base design
2. Use any icon generator (e.g., [realfavicongenerator.net](https://realfavicongenerator.net/) or [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator))
3. For maskable icons, ensure the important content is within the center 80% of the canvas

The Vite PWA plugin will pick these up automatically based on the manifest configuration in `vite.config.js`.

## Android (APK) icons

The web icons above are **not** used by the Android APK. Android reads launcher
icons from `android/app/src/main/res/mipmap-*`.

To update the icon used by the installed APK:

1. Replace `public/icons/android-chrome-512x512.png` with your new 512×512 PNG.
2. Run from `client/`: `node scripts/generate-android-icons.mjs`
3. Rebuild the APK from Android Studio (**Build → Build Bundle(s) / APK(s)**).
