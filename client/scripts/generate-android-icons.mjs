// Generate Android launcher icons from the custom 512x512 icon
// Run with: node scripts/generate-android-icons.mjs
//
// Produces:
//   android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher{,_round,_foreground}.png
//
// Notes:
// - ic_launcher.png and ic_launcher_round.png are used on Android < 8.
// - ic_launcher_foreground.png is the foreground layer for adaptive icons
//   (Android 8+). It must include safe-zone padding (~33% on each side) so the
//   icon doesn't get clipped by circular/rounded masks in launchers.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'icons', 'android-chrome-512x512.png')
const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

// Density -> square pixel size (launcher icons)
const DENSITY = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

// Safe zone: adaptive-icon foreground is 108dp logical canvas,
//   visible safe zone = 66dp central.  ~66/108 ≈ 0.611.
const SAFE_ZONE = 0.72 // render at 72% of canvas to be safe across launchers

async function ensureOut(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function build() {
  const exists = await fs
    .access(SRC)
    .then(() => true)
    .catch(() => false)
  if (!exists) {
    throw new Error(`Source icon not found at ${SRC}`)
  }

  // Foreground needs a transparent canvas so the background color shows through.
  // We use the source icon at SAFE_ZONE size, centered.
  for (const [density, size] of Object.entries(DENSITY)) {
    const outDir = path.join(ANDROID_RES, `mipmap-${density}`)
    await ensureOut(outDir)

    // Legacy launcher icon (full bleed, opaque)
    await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'))

    await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'))

    // Foreground: same size as legacy, but icon scaled into safe zone with
    // transparent background.
    const fgSize = size
    const inner = Math.round(fgSize * SAFE_ZONE)
    await sharp(SRC)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer({ resolveWithObject: true })
      .then(async ({ data, info }) => {
        const canvas = sharp({
          create: {
            width: fgSize,
            height: fgSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        })
        const offset = Math.round((fgSize - inner) / 2)
        return canvas
          .composite([{ input: data, left: offset, top: offset }])
          .png()
          .toFile(path.join(outDir, 'ic_launcher_foreground.png'))
      })

    console.log(`✓ ${density}: ${size}px -> ic_launcher{,_round,_foreground}.png`)
  }

  console.log('\nDone. Rebuild APK to see the new icon.')
}

build().catch((err) => {
  console.error('Failed to generate Android icons:', err)
  process.exit(1)
})
