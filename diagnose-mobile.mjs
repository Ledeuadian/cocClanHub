// Diagnose mobile connection issues
// Run with: node diagnose-mobile.mjs
import { networkInterfaces } from 'os'
import net from 'net'

console.log('\n🔍 MOBILE CONNECTION DIAGNOSTIC\n')

// 1. Show LAN IP
const nets = networkInterfaces()
const addresses = []
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      addresses.push({ name, address: net.address, netmask: net.netmask })
    }
  }
}
console.log('1. Your desktop LAN IP addresses:')
if (addresses.length === 0) {
  console.log('   ❌ No LAN IP found! Connect to WiFi first.')
} else {
  for (const a of addresses) {
    console.log(`   ✓ ${a.name.padEnd(15)} ${a.address.padEnd(18)} (${a.netmask})`)
  }
}
console.log('   Use the address above on your phone.\n')

// 2. Test if backend is running
console.log('2. Checking if backend is listening...')
const tryConnect = (port) => new Promise((resolve) => {
  const socket = new net.Socket()
  socket.setTimeout(2000)
  socket.on('connect', () => {
    socket.destroy()
    resolve(true)
  })
  socket.on('timeout', () => {
    socket.destroy()
    resolve(false)
  })
  socket.on('error', () => resolve(false))
  socket.connect(port, '127.0.0.1')
})

for (const port of [5000, 5173]) {
  const isUp = await tryConnect(port)
  console.log(`   ${isUp ? '✓' : '❌'} Port ${port}: ${isUp ? 'LISTENING' : 'NOT REACHABLE'}`)
}
console.log('   If 5000 says NOT REACHABLE, your backend is not running.\n')

// 3. Test the /api/coc/test endpoint via localhost
console.log('3. Testing /api/coc/test endpoint...')
try {
  const res = await fetch('http://127.0.0.1:5000/api/coc/test')
  const data = await res.json()
  console.log('   ✓ Backend responded:')
  console.log('     ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n     '))
} catch (e) {
  console.log('   ❌ Backend error: ' + e.message)
}
console.log('')

// 4. If LAN IP is shown, test the LAN IP too
if (addresses.length > 0) {
  console.log('4. Testing if your phone can reach you (testing on LAN IP)...')
  for (const a of addresses) {
    try {
      const res = await fetch(`http://${a.address}:5000/api/coc/test`)
      const data = await res.json()
      console.log(`   ✓ Reachable on ${a.address}:5000`)
    } catch (e) {
      console.log(`   ❌ NOT reachable on ${a.address}:5000 (${e.message})`)
      console.log('     → Windows Firewall is blocking. Run open-firewall.ps1 as Administrator.')
    }
  }
}

console.log('\n📋 NEXT STEPS:')
console.log('1. If port 5000 is NOT LISTENING → restart backend: cd backend && npm run dev')
console.log('2. If reachable on localhost but NOT on LAN IP → run open-firewall.ps1 as Admin')
console.log('3. If both pass → great! Type http://' + (addresses[0]?.address || 'YOUR_IP') + ':5173 on your phone')
console.log('4. If phone still shows no clan data → check the browser console on your phone for errors\n')
