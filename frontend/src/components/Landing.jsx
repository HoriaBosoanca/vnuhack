import { useEffect, useRef } from 'react'
import {
  useStore, S, emit, openDetail, setFilter, resetFilters, setMapHidden, openPublish, openMessages,
  openAccount, openHelp, openTerms, unreadCount,
} from '../lib/store'
import { fmtPrice } from '../lib/utils'

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

/* Arcade decorative (fără poze generice) cât timp nu există anunțuri. */
function Arches() {
  return (
    <svg className="ld-arches" viewBox="0 0 520 460" aria-hidden="true">
      <circle cx="360" cy="120" r="86" fill="#e8d3a6" />
      <path d="M40 460V250a90 90 0 0 1 180 0v210z" fill="#3f6a4e" />
      <path d="M82 460V262a48 48 0 0 1 96 0v198z" fill="#2f5240" />
      <path d="M250 460V200a110 110 0 0 1 220 0v260z" fill="#efe1c6" />
      <path d="M286 460V224a74 74 0 0 1 148 0v236z" fill="#a9bba5" />
      <path d="M200 460c0-50 18-80 40-80s40 30 40 80z" fill="#c98a3c" opacity=".85" />
    </svg>
  )
}

/* Partea de sus a site-ului: landing static. Colajul folosește pozele celor mai recente anunțuri. */
export function Welcome() {
  const s = useStore()
  const recent = s.listings.slice(0, 3)
  const counties = new Set(s.listings.map(x => x.county)).size
  const owners = new Set(s.listings.map(x => x.owner.id)).size
  return (
    <section className="landing" id="intro" aria-label="SPAȚIU">
      <div className="ld-in">
        <div className="ld-text">
          <div className="ld-eyebrow">Închirieri pe ore, zile sau luni</div>
          <h1 className="ld-title">Spațiul potrivit, <em>exact</em> când ai nevoie de el.</h1>
          <p className="ld-sub">Case, curți, săli, garaje și boxe închiriate direct de la proprietari. Alegi zilele, plătești sigur și primești biletul pe loc.</p>
          <div className="ld-cta">
            <button type="button" className="btn primary big ld-go" onClick={toLayout}>Explorează spațiile <span aria-hidden="true">→</span></button>
            <button type="button" className="btn big" onClick={openPublish}>Publică un spațiu</button>
          </div>
          {s.listings.length > 0 && <div className="ld-stats">
            <div><b>{s.listings.length}</b><span>{s.listings.length === 1 ? 'spațiu publicat' : 'spații publicate'}</span></div>
            <div><b>{counties}</b><span>{counties === 1 ? 'județ' : 'județe'}</span></div>
            <div><b>{owners}</b><span>{owners === 1 ? 'proprietar' : 'proprietari'}</span></div>
          </div>}
        </div>
        <div className={`ld-art n${recent.length}`}>
          {recent.length ? recent.map((x, k) => (
            <button type="button" key={x.id} className={`ld-card c${k + 1}`} style={{ backgroundImage: `url('${x.img}')` }} onClick={() => openDetail(x.id)} aria-label={x.title}>
              <span className="ld-tag"><b>{x.title}</b>{fmtPrice(x.price)} lei / {x.unit}</span>
            </button>
          )) : <Arches />}
        </div>
      </div>
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
