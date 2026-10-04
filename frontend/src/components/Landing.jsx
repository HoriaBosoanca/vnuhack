import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useStore, S, emit, listingRating, openDetail, setFilter, resetFilters, setMapHidden, openPublish, openMessages,
  openAccount, openHelp, openTerms, unreadCount,
} from '../lib/store'
import { fmtPrice } from '../lib/utils'

const DUR = 6500 // cât stă fiecare slide în intro (ms)
const TYPES = [
  ['event', 'Evenimente', 'Petreceri, nunți, aniversări'],
  ['storage', 'Depozitare', 'Garaje, boxe și depozite'],
  ['work', 'Lucru', 'Studiouri și birouri pe ore'],
  ['leisure', 'Timp liber', 'Curți și locuri de joacă'],
]
const TAGLINE = Object.fromEntries(TYPES.map(([t, , p]) => [t, p]))

export const scrollToEl = sel => { const el = document.querySelector(sel); el && el.scrollIntoView({ behavior: S.ui.animOn ? 'smooth' : 'auto' }) }
export const toLayout = () => scrollToEl('.layout')
const showType = t => { setFilter({ type: t }); toLayout() }

/* Primul rând din descriere, scurtat, ca subtitlu; altfel descrierea categoriei. */
function eyebrow(x) {
  const d = (x.desc || '').split(/(?<=[.!?])\s/)[0].trim()
  if (!d) return TAGLINE[x.type] || ''
  return d.length > 70 ? d.slice(0, 68).trimEnd() + '…' : d
}

/* Slide-urile intro-ului: până la 5 spații publicate (cele mai bine notate, apoi cele mai noi), cu pozele lor. */
function useSlides(listings, reviewsN) {
  /* Lista de anunțuri e modificată pe loc (ex. la publicare), așa că memo-ul depinde de conținutul ei. */
  const sig = listings.map(x => `${x.id}:${x.img}:${x.price}`).join('|')
  return useMemo(() => {
    const best = [...listings].sort((a, b) => {
      const ra = listingRating(a), rb = listingRating(b)
      return (rb.n ? rb.avg : 0) - (ra.n ? ra.avg : 0) || rb.n - ra.n
    }).slice(0, 5)
    return best.map(x => ({
      id: x.id, img: x.img, eye: eyebrow(x), title: x.title,
      price: `${fmtPrice(x.price)} lei / ${x.unit}`, loc: x.location.replace(' · ', ', '), short: x.title,
    }))
  }, [sig, reviewsN])
}

export function Intro() {
  const s = useStore(), slides = useSlides(s.listings, s.reviews.length)
  const [cur, setCur] = useState(0), [cycle, setCycle] = useState(0), [seen, setSeen] = useState(true)
  const ref = useRef(null), animOn = s.ui.animOn
  const i = cur < slides.length ? cur : 0, d = slides[i] || null
  const go = n => { setCur(n); setCycle(c => c + 1) }

  /* Trecerea automată la următorul slide (oprită dacă intro-ul nu se vede, tabul e ascuns sau animațiile sunt oprite). */
  useEffect(() => {
    if (!animOn || !seen || slides.length < 2) return
    const t = setTimeout(() => go((i + 1) % slides.length), DUR)
    return () => clearTimeout(t)
  }, [i, cycle, animOn, seen, slides.length])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = window.IntersectionObserver && new IntersectionObserver(es => setSeen(es[0].isIntersecting), { threshold: .3 })
    io && io.observe(el)
    const vis = () => setSeen(!document.hidden)
    document.addEventListener('visibilitychange', vis)
    /* Parallax și estompare la scroll. */
    let tick = false
    const upd = () => {
      tick = false; const y = scrollY, h = el.offsetHeight
      if (y <= h) { el.style.setProperty('--ipy', (y * .25).toFixed(1) + 'px'); el.style.setProperty('--ipt', (y * -.1).toFixed(1) + 'px'); el.style.setProperty('--io', Math.max(0, 1 - y / h * 1.25).toFixed(2)) }
    }
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(upd) } }
    addEventListener('scroll', onScroll, { passive: true }); upd()
    return () => { io && io.disconnect(); document.removeEventListener('visibilitychange', vis); removeEventListener('scroll', onScroll) }
  }, [!!d])
  /* Fără anunțuri publicate nu arătăm intro-ul (nici poze, nici titluri generice). Cât se încarcă, rămâne doar fundalul. */
  if (!d) return s.loaded ? null : <section className="intro" id="intro" aria-hidden="true" />

  const open = () => openDetail(d.id)
  return (
    <section className="intro" id="intro" ref={ref} aria-label="Spații în evidență" style={{ '--ivdur': DUR + 'ms' }}>
      <div className="iv-media" aria-hidden="true">
        {slides.map((sl, k) => <div key={sl.id} className={`iv-slide${k === i ? ' on' : ''}`}><div className="iv-img" style={{ backgroundImage: `url('${sl.img}')` }} /></div>)}
      </div>
      <div className="iv-count" aria-hidden="true"><b>{String(i + 1).padStart(2, '0')}</b><span>/ {String(slides.length).padStart(2, '0')}</span></div>
      <div className="iv-in">
        <div className="iv-text swap" key={`${i}-${cycle}`}>
          <p className="iv-eyebrow">{d.eye}</p>
          <div className="iv-title">{d.title}</div>
          <div className="iv-meta">
            <button type="button" className="iv-cta" onClick={open}>Începe rezervarea</button>
            <button type="button" className="iv-link" onClick={toLayout}>Descoperă toate spațiile</button>
            <div className="iv-info"><b>{d.price}</b><span>{d.loc}</span></div>
          </div>
        </div>
        {slides.length > 1 && <ul className="iv-list">
          {slides.map((sl, k) => (
            <li key={sl.id}>
              {/* key cu „cycle” repornește bara de progres a slide-ului activ */}
              <button type="button" key={k === i ? `on-${cycle}` : 'off'} className={k === i ? 'on' : ''} aria-current={k === i ? 'true' : undefined} aria-label={sl.short}
                onClick={() => go(k)}><span>{sl.short}</span></button>
            </li>
          ))}
        </ul>}
      </div>
      <div className="iv-cue" aria-hidden="true" />
    </section>
  )
}

