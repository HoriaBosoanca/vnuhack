import { useEffect, useRef } from 'react'
import { fmtPrice } from '../lib/utils'
import {
  useStore, S, emit, openDetail, byRandom, setFilter, resetFilters, setMapHidden, openPublish, openMessages,
  openAccount, openHelp, openTerms, unreadCount,
} from '../lib/store'

const TYPES = [
  ['event', 'Evenimente', 'Petreceri, nunți, aniversări'],
  ['storage', 'Depozitare', 'Garaje, boxe și depozite'],
  ['work', 'Lucru', 'Studiouri și birouri pe ore'],
  ['leisure', 'Relaxare', 'Curți și locuri de joacă'],
]
const TAGLINE = Object.fromEntries(TYPES.map(([t, , p]) => [t, p]))

export const scrollToEl = sel => { const el = document.querySelector(sel); el && el.scrollIntoView({ behavior: S.ui.animOn ? 'smooth' : 'auto' }) }
export const toLayout = () => scrollToEl('.layout')
const showType = t => { setFilter({ type: t }); toLayout() }

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

/* Prima secțiune de pe pagină: „Spațiul tău e aproape”, pe tot ecranul.
   La scroll conținutul urcă și se estompează, iar fundalul verde se topește în bejul secțiunii de dedesubt. */
export function MapPromo() {
  const s = useStore(), recent = [...s.listings].sort(byRandom).slice(0, 3), ref = useRef(null)
  useEffect(() => {
    const el = ref.current; let tick = false
    const upd = () => { tick = false; const h = el.offsetHeight || 1; el.style.setProperty('--mp', Math.min(1, Math.max(0, scrollY / h)).toFixed(3)) }
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(upd) } }
    addEventListener('scroll', onScroll, { passive: true }); upd()
    return () => removeEventListener('scroll', onScroll)
  }, [])
  const openMap = () => { if (S.ui.mapHidden) setMapHidden(false); toLayout() }
  return (
    <section className="lb-map mp-top" id="lbMap" ref={ref}>
      <div className="mp-in">
        <div className="mp-text">
        <div className="mp-eyebrow">Închirieri pe ore, zile sau luni</div>
        <h2>Spațiul tău e <em>aproape</em></h2>
        <p>Vezi pe hartă tot ce se poate închiria în jurul tău și rezervă direct de la proprietar.</p>
        <div className="mp-cta">
          <button type="button" className="iv-cta" onClick={openMap}>Deschide harta</button>
          <button type="button" className="iv-link" onClick={() => scrollToEl('#lbCats')}>Descoperă spațiile</button>
        </div>
        </div>
        {/* Colaj cu pozele celor mai recente 3 anunțuri; fără anunțuri nu apare nimic. */}
        {recent.length > 0 && <div className={`mp-art n${recent.length}`}>
          {recent.map((x, k) => (
            <button type="button" key={x.id} className={`mp-card c${k + 1}`} style={{ backgroundImage: `url('${x.img}')` }} onClick={() => openDetail(x.id)} aria-label={x.title}>
              <span className="mp-tag"><b>{x.title}</b>{fmtPrice(x.price)} lei / {x.unit}</span>
            </button>
          ))}
        </div>}
      </div>
      <button type="button" className="mp-cue" onClick={() => scrollToEl('#lbCats')} aria-label="Mergi mai jos"><span>Mai jos</span><i aria-hidden="true" /></button>
    </section>
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
