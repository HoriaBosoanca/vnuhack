import { useEffect, useState } from 'react'
import { useStore, S, byId, closeM, openTerms, goToFirstInvalid, toast, createBooking } from '../lib/store'
import {
  HOURS, HOURS_END, pad, toMin, todayKey, hoursBetween, fmtHours, fmtLei, fmtPrice, fmtRanges, fullAddress, accessWindow,
  luhn, cardBrand, expOk, fmtCard, fmtExp, validEmail,
} from '../lib/utils'
import { Field, Modal, CloseBtn, useErrs } from './ui'
import Calendar from './Calendar'

function calc(x, daysSet, from, to) {
  const days = [...daysSet].filter(k => k >= todayKey()).sort(); let qty = 0, line = '', hours = 0
  if (x.unit === 'zi') { qty = days.length; line = `${qty} ${qty === 1 ? 'zi' : 'zile'} × ${fmtLei(x.price)}` }
  else if (x.unit === 'lună') { qty = days.length ? Math.ceil(days.length / 30) : 0; line = `${qty} ${qty === 1 ? 'lună' : 'luni'} × ${fmtLei(x.price)} (${days.length} zile; se plătește fiecare lună începută)` }
  else { hours = hoursBetween(from, to); qty = hours * days.length; line = `${days.length} ${days.length === 1 ? 'zi' : 'zile'} × ${fmtHours(hours)} h × ${fmtLei(x.price)}` }
  return { x, days, qty, hours, line, total: Math.round(qty * x.price * 100) / 100, from: x.unit === 'oră' ? from : null, to: x.unit === 'oră' ? to : null }
}

function Summary({ c }) {
  return <>
    <div className="row"><span>Perioada</span><b style={{ textAlign: 'right' }}>{c.days.length ? fmtRanges(c.days) : 'Alege zilele în calendar'}</b></div>
    {c.from && <div className="row"><span>Interval orar</span><b>{c.from} – {c.to}</b></div>}
    <div className="row"><span>Calcul</span><span style={{ textAlign: 'right' }}>{c.days.length ? c.line : '–'}</span></div>
    <div className="row total"><span>Total</span><span>{fmtLei(c.total)}</span></div>
    <div className="hint" style={{ marginTop: 4 }}>Anulare gratuită din „Contul meu” până în prima zi a rezervării, cu rambursare integrală.</div>
  </>
}

