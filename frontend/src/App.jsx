import { useEffect, useRef, useState } from 'react'
import {
  useStore, S, loadAll, filteredListings, setFilter, resetFilters, activeFilterCount, toggleFav, openDetail,
  openPublish, openMessages, openAccount, openTerms, openSupport, listingRating, mapApi, anyOpen, closeTop,
  unreadCount, emit,
} from './lib/store'
import { COUNTY_NAMES, HOURS, HOURS_END, RULE_PRESETS, fmtPrice, label, ruleKey } from './lib/utils'
import MapPanel from './components/MapPanel'
import { Avatar, RatingLine } from './components/ui'
import DetailModal from './components/DetailModal'
import PublishModal from './components/PublishModal'
import MessagesModal from './components/MessagesModal'
import AccountModal from './components/AccountModal'
import AuthModal from './components/AuthModal'
import BookModal from './components/BookModal'
import TicketModal from './components/TicketModal'
import ReviewModal from './components/ReviewModal'
import TermsModal from './components/TermsModal'
import Toast from './components/Toast'

function Header() {
  const s = useStore(), n = unreadCount()
  return (
    <header>
      <div className="logo">SPAȚIU<span>.</span></div>
      <nav>
        <a onClick={() => { resetFilters(); document.querySelector('.layout').scrollIntoView({ behavior: 'smooth' }) }}>Explorează</a>
        <a onClick={() => openTerms()}>Termeni și condiții</a>
        <a className="help-link" onClick={openSupport} title="Scrie-ne în Mesaje" aria-label="Ai nevoie de ajutor?"><span className="full">Ai nevoie de ajutor?</span><span className="short">Ajutor</span></a>
      </nav>
      <div className="header-actions">
        <button className="btn" onClick={openPublish} aria-label="Publică un spațiu">＋<span className="lbl">Publică un spațiu</span></button>
        <button className="btn" onClick={() => openMessages()} aria-label="Mesaje">💬<span className="lbl">Mesaje</span>{n > 0 && <span className="msg-count">{n}</span>}</button>
        <button className="btn primary" id="accBtn" onClick={openAccount} aria-label="Contul meu">{s.user ? <Avatar name={s.user.name} cls="xs" /> : '👤'}<span>Cont</span></button>
      </div>
    </header>
  )
}

function Hero() {
  const f = useStore().ui.filters
  return (
    <section className="hero"><div className="hero-in"><div className="hero-main">
      <h1>Găsește spațiul pentru ceea ce ai nevoie.</h1>
      <p>Închiriază case, săli, curți, garaje sau spații de depozitare — de la câteva ore până la luni.</p>
      <div className="search">
        <input id="search" value={f.q} onChange={e => setFilter({ q: e.target.value })} placeholder="Ex. garaj pentru depozitare, casă pentru petrecere..." />
        <select id="type" value={f.type} onChange={e => setFilter({ type: e.target.value })}>
          <option value="all">Orice tip</option><option value="event">Evenimente</option><option value="storage">Depozitare</option><option value="work">Lucru</option><option value="leisure">Timp liber</option>
        </select>
        <select id="duration" value={f.duration} onChange={e => setFilter({ duration: e.target.value })}>
          <option value="all">Orice durată</option><option value="hour">Ore</option><option value="day">Zi</option><option value="month">Lună</option>
        </select>
        <button className="btn primary" onClick={() => document.querySelector('.layout').scrollIntoView({ behavior: 'smooth' })}>Caută</button>
      </div>
    </div></div></section>
  )
}

