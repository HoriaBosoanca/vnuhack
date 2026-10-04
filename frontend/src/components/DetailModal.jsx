import { useEffect, useState } from 'react'
import {
  useStore, S, byId, isMine, nextFree, listingRating, hostRating, ownerKey, canCancel, closeM, startBooking,
  findReview, bookingStarted, openReview, openProfile,
  deleteListing, showOnMap,
} from '../lib/store'
import { SAFETY, fmtPrice, fmtDay, fmtDate, fmtRt, fullAddress, label, maskPhone, telHref, avgOf } from '../lib/utils'
import { Avatar, Modal, CloseBtn, Stars } from './ui'
import Calendar from './Calendar'
import { ContactBtn } from './MapPanel'

/* Nume / avatar pe care apeși ca să deschizi profilul utilizatorului. */
function Who({ id, name, children }) {
  if (id == null) return children
  return <button type="button" className="who" onClick={() => openProfile(id)} aria-label={name ? `Vezi profilul lui ${name}` : undefined}>{children}</button>
}

function Reviews({ x }) {
  const s = useStore()
  const rs = s.reviews.filter(r => r.type === 'listing' && r.listingId === x.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const lr = listingRating(x)
  /* Dacă am o rezervare începută la acest spațiu și n-am lăsat încă recenzie, pot scrie una de aici. */
  const eligible = s.user && s.bookingsMine.find(b => b.listingId === x.id && b.status === 'confirmată' && !findReview(b, 'listing') && bookingStarted(b))
  return (
    <div className="safety">
      <div className="safety-head"><h3>⭐ Recenzii</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lr.n > 0 && <span className="tag">{lr.n} {lr.n === 1 ? 'recenzie' : 'recenzii'}</span>}
          {eligible && <button className="btn sm primary" onClick={() => openReview(eligible.id, 'listing')}>⭐ Scrie o recenzie</button>}
        </div>
      </div>
      {rs.length ? <>
        <div className="rv-sum"><div className="rv-big">{fmtRt(lr.avg)}</div><div><Stars n={Math.round(lr.avg)} /><div className="hint">Spațiu: {fmtRt(lr.avg)} · Gazdă: {fmtRt(avgOf(rs.map(r => r.hostStars)))}</div></div></div>
        {rs.map(r => (
          <div className="rv" key={r.id}><Who id={r.authorId} name={r.authorName}><Avatar name={r.authorName} /></Who>
            <div className="rv-body">
              <div className="rv-head"><Who id={r.authorId}><b>{r.authorName}</b></Who><span className="hint">{new Date(r.createdAt).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</span></div>
              <div><Stars n={r.stars} /> <span className="hint">· gazda {r.hostStars}/5</span></div>
              {r.comment && <p>{r.comment}</p>}
            </div>
          </div>
        ))}
      </> : <p className="hint" style={{ margin: 0 }}>Spațiul nu are încă recenzii. Doar cei care l-au rezervat pot lăsa o recenzie, din „Contul meu”.</p>}
    </div>
  )
}

/* ---- Retragerea anunțului (doar pentru proprietar) ---- */
function OwnerZone({ x }) {
  const [confirming, setConfirming] = useState(false)
  const n = S.bookingsRecv.filter(b => b.listingId === x.id && canCancel(b)).length
  return (
    <div className="owner-zone">
      {confirming ? <>
        <span className="grow"><b>Sigur retragi anunțul?</b> Se șterge definitiv: nu mai apare în listă, pe hărți, în căutări sau în contul tău și nu poate fi recuperat.{n === 1 ? ' Rezervarea viitoare de la acest anunț se anulează și se rambursează.' : n ? ` Cele ${n} rezervări viitoare se anulează și se rambursează.` : ''}</span>
        <button className="btn sm" onClick={() => setConfirming(false)}>Renunță</button>
        <button className="btn sm danger solid" onClick={() => deleteListing(x.id)}>Da, șterge definitiv</button>
      </> : <>
        <span className="grow">Acesta este anunțul tău.</span>
        <button className="btn sm danger" onClick={() => setConfirming(true)}>🗑 Retrage anunțul</button>
      </>}
    </div>
  )
}

function Detail({ x }) {
  const s = useStore(), sf = x.safety, o = x.owner, imgs = x.imgs
  const [gi, setGi] = useState(0), [phone, setPhone] = useState(false)
  const go = i => setGi((i + imgs.length) % imgs.length)
  /* Săgețile stânga / dreapta schimbă poza. */
  useEffect(() => {
    const onKey = e => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && S.ui.open.detail && !S.ui.open.terms && !S.ui.open.auth && !S.ui.open.msg && imgs.length > 1)
        setGi(i => (i + (e.key === 'ArrowLeft' ? -1 : 1) + imgs.length) % imgs.length)
    }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [imgs.length])
  const fd = nextFree(x), h = hostRating(ownerKey(o)), mine = isMine(x)
  const mapsQ = encodeURIComponent(fullAddress(x).replace(' · ', ', ') + ', România')
  return <>
    <div className="modalhead"><span className="tag">{label(x.type)}</span><CloseBtn name="detail" /></div>
    <div className="d-photo" style={{ backgroundImage: `url('${imgs[gi]}')` }}>
      {imgs.length > 1 && <>
        <button className="gal-nav prev" onClick={() => go(gi - 1)} aria-label="Poza anterioară">‹</button>
        <button className="gal-nav next" onClick={() => go(gi + 1)} aria-label="Poza următoare">›</button>
        <span className="gal-count">{gi + 1} / {imgs.length}</span>
      </>}
    </div>
    {imgs.length > 1 && <div className="thumbs">{imgs.map((u, i) => <button key={i} className={`thumb${i === gi ? ' on' : ''}`} style={{ backgroundImage: `url('${u}')` }} onClick={() => go(i)} aria-label={`Poza ${i + 1}`} />)}</div>}
    <div className="d-head">
      <div><h2>{x.title}</h2>
        <div className="addr">📍 {fullAddress(x)} <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQ}`} target="_blank" rel="noopener">Deschide în Google Maps ↗</a>
          {(x.geo === 'approx' || x.geo === 'fail') && <div className="hint">Poziția pe hartă e aproximativă.</div>}</div>
      </div>
      <div className="d-book"><div className="d-price">{fmtPrice(x.price)} lei <span>/ {x.unit}</span></div>
        {!mine && !x.removed && (fd ? <button className="btn primary" onClick={() => startBooking(x.id)}>📅 Rezervă</button> : <button className="btn" disabled>Nicio dată liberă</button>)}
      </div>
    </div>
    <div className="d-grid">
      <div className="d-stat"><small>Suprafață</small>{x.area} m²</div><div className="d-stat"><small>Tarif</small>pe {x.unit}</div>
      <div className="d-stat"><small>Acces</small>{x.access}</div>
    </div>
    <p className="d-desc">{x.desc || 'Proprietarul nu a adăugat o descriere.'}</p>
    {x.rules && x.rules.length > 0 && <div className="safety"><div className="safety-head"><h3>📋 Reguli ale casei</h3></div><ul className="d-rules">{x.rules.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
    {x.contract && <div className="safety"><div className="safety-head"><h3>📄 Contract de închiriere</h3></div>
      <div className="contract-row"><span className="hint">Proprietarul a atașat modelul de contract. Citește-l înainte să închiriezi.</span><a className="btn" href={x.contract.url} download={x.contract.name}>⬇ Descarcă {x.contract.name}</a></div></div>}
    {x.removed && <div className="removed-banner">Acest anunț a fost retras și nu mai apare pe site.</div>}
    <Reviews x={x} />
    <div className="safety">
      <div className="safety-head"><h3>📅 Disponibilitate</h3>{fd ? <span className="tag ok">Liber din {fmtDay(fd)}</span> : <span className="tag warn">Nicio zi liberă</span>}</div>
      <Calendar mode="view" days={x.avail} start={fd ? new Date(fd + 'T00:00') : new Date()} />
    </div>
    <div className="safety">
      <div className="safety-head"><h3>🧯 Siguranță la incendiu</h3>{sf.isu ? <span className="tag ok">Autorizat ISU</span> : <span className="tag warn">Fără autorizație ISU declarată</span>}</div>
      <div className="safety-list">{SAFETY.map(([k, t]) => <div key={k} className={`s-item${sf[k] ? ' ok' : ''}`}>{sf[k] ? '✓' : '✕'} {t}{sf[k] ? '' : ' — nedeclarat'}</div>)}</div>
      {sf.isu && sf.isuNo && <p className="hint" style={{ margin: '10px 0 0' }}>Nr. autorizație ISU: <b>{sf.isuNo}</b></p>}
      <p className="note">ℹ️ Informații declarate de proprietar pe propria răspundere. SPAȚIU nu verifică documentele, așa că cere autorizația ISU înainte să închiriezi, mai ales pentru evenimente cu invitați.</p>
    </div>
    <div className="owner-card"><Who id={o.id} name={o.name}><Avatar name={o.name} /></Who>
      <div><Who id={o.id}><b>{o.name}</b></Who><div className="hint">Proprietar, membru din {o.since}</div>
        {h.n ? <div className="rt" style={{ marginTop: 3 }}>★ {fmtRt(h.avg)} <span className="n">ca gazdă ({h.n} {h.n === 1 ? 'recenzie' : 'recenzii'})</span></div> : <div className="hint">Încă fără recenzii ca gazdă</div>}
      </div>
      <div className="owner-actions" hidden={!!x.removed}>
        {phone ? <a className="btn" href={telHref(o.phone)}>📞 {o.phone}</a> : <button className="btn" onClick={() => setPhone(true)}>📞 {maskPhone(o.phone)} · Arată numărul</button>}
        <ContactBtn x={x} cls="btn primary" />
      </div>
    </div>
    <div className="declared">📝 Proprietarul a declarat pe propria răspundere că informațiile sunt reale și și-a asumat riscurile și consecințele legale ale închirierii{x.declaration ? `, la ${fmtDate(x.declaration.at)} (Termeni v${x.declaration.termsVersion})` : ''}.</div>
    {mine && <OwnerZone x={x} />}
    <div className="form-actions">{!x.removed && <button className="btn" onClick={() => showOnMap(x.id)}>🗺️ Vezi pe hartă</button>}</div>
  </>
}

export default function DetailModal() {
  const s = useStore(), x = s.ui.detailId !== null ? byId(s.ui.detailId) : null
  useEffect(() => { if (s.ui.open.detail) { const b = document.getElementById('detailBox'); if (b) b.scrollTop = 0 } }, [s.ui.detailNonce])
  return (
    <Modal name="detail" id="detailModal" boxId="detailBox">
      {x && <Detail key={s.ui.detailNonce} x={x} />}
    </Modal>
  )
}
