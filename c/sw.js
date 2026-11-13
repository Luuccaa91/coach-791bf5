/* Service Worker der Handy-Fassung (Trainings-Cockpit).
   Online liegt alles nur verschluesselt: Code als <pfad>.enc (AES-256-GCM) neben dieser Datei, Daten im geheimen Gist
   (Adresse nur verschluesselt in schluessel.json). Der Schluessel wird auf der Passwort-Seite aus deinem Passwort
   abgeleitet und nur auf diesem Geraet gespeichert (IndexedDB). Ohne Schluessel: Passwort-Seite. */
const BASIS = new URL('./', self.location).pathname
const OFFEN = ['index.html', 'sw.js', 'schluessel.json', 'manifest.webmanifest', 'icon.png', 'icon-192.png', 'version.txt']
const TYP = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', woff2: 'font/woff2', woff: 'font/woff', webmanifest: 'application/manifest+json' }
let K = null, GIST = undefined

function db() { return new Promise((ok, nein) => { const r = indexedDB.open('cockpit', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => nein(r.error) }) }
async function lies(n) { const d = await db(); return new Promise((ok) => { const q = d.transaction('k').objectStore('k').get(n); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null) }) }
async function schluessel() {
  if (K) return K
  const raw = await lies('schluessel'); if (!raw) return null
  K = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); GIST = (await lies('gist')) || null; return K
}
async function vergiss() { K = null; GIST = undefined; const d = await db(); const t = d.transaction('k', 'readwrite'); t.objectStore('k').delete('schluessel'); t.objectStore('k').delete('gist') }
const entschl = (k, b) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, k, b.slice(12))
const entpacke = async (buf) => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
const b64 = (s) => Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('message', (e) => { if (e.data === 'neu') { K = null; GIST = undefined } })

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (u.origin !== location.origin || !u.pathname.startsWith(BASIS) || e.request.method !== 'GET') return
  const rest = u.pathname.slice(BASIS.length)
  if (rest.endsWith('.enc') || (rest && OFFEN.includes(rest))) return
  e.respondWith(liefern(rest, e.request))
})

const passwortSeite = () => fetch(BASIS + 'index.html', { cache: 'no-cache' })
const gesperrt = (req) => (req.mode === 'navigate' ? passwortSeite() : new Response('gesperrt', { status: 401 }))

async function liefern(rest, req) {
  const k = await schluessel(); if (!k) return gesperrt(req)
  try {
    if (rest === 'daten.json') {          // Daten: gzip + AES-GCM, aus dem Gist (bzw. daneben liegend, falls kein Gist)
      const b = GIST ? b64(await (await fetch(GIST + 'cockpit.enc?t=' + Date.now(), { cache: 'no-store' })).text())
                     : new Uint8Array(await (await fetch(BASIS + 'daten.json.enc', { cache: 'no-store' })).arrayBuffer())
      return new Response(await entpacke(await entschl(k, b)), { headers: { 'content-type': TYP.json, 'cache-control': 'no-store' } })
    }
    let p = rest === '' || rest.endsWith('/') ? rest + 'index.html' : rest
    const r = await fetch(BASIS + p + '.enc', { cache: 'no-cache' })
    if (!r.ok) return new Response('nicht gefunden', { status: 404 })
    const klar = await entschl(k, new Uint8Array(await r.arrayBuffer()))
    return new Response(klar, { headers: { 'content-type': TYP[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' } })
  } catch (err) {
    if (err && err.name === 'OperationError') { await vergiss(); return gesperrt(req) }   // Passwort geaendert -> neu anmelden
    return new Response('Fehler: ' + (err && err.message), { status: 502 })
  }
}
