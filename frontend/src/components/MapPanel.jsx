import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { useStore, mapApi, byId, isMine, listingRating, openDetail, startChat, setMapHidden } from '../lib/store'
import { TILES } from '../lib/geo'
import { fmtPrice, thumb, label } from '../lib/utils'
import { RatingLine, SafetyTags } from './ui'

const pinIcon = x => L.divIcon({ className: '', html: `<div class="pin"><div class="pin-img" style="background-image:url('${thumb(x.img)}')"></div><span class="pin-price">${fmtPrice(x.price)} lei/${x.unit}</span></div>`, iconSize: [54, 54], iconAnchor: [27, 27] })

export function ContactBtn({ x, cls = 'btn sm' }) {
  return isMine(x) ? <button className={cls} disabled>Anunțul tău</button> : <button className={cls} onClick={() => startChat(x.id)}>💬 Mesaj</button>
}

/* Harta din dreapta: bule cu poză + card lângă bula aleasă. */
export default function MapPanel({ data }) {
  const s = useStore()
  const mapEl = useRef(null), wrapRef = useRef(null), cardRef = useRef(null)
  const mapRef = useRef(null), markers = useRef([]), activeRef = useRef(null), fitRef = useRef(false)
  const [activeId, setActive] = useState(null)
  activeRef.current = activeId

  /* ---- Poziționare card: LÂNGĂ bulă (dreapta, sau stânga dacă nu încape); pe hărți înguste devine panou jos. ---- */
  const position = () => {
    const card = cardRef.current, map = mapRef.current, wrap = wrapRef.current
    if (activeRef.current === null || !card || !card.classList.contains('show')) return
    const x = byId(activeRef.current); if (!x) return setActive(null)
    const W = wrap.clientWidth, H = wrap.clientHeight
    if (W < 420) { card.classList.add('sheet'); card.classList.remove('side-left', 'side-right', 'offscreen'); card.style.left = card.style.top = ''; return }
    card.classList.remove('sheet')
    const p = map.latLngToContainerPoint([x.lat, x.lng]), cw = card.offsetWidth, ch = card.offsetHeight, gap = 38
    const right = p.x + gap + cw <= W - 10
    const left = Math.max(10, Math.min(right ? p.x + gap : p.x - gap - cw, W - cw - 10))
    const top = Math.max(10, Math.min(p.y - ch / 2, H - ch - 10))
    card.classList.toggle('side-right', right); card.classList.toggle('side-left', !right)
    card.style.left = left + 'px'; card.style.top = top + 'px'
    card.style.setProperty('--ay', Math.max(18, Math.min(p.y - top, ch - 18)) + 'px')
    card.classList.toggle('offscreen', p.x < 0 || p.y < 0 || p.x > W || p.y > H)
  }
  /* Dacă bula ar fi acoperită de card, mutăm puțin harta. */
  const ensureRoom = () => {
    const x = byId(activeRef.current), map = mapRef.current, card = cardRef.current, W = wrapRef.current.clientWidth, H = wrapRef.current.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight
    if (!x) return
    const p = map.latLngToContainerPoint([x.lat, x.lng])
    if (W < 420) { const want = (H - ch - 10) / 2; if (p.y > H - ch - 50 || p.y < 40) map.panBy([0, p.y - want]); return }
    const maxRight = W - 10 - cw - 38, minLeft = 10 + cw + 38; if (p.x <= maxRight || p.x >= minLeft) return
    const a = p.x - maxRight, b = p.x - minLeft; map.panBy([Math.abs(a) < Math.abs(b) ? a : b, 0])
  }
  const roomOffset = () => { const W = wrapRef.current.clientWidth, card = cardRef.current, cw = card.offsetWidth || 280; return W < 420 ? [0, ((card.offsetHeight || 140) + 10) / 2] : [Math.max(0, W / 2 - (W - 10 - cw - 38)), 0] }
  const setActiveMarker = id => markers.current.forEach(m => { const on = m.listingId === id; m.getElement()?.querySelector('.pin')?.classList.toggle('active', on); m.setZIndexOffset(on ? 1000 : 0) })
  const openCard = (id, fit) => { fitRef.current = !!fit; setActive(id) }
  const closeCard = () => setActive(null)

  /* ---- Inițializare hartă ---- */
  useEffect(() => {
    const map = L.map(mapEl.current).setView([44.45, 26.09], 11); mapRef.current = map
    L.tileLayer(TILES.url, TILES.opts).addTo(map)
    map.on('move resize', position)
    map.on('zoomstart', () => cardRef.current?.classList.add('fading'))
    map.on('zoomend', () => { cardRef.current?.classList.remove('fading'); position() })
    map.on('click', closeCard)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  /* ---- Bulele de pe hartă, pentru anunțurile filtrate ---- */
  const dataRef = useRef(data); dataRef.current = data
  const sig = data.map(x => [x.id, x.lat, x.lng, x.price, x.img].join(',')).join('|')
  useEffect(() => {
    const data = dataRef.current
    const map = mapRef.current
    markers.current.forEach(m => map.removeLayer(m)); markers.current = []
    data.forEach(x => {
      const m = L.marker([x.lat, x.lng], { icon: pinIcon(x), title: x.title, riseOnHover: true }).addTo(map)
      m.listingId = x.id; m.on('click', () => openCard(x.id, true)); markers.current.push(m)
    })
    if (activeRef.current !== null) { data.some(x => x.id === activeRef.current) ? setActiveMarker(activeRef.current) : closeCard() }
  }, [sig])

  /* ---- Cardul activ ---- */
  useLayoutEffect(() => {
    const card = cardRef.current
    card.classList.toggle('show', activeId !== null)
    setActiveMarker(activeId)
    if (activeId !== null) { position(); if (fitRef.current) { fitRef.current = false; ensureRoom() } }
  })

  /* ---- API pentru restul aplicației ---- */
  useEffect(() => {
    mapApi.isVisible = id => markers.current.some(m => m.listingId === id)
    mapApi.closeMapCard = closeCard
    mapApi.hoverPin = (id, on) => { const m = markers.current.find(m => m.listingId === id); if (!m) return; m.getElement()?.querySelector('.pin')?.classList.toggle('hover', on); m.setZIndexOffset(on || id === activeRef.current ? 1000 : 0) }
    mapApi.focusListing = (id, scroll) => {
      const x = byId(id), map = mapRef.current; if (!x || !map) return
      const z = Math.max(map.getZoom(), 14), visible = mapApi.isVisible(id); let c = L.latLng(x.lat, x.lng)
      if (visible) { activeRef.current = id; setActive(id); c = map.unproject(map.project(c, z).add(roomOffset()), z) }
      map.setView(c, z)
      if (scroll && innerWidth <= 900) wrapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    mapApi.invalidate = () => { mapRef.current?.invalidateSize(); position() }
  })

  /* Esc închide cardul de pe hartă dacă nu e deschisă nicio fereastră (vezi App). */
  useEffect(() => { mapApi.escape = closeCard }, [])

  const x = activeId !== null ? byId(activeId) : null
  const hidden = s.ui.mapHidden, t = hidden ? 'Arată harta' : 'Ascunde harta'
  return (
    <div className="mapcol" id="mapcol">
      <button className="map-toggle" id="mapToggle" onClick={() => setMapHidden(!hidden)} aria-expanded={!hidden} aria-controls="mapwrap" title={t}>
        <span className="arrow" aria-hidden="true">›</span><span className="mt-label">{t}</span>
      </button>
      <div className="mapwrap" id="mapwrap" ref={wrapRef}>
        <div id="map" ref={mapEl} />
        <div className="map-card" id="mapCard" ref={cardRef}>
          {x && <>
            <div className="mc-photo" style={{ backgroundImage: `url('${x.img}')` }}><span className="badge">{label(x.type)}</span></div>
            <button className="mc-close" onClick={closeCard} aria-label="Închide">×</button>
            <div className="mc-body">
              <h4>{x.title}</h4><div className="location">📍 {x.location}</div>
              <div className="mc-price">{fmtPrice(x.price)} lei <span>/ {x.unit}</span></div>
              <RatingLine r={listingRating(x)} />
              <div className="mc-facts"><span>📐 {x.area} m²</span><span>🔑 {x.access}</span></div>
              <div className="mc-safety"><SafetyTags x={x} /></div>
              <div className="mc-actions"><button className="btn primary sm" onClick={() => openDetail(x.id)}>Vezi detalii</button><ContactBtn x={x} /></div>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
