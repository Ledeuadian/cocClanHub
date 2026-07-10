// Run this with: node build.mjs
// It will output build progress to stdout (which should be visible)

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('Starting vite build...')

const child = spawn('npx', ['vite', 'build'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code) => {
  console.log(`\nBuild finished with exit code: ${code}`)
  if (code === 0) {
    console.log('✓ dist/ folder should now exist with manifest.webmanifest and sw.js')
  }
})
