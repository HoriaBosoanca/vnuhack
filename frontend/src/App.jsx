import { useEffect, useRef, useState } from 'react'
import {
  useStore, S, loadAll, filteredListings, setFilter, resetFilters, activeFilterCount, openDetail,
  openPublish, openMessages, openAccount, openTerms, openHelp, openSupport, listingRating, mapApi, anyOpen, closeTop, closeM,
  unreadCount, emit,
} from './lib/store'
import { COUNTY_NAMES, HOURS, HOURS_END, RULE_PRESETS, fmtPrice, label, ruleKey } from './lib/utils'
import MapPanel from './components/MapPanel'
import { Avatar, RatingLine, Modal, ToggleDropdown } from './components/ui'
import Calendar from './components/Calendar'
import ProfileModal from './components/ProfileModal'
import { Categories, MapPromo, MenuOverlay, setMenu, scrollToEl } from './components/Landing'
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
  const goTop = () => scrollTo({ top: 0, behavior: s.ui.animOn ? 'smooth' : 'auto' })
  const search = () => { scrollToEl('.hero'); setTimeout(() => document.getElementById('search')?.focus({ preventScroll: true }), s.ui.animOn ? 650 : 50) }
  return (
    <header>
      <button className="menu-btn" type="button" aria-expanded={s.ui.menuOpen} aria-controls="menuOv" aria-label="Deschide meniul" onClick={() => setMenu(true)}>
        <span className="burger" aria-hidden="true"><i /><i /></span><span className="menu-lbl">Meniu</span>
      </button>
      <div className="logo" role="link" tabIndex={0} aria-label="SPAȚIU, înapoi sus" onClick={goTop} onKeyDown={e => { if (e.key === 'Enter') goTop() }}>SPAȚIU<span>.</span></div>
      <div className="header-actions">
        <button className="btn ic-btn" type="button" aria-label="Caută un spațiu" onClick={search}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
        <button className="btn" data-pub="" onClick={openPublish} aria-label="Publică un spațiu">＋<span className="lbl">Publică un spațiu</span></button>
        <button className="btn" onClick={() => openMessages()} aria-label="Mesaje">💬<span className="lbl">Mesaje</span>{n > 0 && <span className="msg-count">{n}</span>}</button>
        <button className="btn primary" id="accBtn" onClick={openAccount} aria-label="Contul meu">{s.user ? <Avatar name={s.user.name} cls="xs" /> : '👤'}<span>Cont</span></button>
      </div>
    </header>
  )
}

function Hero() {
  const s = useStore(), f = s.ui.filters, nf = activeFilterCount()
  return (
    <section className={`hero${s.ui.fltOpen ? ' flt-open' : ''}`}><div className="hero-in"><div className="hero-main">
      <h1>Găsește spațiul pentru ceea ce ai nevoie.</h1>
      <div className="search">
        <input id="search" value={f.q} onChange={e => setFilter({ q: e.target.value })} placeholder="Ex. garaj pentru depozitare, casă pentru petrecere..." />
        <button className="btn primary" onClick={() => document.querySelector('.layout').scrollIntoView({ behavior: 'smooth' })}>Caută</button>
      </div>
      <div className="hero-filters">
        <button className={`chip${nf ? ' active' : ''}`} id="fltBtn" onClick={() => { S.ui.fltOpen = !S.ui.fltOpen; emit() }} aria-expanded={s.ui.fltOpen} aria-controls="filters">⚙ Filtre{nf ? ` (${nf})` : ''}</button>
      </div>
      {s.ui.fltOpen && <Filters />}
    </div></div></section>
  )
}

