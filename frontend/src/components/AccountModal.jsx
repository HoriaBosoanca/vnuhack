import { useState } from 'react'
import {
  useStore, S, byId, isMine, hostRating, guestRating, myBookings, recvBookings, canCancel, findReview, bookingStarted,
  closeM, openDetail, openMessages, openPublish, openTerms, openTicket, openReview, cancelBooking, logout,
} from '../lib/store'
import { fmtDate, fmtDayY, fmtLei, fmtPrice, fmtRanges, fmtRt, thumb, todayKey } from '../lib/utils'
import { Avatar, Modal, CloseBtn, Stars } from './ui'

function StatusTag({ b }) {
  if (b.status === 'anulată') return <span className="tag warn">Anulată</span>
  return [...b.days].sort().pop() < todayKey() ? <span className="tag">Încheiată</span> : <span className="tag ok">Confirmată</span>
}

function ReviewBtn({ b, type }) {
  if (b.status !== 'confirmată') return null
  const r = findReview(b, type)
  if (r) return <span className="hint">{type === 'listing' ? 'Recenzia ta' : 'Ai evaluat clientul'}: <Stars n={r.stars} /></span>
  if (!bookingStarted(b)) return <span className="hint">{type === 'listing' ? 'Poți lăsa o recenzie' : 'Poți evalua clientul'} din {fmtDayY([...b.days].sort()[0])}.</span>
  if (type === 'listing' && !byId(b.listingId)) return null
  return <button className="btn sm primary" onClick={() => openReview(b.id, type)}>⭐ {type === 'listing' ? 'Lasă o recenzie' : 'Evaluează clientul'}</button>
}

function BookingItem({ b }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="bk-item">
      <i style={{ backgroundImage: `url('${thumb((byId(b.listingId) || b).img || '')}')` }} />
      <div className="grow"><b>{b.listingTitle}</b><div className="hint">{fmtRanges(b.days)}{b.from ? `, ${b.from}–${b.to}` : ''}<br />{fmtLei(b.total)}, cod {b.code}</div></div>
      <StatusTag b={b} />
      <div className="bk-actions">
        {confirming ? <>
          <span className="hint"><b>Sigur anulezi?</b> Primești înapoi {fmtLei(b.total)}.</span>
          <button className="btn sm" onClick={() => setConfirming(false)}>Renunță</button>
          <button className="btn sm danger solid" onClick={() => { setConfirming(false); cancelBooking(b.id) }}>Da, anulează</button>
        </> : <>
          <button className="btn sm" onClick={() => openTicket(b.id)}>🎫 Vezi biletul</button>
          {canCancel(b) && <button className="btn sm danger" onClick={() => setConfirming(true)}>Anulează rezervarea</button>}
          <ReviewBtn b={b} type="listing" />
        </>}
      </div>
    </div>
  )
}

function RecvItem({ b }) {
  const g = guestRating(b.userId)
  return (
    <div className="bk-item">
      <div className="grow"><b>{b.listingTitle}</b>
        <div className="hint">{b.userName} {g.n ? <span className="rt">★ {fmtRt(g.avg)} <span className="n">({g.n})</span></span> : <span className="hint">(client nou)</span>}<br />
          {fmtRanges(b.days)}{b.from ? `, ${b.from}–${b.to}` : ''} · {fmtLei(b.total)}</div></div>
      <StatusTag b={b} />
      <div className="bk-actions"><ReviewBtn b={b} type="guest" /></div>
    </div>
  )
}

export default function AccountModal() {
  const s = useStore(), u = s.user
  if (!u) return <Modal name="account" id="accountModal" boxClass="modalbox narrow" />
  const mine = s.listings.filter(isMine), mb = myBookings(), rb = recvBookings()
  const h = hostRating('u' + u.id), g = guestRating(u.id)
  const go = fn => () => { closeM('account'); fn() }
  return (
    <Modal name="account" id="accountModal" boxClass="modalbox narrow">
      <div className="modalhead"><h2>Contul meu</h2><CloseBtn name="account" /></div>
      <div className="profile"><Avatar name={u.name} cls="lg" />
        <div><h3>{u.name}</h3><div className="hint">{u.email}{u.phone ? ', ' + u.phone : ''}</div>
          <div className="rt-row"><span className="tag">{h.n ? `★ ${fmtRt(h.avg)} ca gazdă (${h.n})` : 'Ca gazdă: fără recenzii'}</span><span className="tag">{g.n ? `★ ${fmtRt(g.avg)} ca client (${g.n})` : 'Ca client: fără recenzii'}</span></div>
        </div>
      </div>
      <div className="acc-box">✓ Ai acceptat <a href="#" onClick={e => { e.preventDefault(); openTerms() }}>Termenii și condițiile</a> (v{u.termsVersion}) la {fmtDate(u.termsAcceptedAt)}.</div>
      <h4 style={{ margin: '18px 0 4px' }}>Rezervările mele ({mb.length})</h4>
      {mb.length ? mb.map(b => <BookingItem key={b.id} b={b} />) : <p className="hint">Nu ai făcut încă nicio rezervare. Deschide un anunț și apasă „Rezervă”.</p>}
      {rb.length > 0 && <><h4 style={{ margin: '18px 0 4px' }}>Rezervări la anunțurile mele ({rb.length})</h4>{rb.map(b => <RecvItem key={b.id} b={b} />)}</>}
      <h4 style={{ margin: '18px 0 4px' }}>Anunțurile mele ({mine.length})</h4>
      {mine.length > 0 && <p className="hint" style={{ margin: 0 }}>Deschide un anunț ca să-l retragi.</p>}
      {mine.length ? mine.map(x => (
        <div key={x.id} className="mini" onClick={go(() => openDetail(x.id))}><i style={{ backgroundImage: `url('${thumb(x.img)}')` }} />
          <div><b>{x.title}</b><div className="hint">{fmtPrice(x.price)} lei / {x.unit}, publicat la {fmtDate(x.declaration.at)}</div></div><span className="tag ok">Activ</span></div>
      )) : <p className="hint">Nu ai publicat încă niciun anunț.</p>}
      <div className="form-actions">
        <button className="btn" onClick={logout}>Deconectează-te</button>
        <button className="btn" onClick={go(() => openMessages())}>💬 Mesaje</button>
        <button className="btn primary" onClick={go(openPublish)}>＋ Publică un spațiu</button>
      </div>
    </Modal>
  )
}
