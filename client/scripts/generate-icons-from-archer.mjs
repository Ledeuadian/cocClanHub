// Generate ALL app icons (PWA web + Android launcher) from a single source:
//   client/public/characters/COCarcher.png
//
// Run with: node scripts/generate-icons-from-archer.mjs
//
// Produces:
//   - PWA / browser icons in public/icons/
//       favicon.ico, favicon-16x16.png, favicon-32x32.png,
//       apple-touch-icon.png, android-chrome-192x192.png,
//       android-chrome-512x512.png, icon-192.png, icon-512.png,
//       icon-512-maskable.png
//   - Android launcher icons in android/app/src/main/res/mipmap-*/
//       ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
//
// Both surfaces share the same source, so changing COCarcher.png and
// re-running this script updates the web app icon AND the installed
// Android APK icon in one shot.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'characters', 'COCarcher.png')
const ICONS_DIR = path.join(ROOT, 'public', 'icons')
const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

// Android launcher density -> square pixel size
const DENSITY = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

// Adaptive-icon foreground is 108dp; safe zone ~66dp center => ~0.611.
// We render the icon at 72% of canvas to be safe across launchers.
const SAFE_ZONE = 0.72

async function ensureOut(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function loadSource() {
  const exists = await fs
    .access(SRC)
    .then(() => true)
    .catch(() => false)
  if (!exists) {
    throw new Error(`Source icon not found at ${SRC}`)
  }
  // Square-cropped opaque RGBA buffer we can reuse at any size.
  const meta = await sharp(SRC).metadata()
  const side = Math.min(meta.width, meta.height)
  const left = Math.floor((meta.width - side) / 2)
  const top = Math.floor((meta.height - side) / 2)
  const buf = await sharp(SRC)
    .extract({ left, top, width: side, height: side })
    .ensureAlpha()
    .png()
    .toBuffer()
  return { buf, meta: { ...meta, width: side, height: side } }
}

async function generatePwaIcons(src) {
  await ensureOut(ICONS_DIR)

  // 192 / 512 PWA icons (Android Chrome friendly names already used by the
  // existing vite.config.js manifest + index.html)
  const sizes = [
    { size: 192, name: 'android-chrome-192x192.png' },
    { size: 512, name: 'android-chrome-512x512.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    // Maskable: render the archer within the 80% safe zone on a solid
    // background so circular/rounded launchers don't clip the artwork.
    { size: 512, name: 'icon-512-maskable.png', maskable: true },
  ]
  for (const { size, name, maskable } of sizes) {
    let pipeline = sharp(src.buf).resize(size, size, { fit: 'contain' })
    if (maskable) {
      const inner = Math.round(size * 0.8)
      const offset = Math.round((size - inner) / 2)
      const innerPng = await sharp(src.buf)
        .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      pipeline = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 26, g: 26, b: 46, alpha: 1 }, // matches manifest background_color
        },
      }).composite([{ input: innerPng, left: offset, top: offset }])
    }
    await pipeline.png().toFile(path.join(ICONS_DIR, name))
    console.log(`✓ PWA  ${name} (${size}x${size}${maskable ? ', maskable' : ''})`)
  }

  // Apple touch icon (180x180 — what iOS uses when added to home screen)
  await sharp(src.buf)
    .resize(180, 180, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'))
  console.log('✓ PWA  apple-touch-icon.png (180x180)')

  // Standard favicons
  await sharp(src.buf).resize(32, 32, { fit: 'contain' }).png()
    .toFile(path.join(ICONS_DIR, 'favicon-32x32.png'))
  await sharp(src.buf).resize(16, 16, { fit: 'contain' }).png()
    .toFile(path.join(ICONS_DIR, 'favicon-16x16.png'))
  console.log('✓ PWA  favicon-16x16.png, favicon-32x32.png')

  // Multi-size favicon.ico (16, 32, 48 embedded in one .ico)
  const ico16 = await sharp(src.buf).resize(16, 16, { fit: 'contain' }).png().toBuffer()
  const ico32 = await sharp(src.buf).resize(32, 32, { fit: 'contain' }).png().toBuffer()
  const ico48 = await sharp(src.buf).resize(48, 48, { fit: 'contain' }).png().toBuffer()
  const ico = encodeIco([
    { size: 16, buf: ico16 },
    { size: 32, buf: ico32 },
    { size: 48, buf: ico48 },
  ])
  await fs.writeFile(path.join(ICONS_DIR, 'favicon.ico'), ico)
  console.log('✓ PWA  favicon.ico (16/32/48 multi-size)')
}

async function generateAndroidIcons(src) {
  for (const [density, size] of Object.entries(DENSITY)) {
    const outDir = path.join(ANDROID_RES, `mipmap-${density}`)
    await ensureOut(outDir)

    // Legacy launcher icon (full bleed)
    await sharp(src.buf)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'))

    await sharp(src.buf)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'))

    // Adaptive-icon foreground: scaled into safe zone with transparent bg
    const inner = Math.round(size * SAFE_ZONE)
    const innerPng = await sharp(src.buf)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    const offset = Math.round((size - inner) / 2)
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerPng, left: offset, top: offset }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'))

    console.log(`✓ Android ${density}: ${size}px -> ic_launcher{,_round,_foreground}.png`)
  }
}

// Build a minimal .ico container holding PNG-encoded sub-images.
// Reference: https://en.wikipedia.org/wiki/ICO_(file_format)
function encodeIco(entries) {
  const headerSize = 6
  const dirSize = 16 * entries.length
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)         // reserved
  header.writeUInt16LE(1, 2)         // type: 1 = icon
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(dirSize)
  const datas = []
  let offset = headerSize + dirSize
  entries.forEach((e, i) => {
    const sz = e.size >= 256 ? 0 : e.size
    dir.writeUInt8(sz, i * 16 + 0)        // width
    dir.writeUInt8(sz, i * 16 + 1)        // height
    dir.writeUInt8(0, i * 16 + 2)         // palette
    dir.writeUInt8(0, i * 16 + 3)         // reserved
    dir.writeUInt16LE(1, i * 16 + 4)      // planes
    dir.writeUInt16LE(32, i * 16 + 6)     // bpp
    dir.writeUInt32LE(e.buf.length, i * 16 + 8)
    dir.writeUInt32LE(offset, i * 16 + 12)
    offset += e.buf.length
    datas.push(e.buf)
  })
  return Buffer.concat([header, dir, ...datas])
}

async function main() {
  const src = await loadSource()
  console.log(`Source: ${SRC} (${src.meta.width}x${src.meta.height})\n`)
  await generatePwaIcons(src)
  console.log('')
  await generateAndroidIcons(src)
  console.log('\nDone. Rebuild the APK to see the new Android launcher icon.')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