function Filters() {
  const s = useStore(), f = s.ui.filters
  /* Regulile disponibile: cele predefinite + toate regulile din anunțuri, fără dubluri. */
  const seen = new Map()
  ;[...RULE_PRESETS, ...s.listings.filter(x => !x.removed).flatMap(x => x.rules || [])].forEach(r => { const k = ruleKey(r); if (k && !seen.has(k)) seen.set(k, r) })
  f.rules.forEach(k => { if (!seen.has(k)) seen.set(k, k) })
  const toggleRule = k => setFilter({ rules: f.rules.includes(k) ? f.rules.filter(r => r !== k) : [...f.rules, k] })
  return (
    <div className="filters" id="filters">
      <div className="fgrid">
        <div className="field"><label htmlFor="fltCounty">Județ</label>
          <select id="fltCounty" value={f.county} onChange={e => setFilter({ county: e.target.value })}><option value="">Toate județele</option>{COUNTY_NAMES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="fltMin">Preț (lei / unitate)</label>
          <div className="time-row"><input id="fltMin" type="number" min="0" placeholder="min" value={f.min} onChange={e => setFilter({ min: e.target.value })} /><span>–</span><input id="fltMax" type="number" min="0" placeholder="max" value={f.max} onChange={e => setFilter({ max: e.target.value })} aria-label="Preț maxim" /></div></div>
        <div className="field"><label htmlFor="fltNoise">Zgomot permis</label>
          <select id="fltNoise" value={f.noise} onChange={e => setFilter({ noise: e.target.value })}><option value="0">Oricât</option><option value="55">Cel puțin 55 dB (liniștit)</option><option value="65">Cel puțin 65 dB (moderat)</option><option value="80">Cel puțin 80 dB (muzică, petreceri)</option><option value="999">Fără limită</option></select></div>
        <div className="field"><label htmlFor="fltAccess">Interval de acces</label>
          <select id="fltAccess" value={f.access} onChange={e => setFilter({ access: e.target.value })}><option value="any">Oricare</option><option value="24/7">Doar non-stop (24/7)</option><option value="range">Să fie deschis între…</option></select>
          {f.access === 'range' && <div className="time-row" style={{ marginTop: 6 }}>
            <select value={f.from} onChange={e => setFilter({ from: e.target.value })} aria-label="De la ora">{HOURS.map(h => <option key={h}>{h}</option>)}</select><span>–</span>
            <select value={f.to} onChange={e => setFilter({ to: e.target.value })} aria-label="Până la ora">{HOURS_END.map(h => <option key={h}>{h}</option>)}</select>
          </div>}
        </div>
        <div className="field full"><label>Reguli ale casei <span className="hint">· arată doar anunțurile care au toate regulile alese</span></label>
          <div className="rule-presets">{[...seen.keys()].map(k => { const on = f.rules.includes(k); return <button key={k} type="button" className={`chip${on ? ' active' : ''}`} aria-pressed={on} onClick={() => toggleRule(k)}>{seen.get(k)}</button> })}</div></div>
      </div>
      <div className="form-actions" style={{ marginTop: 12 }}><button className="btn sm" onClick={resetFilters}>Resetează filtrele</button></div>
    </div>
  )
}

function Card({ x }) {
  const s = useStore(), fav = s.favs.has(x.id)
  return (
    <article className="card" onClick={() => openDetail(x.id)} onMouseEnter={() => mapApi.hoverPin(x.id, true)} onMouseLeave={() => mapApi.hoverPin(x.id, false)}>
      <div className="photo" style={{ backgroundImage: `url('${x.img}')` }}>
        <span className="badge">{label(x.type)}</span>
        {x.imgs.length > 1 && <span className="pcount">📷 {x.imgs.length}</span>}
        <button className={`heart${fav ? ' on' : ''}`} aria-label="Salvează" onClick={e => { e.stopPropagation(); toggleFav(x.id) }}>{fav ? '♥' : '♡'}</button>
      </div>
      <div className="card-body">
        <h3>{x.title}</h3><div className="location">📍 {x.location}</div>
        <div className="price">{fmtPrice(x.price)} lei <span>/ {x.unit}</span></div>
        <RatingLine r={listingRating(x)} />
        <div className="specs"><span className="spec">{x.area} m²</span><span className="spec">🔊 {x.noise}</span><span className="spec">🔑 {x.access}</span>{x.safety.isu && <span className="spec ok">🧯 Autorizat ISU</span>}</div>
      </div>
    </article>
  )
}

const CHIPS = [['all', 'Toate'], ['storage', '📦 Depozitare'], ['event', '🎉 Evenimente'], ['work', '💻 Lucru'], ['leisure', '🌿 Relaxare']]

function Explore() {
  const s = useStore(), data = filteredListings(), nf = activeFilterCount(), layoutRef = useRef(null)
  const [instant, setInstant] = useState(false)
  /* La pornire, harta ascunsă se aplică fără animație. */
  useEffect(() => { if (s.ui.mapHiddenInstant) { setInstant(true); requestAnimationFrame(() => setInstant(false)); S.ui.mapHiddenInstant = false } }, [s.ui.mapHiddenInstant])
  useEffect(() => { const t = setTimeout(() => mapApi.invalidate(), 400); return () => clearTimeout(t) }, [s.ui.mapHidden])
  return (
    <main ref={layoutRef} className={`layout${s.ui.mapHidden ? ' map-hidden' : ''}`} style={instant ? { transition: 'none' } : undefined}
      onTransitionEnd={e => { if (e.propertyName === 'grid-template-columns') mapApi.invalidate() }}>
      <section className="left">
        <div className="toolbar">
          {CHIPS.map(([t, l]) => <button key={t} className={`chip${s.ui.filters.type === t ? ' active' : ''}`} onClick={() => setFilter({ type: t })}>{l}</button>)}
          <button className={`chip${nf ? ' active' : ''}`} id="fltBtn" onClick={() => { S.ui.fltOpen = !S.ui.fltOpen; emit() }} aria-expanded={s.ui.fltOpen} aria-controls="filters">⚙ Filtre{nf ? ` (${nf})` : ''}</button>
          <label className="sort-label" htmlFor="sortBy">Sortează</label>
          <select id="sortBy" className="sort-select" value={s.ui.filters.sort} onChange={e => setFilter({ sort: e.target.value })} aria-label="Sortează proprietățile">
            <option value="default">Relevanță</option><option value="priceAsc">Preț: mic → mare</option><option value="priceDesc">Preț: mare → mic</option>
            <option value="ratingDesc">Rating: mare → mic</option><option value="ratingAsc">Rating: mic → mare</option>
          </select>
          <span className="count">{data.length}{data.length === 1 ? ' spațiu disponibil' : ' spații disponibile'}</span>
        </div>
        {s.ui.fltOpen && <Filters />}
        <div className="cards">{data.map(x => <Card key={x.id} x={x} />)}</div>
        <div className="empty" style={{ display: data.length ? 'none' : 'block' }}>Nu am găsit spații pentru criteriile alese. Încearcă alt tip sau altă durată.</div>
      </section>
      <MapPanel data={data} />
    </main>
  )
}

function Footer() {
  const link = fn => e => { e.preventDefault(); fn() }
  return (
    <footer>
      <div className="logo">SPAȚIU<span>.</span></div>
      <a href="#" onClick={link(() => openTerms())}>Termeni și condiții</a>
      <a href="#" onClick={link(() => openMessages())}>Mesaje</a>
      <a href="#" onClick={link(openPublish)}>Publică un spațiu</a>
      <a href="#" onClick={link(openSupport)}>Ai nevoie de ajutor?</a>
      <span className="copy">© 2026 SPAȚIU</span>
    </footer>
  )
}

export default function App() {
  const s = useStore()
  useEffect(() => { loadAll() }, [])
  /* Fără scroll pe pagină cât timp e deschisă o fereastră. */
  const open = anyOpen()
  useEffect(() => { document.body.classList.toggle('noscroll', open) }, [open])
  /* Esc închide fereastra de deasupra (sau cardul de pe hartă). */
  useEffect(() => {
    const onKey = e => { if (e.key !== 'Escape') return; if (!closeTop()) mapApi.escape?.() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [])
  return <>
    <Header />
    <Hero />
    <Explore />
    <Footer />
    {/* Ordinea contează: ferestrele de mai jos stau deasupra celor de mai sus. */}
    <DetailModal />
    <PublishModal />
    <MessagesModal />
    <AccountModal />
    <AuthModal />
    <BookModal />
    <TicketModal />
    <ReviewModal />
    {/* RiskModal e randat în PublishModal, ca să aibă acces la formular. */}
    <TermsModal />
    <Toast />
  </>
}
