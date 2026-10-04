import { useState } from 'react'
import { useStore, S, byId, ownerKey, findReview, closeM, goToFirstInvalid, addReview } from '../lib/store'
import { fmtRanges, shortName } from '../lib/utils'
import { Field, Modal, CloseBtn, useErrs } from './ui'

function StarField({ id, label, value, onChange, err }) {
  return (
    <Field err={err} style={{ marginTop: 14 }}><label>{label} *</label>
      <div className="stars-in" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" className={n <= value ? 'on' : ''} aria-checked={n === value} aria-label={`${n} din 5`} onClick={() => onChange(n)}>★</button>)}
      </div>
    </Field>
  )
}

function Review({ b, type }) {
  const [stars, setStars] = useState(0), [host, setHost] = useState(0), [text, setText] = useState('')
  const { errs, check, clear } = useErrs()
  function submit() {
    const ok = check({ rvStars: stars ? '' : 'Alege de la 1 la 5 stele.', rvHost: type === 'listing' && !host ? 'Alege de la 1 la 5 stele.' : '' })
    if (!ok) return goToFirstInvalid('reviewModal')
    if (findReview(b, type)) return closeM('review')
    const x = byId(b.listingId), u = S.user
    addReview(type === 'listing'
      ? { id: 'r' + Date.now(), type, bookingId: b.id, listingId: b.listingId, ownerKey: x ? ownerKey(x.owner) : null, authorName: shortName(u.name), authorEmail: u.email, stars, hostStars: host, comment: text.trim(), createdAt: new Date() }
      : { id: 'r' + Date.now(), type, bookingId: b.id, listingId: b.listingId, guestEmail: b.userEmail, guestName: b.userName, authorName: shortName(u.name), authorEmail: u.email, stars, comment: text.trim(), createdAt: new Date() })
  }
  return <>
    <div className="modalhead"><div><h2>{type === 'listing' ? 'Lasă o recenzie' : 'Evaluează clientul'}</h2>
      <div className="hint">{b.listingTitle}, {fmtRanges(b.days)}{type === 'guest' && <><br />Client: {b.userName}</>}</div></div><CloseBtn name="review" /></div>
    {type === 'listing' ? <>
      <StarField label="Cum a fost spațiul?" value={stars} onChange={n => { setStars(n); clear('rvStars') }} err={errs.rvStars} />
      <StarField label={`Cum a fost gazda (${b.ownerName})?`} value={host} onChange={n => { setHost(n); clear('rvHost') }} err={errs.rvHost} />
    </> : <StarField label="Cum a fost clientul? (punctualitate, comunicare, cum a lăsat spațiul)" value={stars} onChange={n => { setStars(n); clear('rvStars') }} err={errs.rvStars} />}
    <div className="field" style={{ marginTop: 14 }}><label htmlFor="rvText">Comentariu <span className="hint">· opțional, apare public</span></label>
      <textarea id="rvText" rows="4" maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder={type === 'listing' ? 'Ce ți-a plăcut? Ce ar putea fi mai bine?' : 'Cum a decurs colaborarea cu clientul?'} /></div>
    <div className="form-actions"><button className="btn" onClick={() => closeM('review')}>Anulează</button><button className="btn primary" onClick={submit}>Trimite recenzia</button></div>
  </>
}

export default function ReviewModal() {
  const s = useStore(), r = s.ui.review, b = r ? s.bookings.find(z => z.id === r.bookingId) : null
  return <Modal name="review" id="reviewModal" boxClass="modalbox narrow" boxId="reviewBox">{b && <Review key={r.nonce} b={b} type={r.type} />}</Modal>
}
