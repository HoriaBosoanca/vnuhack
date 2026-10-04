import { useEffect, useRef, useState } from 'react'
import { useStore, S, emit, closeM, openTerms, goToFirstInvalid, login, register, toast } from '../lib/store'
import { validEmail, validPhone } from '../lib/utils'
import { Field, Modal, useErrs } from './ui'

export default function AuthModal() {
  const s = useStore(), reg = s.ui.authTab === 'reg', open = s.ui.open.auth
  const [r, setR] = useState({ name: '', email: '', phone: '', pass: '', terms: false, news: false })
  const [l, setL] = useState({ email: '', pass: '' })
  const { errs, check, clear } = useErrs()
  const nameRef = useRef(null), lEmailRef = useRef(null)

  useEffect(() => { if (open) setTimeout(() => (reg ? nameRef : lEmailRef).current?.focus(), 50) }, [open, reg])
  const tab = t => { S.ui.authTab = t; emit() }
  const setRF = (k, id) => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setR(o => ({ ...o, [k]: v })); if (v) clear(id) }
  const setLF = (k, id) => e => { setL(o => ({ ...o, [k]: e.target.value })); if (e.target.value) clear(id) }

  async function doLogin() {
    const email = l.email.trim().toLowerCase(), pass = l.pass
    if (!check({ lEmail: email ? '' : 'Scrie adresa de e-mail.', lPass: pass ? '' : 'Scrie parola.' })) return goToFirstInvalid('authModal')
    const err = await login(email, pass)
    if (err?.status === 401) { check({ lPass: err.message }); return goToFirstInvalid('authModal') }
    if (err) return toast(err.message)
    setL(o => ({ ...o, pass: '' }))
  }
  async function doRegister() {
    const name = r.name.trim(), email = r.email.trim().toLowerCase(), phone = r.phone.trim(), pass = r.pass
    const ok = check({
      aName: name.length >= 3 ? '' : 'Introdu numele complet.',
      aEmail: !validEmail(email) ? 'Adresa de e-mail nu e validă.' : '',
      aPhone: !phone || validPhone(phone) ? '' : 'Număr invalid. Exemplu: 0722 123 456.',
      aPass: pass.length >= 8 ? '' : 'Parola trebuie să aibă minim 8 caractere.',
      aTerms: r.terms ? '' : 'Trebuie să accepți Termenii și condițiile ca să-ți creezi cont.',
    })
    if (!ok) return goToFirstInvalid('authModal')
    const err = await register({ name, email, phone, password: pass, terms: r.terms, newsletter: r.news })
    if (err?.status === 409) { check({ aEmail: err.message }); return goToFirstInvalid('authModal') }
    if (err) return toast(err.message)
    setR(o => ({ ...o, pass: '' }))
  }

  return (
    <Modal name="auth" id="authModal" boxClass="modalbox narrow">
      <div className="modalhead"><div><h2>{reg ? 'Creează cont' : 'Conectează-te'}</h2><div className="hint">{s.ui.authReason}</div></div><button className="close" onClick={() => closeM('auth')} aria-label="Închide">×</button></div>
      <div className="tabs" role="tablist">
        <button className={`tab${reg ? ' active' : ''}`} onClick={() => tab('reg')}>Cont nou</button>
        <button className={`tab${!reg ? ' active' : ''}`} onClick={() => tab('login')}>Am deja cont</button>
      </div>
      {reg ? <div>
        <div className="formgrid one">
          <Field err={errs.aName}><label htmlFor="aName">Nume complet *</label><input id="aName" ref={nameRef} autoComplete="name" placeholder="ex. Ana Popescu" value={r.name} onChange={setRF('name', 'aName')} /></Field>
          <Field err={errs.aEmail}><label htmlFor="aEmail">E-mail *</label><input id="aEmail" type="email" autoComplete="email" placeholder="nume@exemplu.ro" value={r.email} onChange={setRF('email', 'aEmail')} /></Field>
          <Field err={errs.aPhone}><label htmlFor="aPhone">Telefon</label><input id="aPhone" type="tel" autoComplete="tel" placeholder="ex. 0722 123 456" value={r.phone} onChange={setRF('phone', 'aPhone')} /><span className="hint">Opțional. Îl precompletăm în anunțurile tale.</span></Field>
          <Field err={errs.aPass}><label htmlFor="aPass">Parolă *</label><input id="aPass" type="password" autoComplete="new-password" placeholder="minim 8 caractere" value={r.pass} onChange={setRF('pass', 'aPass')} /></Field>
          <Field err={errs.aTerms}><label className="check"><input type="checkbox" checked={r.terms} onChange={setRF('terms', 'aTerms')} /><span>Am citit și accept <a href="#" onClick={e => { e.preventDefault(); openTerms(() => { setR(o => ({ ...o, terms: true })); clear('aTerms') }) }}>Termenii și condițiile</a> SPAȚIU. *<small>Fără acceptarea termenilor nu poți crea un cont.</small></span></label></Field>
          <label className="check"><input type="checkbox" checked={r.news} onChange={setRF('news')} /><span>Vreau să primesc noutăți pe e-mail<small>Opțional, te poți dezabona oricând.</small></span></label>
        </div>
        <div className="form-actions"><button className="btn" onClick={() => closeM('auth')}>Anulează</button><button className="btn primary" onClick={doRegister}>Creează cont</button></div>
      </div> : <div>
        <div className="formgrid one">
          <Field err={errs.lEmail}><label htmlFor="lEmail">E-mail</label><input id="lEmail" ref={lEmailRef} type="email" autoComplete="email" placeholder="nume@exemplu.ro" value={l.email} onChange={setLF('email', 'lEmail')} /></Field>
          <Field err={errs.lPass}><label htmlFor="lPass">Parolă</label><input id="lPass" type="password" autoComplete="current-password" value={l.pass} onChange={setLF('pass', 'lPass')} onKeyDown={e => { if (e.key === 'Enter') doLogin() }} /></Field>
        </div>
        <div className="form-actions"><button className="btn" onClick={() => closeM('auth')}>Anulează</button><button className="btn primary" onClick={doLogin}>Conectează-te</button></div>
      </div>}
    </Modal>
  )
}