function Booking({ x }) {
  const tk = todayKey(), allowed = new Set([...x.avail].filter(k => k >= tk)), first = [...allowed].sort()[0]
  const w = accessWindow(x), start = w ? pad(Math.floor(w[0] / 60) % 24) + ':' + pad(w[0] % 60) : '10:00'
  const [days, setDays] = useState(() => new Set()), [calKey, setCalKey] = useState(0)
  const [from, setFrom] = useState(start), [to, setTo] = useState(pad((toMin(start) / 60 + 2) % 24) + ':' + start.slice(3))
  const [step, setStep] = useState(1), [paying, setPaying] = useState(false)
  const [p, setP] = useState({ name: '', card: '', exp: '', cvc: '', email: '', agree: false })
  const { errs, check, clear } = useErrs()
  const c = calc(x, days, from, to), hourly = x.unit === 'oră'
  const setPF = (k, id, fmt) => e => { const v = e.target.type === 'checkbox' ? e.target.checked : fmt ? fmt(e.target.value) : e.target.value; setP(o => ({ ...o, [k]: v })); if (v) clear(id) }
  useEffect(() => { if (step === 2) document.getElementById('bookBox').scrollTop = 0 }, [step])

  function next() {
    let hourErr = ''
    if (hourly) {
      if (c.from === c.to) hourErr = 'Ora de început și cea de sfârșit nu pot fi identice.'
      else if (w) { let a = toMin(c.from), b = a + c.hours * 60; if (a < w[0]) { a += 1440; b += 1440 } if (a < w[0] || b > w[1]) hourErr = `Alege un interval în programul de acces: ${x.access}.` }
    }
    if (!check({ bookCal: c.days.length ? '' : 'Alege cel puțin o zi din calendar.', bFrom: hourErr })) return goToFirstInvalid('bookModal')
    setP(o => ({ ...o, name: o.name || S.user.name, email: o.email || S.user.email })); setStep(2)
  }
  async function pay() {
    const num = p.card.replace(/\s/g, ''), email = p.email.trim()
    const ok = check({
      pName: p.name.trim().length >= 3 ? '' : 'Scrie numele de pe card.',
      pCard: !num ? 'Scrie numărul cardului.' : num.length < 13 || !luhn(num) ? 'Numărul cardului nu e valid.' : '',
      pExp: expOk(p.exp) ? '' : 'Data de expirare nu e validă (LL/AA, în viitor).',
      pCvc: /^\d{3,4}$/.test(p.cvc) ? '' : 'CVC-ul are 3 sau 4 cifre.',
      pEmail: validEmail(email) ? '' : 'Adresa de e-mail nu e validă.',
      pAgree: p.agree ? '' : 'Bifează ca să poți plăti.',
    })
    if (!ok) return goToFirstInvalid('bookModal')
    if (c.days.some(k => !x.avail.has(k))) { setStep(1); setDays(new Set()); setCalKey(k => k + 1); return toast('Unele zile tocmai au fost rezervate. Alege din nou.') }
    setPaying(true)
    // DEMO: plata e simulată. Numărul cardului nu pleacă din browser; serverul primește doar tipul, ultimele 4 cifre și titularul.
    const err = await createBooking({
      listingId: x.id, days: c.days, hourFrom: c.from, hourTo: c.to, ticketEmail: email,
      payment: { brand: cardBrand(num), last4: num.slice(-4), holder: p.name.trim() },
    })
    if (!err) return
    setPaying(false); toast(err.message)
    if (err.status === 409) { setStep(1); setDays(new Set()); setCalKey(k => k + 1) }
  }

  return <>
    <div className="modalhead"><div><h2>Rezervă</h2><div className="hint">{x.title}, {fmtPrice(x.price)} lei / {x.unit}</div></div><CloseBtn name="book" /></div>
    <div className="steps"><span className={step === 1 ? 'on' : ''}>1. Alege datele</span><span className={step === 2 ? 'on' : ''}>2. Plătește</span></div>
    <section hidden={step !== 1}>
      <Field err={errs.bookCal} style={{ marginTop: 12 }}><label>Zilele dorite *</label>
        <Calendar key={calKey} mode="book" days={days} allowed={allowed} start={first ? new Date(first + 'T00:00') : new Date()} onChange={d => { setDays(d); clear('bookCal') }} /></Field>
      {hourly && <Field err={errs.bFrom} style={{ marginTop: 12 }}><label htmlFor="bFrom">Interval orar *</label>
        <div className="time-row"><span className="hint">De la</span><select id="bFrom" value={from} onChange={e => { setFrom(e.target.value); clear('bFrom') }}>{HOURS.map(h => <option key={h}>{h}</option>)}</select>
          <span className="hint">până la</span><select value={to} onChange={e => { setTo(e.target.value); clear('bFrom') }} aria-label="Până la ora">{HOURS_END.map(h => <option key={h}>{h}</option>)}</select></div>
        <span className="hint">{w ? `Programul de acces al spațiului: ${x.access}. Format 24 de ore.` : 'Format 24 de ore.'}</span></Field>}
      <div className="summary"><Summary c={c} /></div>
      <div className="form-actions"><button className="btn" onClick={() => closeM('book')}>Anulează</button><button className="btn primary" onClick={next}>Continuă spre plată</button></div>
    </section>
    <section hidden={step !== 2}>
      <div className="summary">
        <div className="row"><span>Spațiu</span><b style={{ textAlign: 'right' }}>{x.title}</b></div>
        <div className="row"><span>Adresă</span><span style={{ textAlign: 'right' }}>{fullAddress(x)}</span></div>
        <Summary c={c} />
      </div>
      <div className="demo-note">🔒 Plată simulată (demo): nu se debitează niciun card. Poți folosi cardul de test 4242 4242 4242 4242, orice dată de expirare viitoare și orice CVC.</div>
      <div className="formgrid">
        <Field full err={errs.pName}><label htmlFor="pName">Numele de pe card *</label><input id="pName" autoComplete="cc-name" value={p.name} onChange={setPF('name', 'pName')} /></Field>
        <Field full err={errs.pCard}><label htmlFor="pCard">Număr card *</label><input id="pCard" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" maxLength={23} value={p.card} onChange={setPF('card', 'pCard', fmtCard)} /></Field>
        <Field err={errs.pExp}><label htmlFor="pExp">Expiră (LL/AA) *</label><input id="pExp" inputMode="numeric" autoComplete="cc-exp" placeholder="12/28" maxLength={5} value={p.exp} onChange={setPF('exp', 'pExp', fmtExp)} /></Field>
        <Field err={errs.pCvc}><label htmlFor="pCvc">CVC *</label><input id="pCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={p.cvc} onChange={setPF('cvc', 'pCvc')} /></Field>
        <Field full err={errs.pEmail}><label htmlFor="pEmail">Trimite biletul la adresa *</label><input id="pEmail" type="email" autoComplete="email" value={p.email} onChange={setPF('email', 'pEmail')} /></Field>
        <Field full err={errs.pAgree}><label className="check"><input type="checkbox" checked={p.agree} onChange={setPF('agree', 'pAgree')} /><span>Am citit regulile casei și accept <a href="#" onClick={e => { e.preventDefault(); openTerms(() => { setP(o => ({ ...o, agree: true })); clear('pAgree') }) }}>Termenii și condițiile</a>, inclusiv politica de anulare. *</span></label></Field>
      </div>
      <div className="form-actions"><button className="btn" onClick={() => setStep(1)}>‹ Înapoi</button><button className="btn primary" disabled={paying} onClick={pay}>{paying ? 'Se procesează plata…' : `Plătește ${fmtLei(c.total)}`}</button></div>
    </section>
  </>
}

export default function BookModal() {
  const s = useStore(), b = s.ui.book, x = b ? byId(b.id) : null
  return <Modal name="book" id="bookModal" boxId="bookBox">{x && s.ui.open.book && <Booking key={b.nonce} x={x} />}</Modal>
}