function Filters() {
  const s = useStore(), f = s.ui.filters
  const toggleRule = o => { const k = ruleKey(o); setFilter({ rules: f.rules.includes(k) ? f.rules.filter(r => r !== k) : [...f.rules, k] }) }
  return (
    <div className="filters" id="filters">
      <div className="fgrid">
        <div className="field"><label htmlFor="type">Tip spațiu</label>
          <select id="type" value={f.type} onChange={e => setFilter({ type: e.target.value })}>
            <option value="all">Orice tip</option><option value="event">Evenimente</option><option value="storage">Depozitare</option><option value="work">Lucru</option><option value="leisure">Timp liber</option>
          </select></div>
        <div className="field"><label htmlFor="fltCounty">Județ</label>
          <select id="fltCounty" value={f.county} onChange={e => setFilter({ county: e.target.value })}><option value="">Toate județele</option>{COUNTY_NAMES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="fltMin">Preț (lei / unitate)</label>
          <div className="time-row"><input id="fltMin" type="number" min="0" placeholder="min" value={f.min} onChange={e => setFilter({ min: e.target.value })} /><span>–</span><input id="fltMax" type="number" min="0" placeholder="max" value={f.max} onChange={e => setFilter({ max: e.target.value })} aria-label="Preț maxim" /></div></div>
        <div className="field"><label htmlFor="fltAccess">Interval de acces</label>
          <select id="fltAccess" value={f.access} onChange={e => setFilter({ access: e.target.value })}><option value="any">Oricare</option><option value="24/7">Doar non-stop (24/7)</option><option value="range">Să fie deschis între…</option></select>
          {f.access === 'range' && <div className="time-row" style={{ marginTop: 6 }}>
            <select value={f.from} onChange={e => setFilter({ from: e.target.value })} aria-label="De la ora">{HOURS.map(h => <option key={h}>{h}</option>)}</select><span>–</span>
            <select value={f.to} onChange={e => setFilter({ to: e.target.value })} aria-label="Până la ora">{HOURS_END.map(h => <option key={h}>{h}</option>)}</select>
          </div>}
        </div>
        <div className="field full cal-field"><label>Disponibilitate <span className="hint">· alege zilele sau perioadele dorite (click sau trage peste zile); vezi doar spațiile libere în toate zilele alese</span></label>
          <Calendar mode="edit" days={f.days} onChange={d => setFilter({ days: d })} /></div>
        <div className="field full"><label htmlFor="fltRules">Reguli ale casei <span className="hint">· activează ce îți trebuie; vezi doar spațiile care le au pe toate</span></label>
          <ToggleDropdown id="fltRules" label="Alege opțiunile" options={RULE_PRESETS} isOn={o => f.rules.includes(ruleKey(o))} onToggle={toggleRule} /></div>
      </div>
      <div className="form-actions" style={{ marginTop: 12 }}><button className="btn sm" onClick={resetFilters}>Resetează filtrele</button></div>
    </div>
  )
}

function Card({ x }) {
  useStore()
  return (
    <article className="card" onClick={() => openDetail(x.id)} onMouseEnter={() => mapApi.hoverPin(x.id, true)} onMouseLeave={() => mapApi.hoverPin(x.id, false)}>
      <div className="photo" style={{ backgroundImage: `url('${x.img}')` }}>
        <span className="badge">{label(x.type)}</span>
        {x.imgs.length > 1 && <span className="pcount">📷 {x.imgs.length}</span>}
      </div>
      <div className="card-body">
        <h3>{x.title}</h3><div className="location">📍 {x.location}</div>
        <div className="price">{fmtPrice(x.price)} lei <span>/ {x.unit}</span></div>
        <RatingLine r={listingRating(x)} />
        <div className="specs"><span className="spec">{x.area} m²</span><span className="spec">🔑 {x.access}</span>{x.safety.isu && <span className="spec ok">🧯 Autorizat ISU</span>}</div>
      </div>
    </article>
  )
}

/* Cardurile apar cu o animație când intră în ecran (ca în HTML); fără animație dacă utilizatorul a cerut „reduce motion”. */
const REDUCE_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches
let cardIO = null
function revealCards() {
  if (REDUCE_MOTION || !window.IntersectionObserver) return
  cardIO = cardIO || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); cardIO.unobserve(e.target) } }), { threshold: .08, rootMargin: '0px 0px -40px 0px' })
  document.querySelectorAll('.cards .card:not(.cv)').forEach((c, i) => { c.classList.add('cv'); c.style.setProperty('--d', (i % 4) * .08 + 's'); cardIO.observe(c) })
}

function Explore() {
  const s = useStore(), data = filteredListings(), layoutRef = useRef(null)
  useEffect(revealCards)
  const [instant, setInstant] = useState(false)
  /* La pornire, harta ascunsă se aplică fără animație. */
  useEffect(() => { if (s.ui.mapHiddenInstant) { setInstant(true); requestAnimationFrame(() => setInstant(false)); S.ui.mapHiddenInstant = false } }, [s.ui.mapHiddenInstant])
  useEffect(() => { const t = setTimeout(() => mapApi.invalidate(), 400); return () => clearTimeout(t) }, [s.ui.mapHidden])
  return (
    <main ref={layoutRef} className={`layout${s.ui.mapHidden ? ' map-hidden' : ''}`} style={instant ? { transition: 'none' } : undefined}
      onTransitionEnd={e => { if (e.propertyName === 'grid-template-columns') mapApi.invalidate() }}>
      <section className="left">
        <div className="toolbar">
          <label className="sort-label" htmlFor="sortBy">Sortează</label>
          <select id="sortBy" className="sort-select" value={s.ui.filters.sort} onChange={e => setFilter({ sort: e.target.value })} aria-label="Sortează proprietățile">
            <option value="random">Aleatoriu</option><option value="default">Recente</option><option value="priceAsc">Preț: mic → mare</option><option value="priceDesc">Preț: mare → mic</option>
            <option value="ratingDesc">Rating: mare → mic</option><option value="ratingAsc">Rating: mic → mare</option>
          </select>
          <span className="count">{data.length}{data.length === 1 ? ' spațiu disponibil' : ' spații disponibile'}</span>
        </div>
        <div className="cards">{data.map(x => <Card key={x.id} x={x} />)}</div>
        <div className="empty" style={{ display: data.length ? 'none' : 'block' }}>Nu am găsit spații pentru criteriile alese. Încearcă alt tip sau altă durată.</div>
      </section>
      <MapPanel data={data} />
    </main>
  )
}