/* Categorii, ca lista de modele: primele 4 spații din fiecare tip. */
export function Categories() {
  const s = useStore()
  return (
    <section className="lb-cats" id="lbCats" aria-label="Categorii de spații"><div className="lb-grid">
      {TYPES.map(([t, name, tag]) => {
        const items = s.listings.filter(x => x.type === t).slice(0, 4)
        return (
          <div className="lb-col" key={t}>
            <h3>{name}</h3><p>{tag}</p>
            <ul className="lb-names">
              {items.length ? items.map(x => <li key={x.id}><button type="button" onClick={() => openDetail(x.id)}>{x.title}</button></li>)
                : <li style={{ opacity: .6, fontSize: 15 }}>Niciun spațiu momentan</li>}
            </ul>
            <button type="button" className="iv-link lb-more" onClick={() => showType(t)}>Vezi toate</button>
          </div>
        )
      })}
    </div></section>
  )
}

export function MapPromo() {
  return (
    <section className="lb-map" id="lbMap"><div>
      <h2>Spațiul tău e aproape</h2>
      <p>Vezi pe hartă tot ce se poate închiria în jurul tău și rezervă direct de la proprietar.</p>
      <button type="button" className="iv-cta" onClick={() => { if (S.ui.mapHidden) setMapHidden(false); toLayout() }}>Deschide harta</button>
    </div></section>
  )
}

export function setMenu(open) { S.ui.menuOpen = open; emit() }
export function setAnim(on) { S.ui.animOn = on; try { localStorage.setItem('spatiu_anim', on ? 'on' : 'off') } catch (e) {} emit() }

/* Meniul pe tot ecranul. */
export function MenuOverlay() {
  const s = useStore(), open = s.ui.menuOpen, n = unreadCount(), closeRef = useRef(null)
  useEffect(() => {
    document.body.classList.toggle('menu-lock', open)
    if (open) setTimeout(() => closeRef.current?.focus(), 60)
  }, [open])
  const act = fn => () => { setMenu(false); setTimeout(fn, 120) }
  const main = [
    ['Explorează spațiile', () => { resetFilters(); toLayout() }],
    ['Publică un spațiu', openPublish],
    ['Mesaje', () => openMessages(), true],
    ['Contul meu', openAccount],
  ]
  return (
    <div className={`menu-ov${open ? ' open' : ''}`} id="menuOv" aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Meniu">
      <div className="mo-top">
        <button ref={closeRef} className="menu-btn" type="button" onClick={() => setMenu(false)} aria-label="Închide meniul"><span className="x" aria-hidden="true" /><span className="menu-lbl">Închide</span></button>
        <div className="logo">SPAȚIU<span>.</span></div><span />
      </div>
      <div className="mo-body">
        <div className="mo-main">
          {main.map(([label, fn, badge], k) => (
            <button key={label} className="mo-in" style={{ '--k': k }} onClick={act(fn)}>{label}{badge && n > 0 && <span className="msg-count">{n}</span>}</button>
          ))}
        </div>
        <div className="mo-side">
          <h4 className="mo-in" style={{ '--k': 2 }}>Alege după scop</h4>
          <ul>{TYPES.map(([t, name], k) => <li key={t} className="mo-in" style={{ '--k': 3 + k }}><button onClick={act(() => showType(t))}>{name}</button></li>)}</ul>
          <h4 className="mo-in" style={{ '--k': 5 }}>Informații</h4>
          <ul className="small">
            <li className="mo-in" style={{ '--k': 6 }}><button onClick={act(openHelp)}>Ai nevoie de ajutor?</button></li>
            <li className="mo-in" style={{ '--k': 7 }}><button onClick={act(() => openTerms())}>Termeni și condiții</button></li>
          </ul>
        </div>
      </div>
      <div className="mo-foot"><span>SPAȚIU · Închiriază spațiul potrivit</span>
        <button className="iv-link" type="button" aria-pressed={s.ui.animOn} onClick={() => setAnim(!s.ui.animOn)}>Animații: {s.ui.animOn ? 'pornite' : 'oprite'}</button>
      </div>
    </div>
  )
}
