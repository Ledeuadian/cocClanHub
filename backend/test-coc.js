// Test: prove the URL encoding is correct end-to-end
const tag = '28JCLC9RP'
const encoded = encodeURIComponent(tag)
const fullUrl = `http://localhost:5000/api/coc/players/${encoded}`

console.log('=== URL Encoding Test ===')
console.log('Input tag:    ', tag)
console.log('Encoded:      ', encoded)
console.log('Full URL:     ', fullUrl)
console.log()
console.log('=== Direct fetch (using node fetch) ===')

fetch(fullUrl, { method: 'GET' })
  .then(async (res) => {
    console.log('Status:', res.status)
    const text = await res.text()
    console.log('Body (first 200 chars):', text.substring(0, 200))
  })
  .catch((err) => console.log('Fetch error:', err.message))