/* „Ai nevoie de ajutor?” → pop-up „Nu ezita să ne contactezi” → conversația cu echipa SPAȚIU. */
function HelpModal() {
  return (
    <Modal name="help" id="helpModal" boxClass="modalbox narrow" boxProps={{ style: { textAlign: 'center' } }}>
      <div className="modalhead" style={{ justifyContent: 'flex-end' }}><button className="close" onClick={() => closeM('help')} aria-label="Închide">×</button></div>
      <div style={{ fontSize: 38, marginTop: -6 }}>💬</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 600, margin: '8px 0 6px' }}>Nu ezita să ne contactezi</h2>
      <p className="hint" style={{ fontSize: 14, margin: '0 0 18px' }}>Echipa SPAȚIU te ajută cu orice întrebare sau problemă. Te ducem direct în conversația cu noi.</p>
      <div className="form-actions" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => closeM('help')}>Mai târziu</button>
        <button className="btn primary" onClick={() => { closeM('help'); openSupport() }}>Scrie echipei SPAȚIU</button>
      </div>
    </Modal>
  )
}

/* Animații la scroll (ca în HTML): secțiunile apar treptat, fundalul din hero are parallax, header-ul primește umbră. */
function useScrollEffects() {
  useEffect(() => {
    if (REDUCE_MOTION || !window.IntersectionObserver) return
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: .1 })
    const add = (sel, fade) => document.querySelectorAll(sel).forEach((el, i) => { el.classList.add('sr'); if (fade) el.classList.add('fade'); el.style.setProperty('--d', (i * .1) + 's'); io.observe(el) })
    add('.lb-col'); add('.hero h1,.hero .search,.hero-filters'); add('.toolbar'); add('.mapcol', true); add('footer')
    const hero = document.querySelector('.hero'), hd = document.querySelector('header'); let tick = false
    const upd = () => {
      tick = false; const y = Math.max(0, scrollY - (hero ? hero.offsetTop - 72 : 0)); hd && hd.classList.toggle('scrolled', scrollY > 8)
      if (hero && y < hero.offsetHeight + 200) { hero.style.setProperty('--py', (y * .3).toFixed(1) + 'px'); hero.style.setProperty('--ho', Math.max(0, 1 - y / (hero.offsetHeight * .9)).toFixed(2)) }
    }
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(upd) } }
    addEventListener('scroll', onScroll, { passive: true }); upd()
    return () => { removeEventListener('scroll', onScroll); io.disconnect() }
  }, [])
}

function Footer() {
  const link = fn => e => { e.preventDefault(); fn() }
  return (
    <footer>
      <div className="logo">SPAȚIU<span>.</span></div>
      <a href="#" onClick={link(() => openTerms())}>Termeni și condiții</a>
      <a href="#" onClick={link(openHelp)}>Ai nevoie de ajutor?</a>
      <a href="#" onClick={link(() => openMessages())}>Mesaje</a>
      <a href="#" onClick={link(openPublish)}>Publică un spațiu</a>
      <span className="copy">© 2026 SPAȚIU</span>
    </footer>
  )
}

export default function App() {
  const s = useStore()
  useEffect(() => { loadAll() }, [])
  useScrollEffects()
  useEffect(() => { document.body.classList.toggle('no-anim', !s.ui.animOn) }, [s.ui.animOn])
  /* Fără scroll pe pagină cât timp e deschisă o fereastră. */
  const open = anyOpen()
  useEffect(() => { document.body.classList.toggle('noscroll', open) }, [open])
  /* Esc închide fereastra de deasupra (sau cardul de pe hartă). */
  useEffect(() => {
    const onKey = e => { if (e.key !== 'Escape') return; if (S.ui.menuOpen) return setMenu(false); if (!closeTop()) mapApi.escape?.() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [])
  return <>
    <Header />
    <MenuOverlay />
    <MapPromo />
    <Categories />
    <Hero />
    <Explore />
    <Footer />
    {/* Ordinea contează: ferestrele de mai jos stau deasupra celor de mai sus. */}
    <HelpModal />
    <DetailModal />
    <PublishModal />
    <ProfileModal />
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
