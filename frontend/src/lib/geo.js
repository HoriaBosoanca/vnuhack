/* ================== HĂRȚI & ADRESĂ → HARTĂ (geocodare) ================== */

/* ===== Hărțile de bază (tiles) =====
   - openstreetmap.org blochează aplicațiile („tile usage policy”).
   - CARTO cere cheie API din aug. 2026 (altfel apare „API KEY REQUIRED”).
   Dacă pui o cheie CARTO gratuită (carto.com/basemaps/apikey) mai jos, se folosește CARTO Voyager.
   Fără cheie, se folosește Esri World Street Map, care merge fără cheie. */
const CARTO_KEY = '' // ← lipește aici cheia ta CARTO, ex. 'abc123...'
export const TILES = CARTO_KEY
  ? { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(CARTO_KEY),
      opts: { subdomains: 'abcd', maxZoom: 20, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } }
  : { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' } }

/* Folosim serviciul public Photon (photon.komoot.io, date OpenStreetMap), gratuit și fără cheie.
   E „fair use”: pentru un site cu trafic mare folosește o cheie la MapTiler / Geoapify sau un server propriu. */
const GEO_URL = 'https://photon.komoot.io/api/', RO_BBOX = '20.2,43.6,29.8,48.3', geoCache = {}

function normStreet(a) {
  return (a || '').replace(/\b(bl|sc|et|ap)\.?\s*[\w-]+/gi, '').replace(/\bnr\.?\s*/gi, '').replace(/\bstr\.\s*/gi, 'Strada ').replace(/\bbd\.\s*/gi, 'Bulevardul ')
    .replace(/\b(șos|sos)\.\s*/gi, 'Șoseaua ').replace(/\bcal\.\s*/gi, 'Calea ').replace(/\bsector\s*\d+/gi, '').replace(/(\s*,\s*)+/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '')
}

async function photon(q) {
  if (q in geoCache) return geoCache[q]
  try {
    const r = await fetch(`${GEO_URL}?q=${encodeURIComponent(q)}&limit=1&bbox=${RO_BBOX}`); if (!r.ok) return undefined
    const f = (await r.json()).features?.[0]
    const res = f ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], type: f.properties?.type || '' } : null
    geoCache[q] = res; return res
  } catch (e) { return undefined } // undefined = eroare de rețea (se reîncearcă), null = negăsit
}

export async function geocode({ address, city, county }) {
  const place = county === 'București' ? 'București' : `${city}, ${county}`
  if (address) { const r = await photon(`${normStreet(address)}, ${place}, România`); if (r === undefined) return undefined; if (r) return { ...r, approx: !['house', 'street'].includes(r.type) } }
  const c = await photon(county === 'București' ? 'București, România' : `${city}, ${county}, România`)
  return c === undefined ? undefined : c ? { ...c, approx: true } : null
}

/* Geocodare inversă (punct pe hartă → adresă), tot prin Photon. Întoarce { address, city, county } sau null. */
export async function reverseGeocode(lat, lng, counties) {
  let p
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`); if (!r.ok) return null
    p = (await r.json()).features?.[0]?.properties; if (!p) return null
  } catch (e) { return null }
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^(judetul|municipiul)\s+/, '').trim()
  const findCounty = (...names) => { for (const n of names) { const k = counties.find(c => norm(c) === norm(n)); if (k) return k } return '' }
  const county = findCounty(p.state, p.county, p.city)
  /* În București localitatea din formular e sectorul. */
  const sector = [p.district, p.city, p.county].find(v => /sector/i.test(v || ''))
  const city = county === 'București' ? (sector ? sector.replace(/^sectorul/i, 'Sector') : 'București') : (p.city || p.town || p.village || p.district || p.county || '')
  const street = p.street || (p.type === 'street' ? p.name : '')
  const address = street ? `${street}${p.housenumber ? ' nr. ' + p.housenumber : ''}` : (p.name || '')
  return { address, city, county }
}
