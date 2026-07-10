// Find your local IP addresses — run with: node find-ip.mjs
import { networkInterfaces } from 'os'

const nets = networkInterfaces()
const results = []

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Skip internal (loopback) and non-IPv4
    if (net.family === 'IPv4' && !net.internal) {
      results.push({
        interface: name,
        address: net.address,
        netmask: net.netmask
      })
    }
  }
}

if (results.length === 0) {
  console.log('No external IPv4 addresses found.')
} else {
  console.log('\n🌐 Your local network interfaces:\n')
  for (const r of results) {
    console.log(`  ${r.interface.padEnd(15)} ${r.address.padEnd(20)} (${r.netmask})`)
  }
  console.log('\nUse the address above to access from your phone:')
  console.log('  http://YOUR_IP:5173  (Vite dev server)')
  console.log('  http://YOUR_IP:5000  (Backend API)')
  console.log('\nMake sure your phone is on the same WiFi network.\n')
}
