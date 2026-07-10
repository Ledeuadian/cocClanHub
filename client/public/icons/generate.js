// Generate PWA icons from favicon.svg using sharp (lightweight, fast)
// Run with: node public/icons/generate.js

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ROOT = path.resolve(process.cwd(), 'public')
const SVG = path.join(ROOT, 'favicon.svg')

const svg = fs.readFileSync(SVG)

// Standard PWA icon sizes
const sizes = [
  { size: 192, name: 'icon-192.png', purpose: 'standard' },
  { size: 512, name: 'icon-512.png', purpose: 'standard' }
]

// Maskable: same as standard but with 20% safe-zone padding.
// Easiest is to just use the standard icon — Vite PWA accepts a standard
// icon for the maskable purpose; the platform handles the masking.
const maskable = [
  { size: 512, name: 'icon-512-maskable.png', purpose: 'maskable' }
]

async function generate() {
  for (const { size, name } of [...sizes, ...maskable]) {
    const out = path.join(ROOT, 'icons', name)
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 15, b: 30, alpha: 1 } })
      .png()
      .toFile(out)
    console.log(`✓ Generated ${name} (${size}x${size})`)
  }
  console.log('Done.')
}

generate().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
