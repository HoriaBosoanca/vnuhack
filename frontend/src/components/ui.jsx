import { useEffect, useRef, useState } from 'react'
import { useStore, closeM } from '../lib/store'
import { colorFor, initials, fmtRt } from '../lib/utils'

export function Avatar({ name, cls = '' }) {
  return <span className={`avatar ${cls}`} style={{ background: colorFor(name) }}>{initials(name)}</span>
}

/* Câmp de formular: se marchează cu roșu și afișează mesajul când are eroare. */
export function Field({ err, full, className = '', style, children, id }) {
  return (
    <div id={id} className={`field${full ? ' full' : ''}${className ? ' ' + className : ''}${err ? ' invalid' : ''}`} style={style}>
      {children}<span className="err">{err || ''}</span>
    </div>
  )
}

/* Erorile unui formular. check({id: mesaj}) întoarce true dacă nu există erori. */
export function useErrs() {
  const [errs, setErrs] = useState({})
  const check = obj => { setErrs(e => ({ ...e, ...obj })); return Object.values(obj).every(v => !v) }
  const clear = id => setErrs(e => e[id] ? { ...e, [id]: '' } : e)
  const reset = () => setErrs({})
  return { errs, check, clear, reset, setErrs }
}

export function Modal({ name, id, boxClass = 'modalbox', boxId, boxProps, children }) {
  const s = useStore()
  return (
    <div className={`modal${s.ui.open[name] ? ' show' : ''}`} id={id} onClick={e => { if (e.target === e.currentTarget) closeM(name) }}>
      <div className={boxClass} id={boxId} {...boxProps}>{children}</div>
    </div>
  )
}

export function CloseBtn({ name, onClick, style, className = 'close', label = 'Închide', children = '×' }) {
  return <button className={className} onClick={onClick || (() => closeM(name))} aria-label={label} style={style}>{children}</button>
}

export function RatingLine({ r }) {
  return r.n
    ? <div className="rating-line"><span className="rt">★ {fmtRt(r.avg)} <span className="n">({r.n} {r.n === 1 ? 'recenzie' : 'recenzii'})</span></span></div>
    : <div className="rating-line hint">Nicio recenzie încă</div>
}

export function Stars({ n }) {
  return <span className="stars" aria-label={`${n} din 5 stele`}>{'★'.repeat(n)}<span className="off">{'★'.repeat(5 - n)}</span></span>
}

export function SafetyTags({ x }) {
  const s = x.safety
  return <>
    {s.isu ? <span className="tag ok">✓ Autorizat ISU</span> : <span className="tag warn">Fără aviz ISU declarat</span>}
    {s.extinguisher && <span className="tag ok">✓ Stingător</span>}
    {s.evacuation && <span className="tag ok">✓ Evacuare</span>}
  </>
}

/* Meniu derulant cu câte un comutator (toggle) pentru fiecare opțiune. Se închide la click în afara lui. */
export function ToggleDropdown({ label, options, isOn, onToggle, id }) {
  const [open, setOpen] = useState(false), ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [open])
  const n = options.filter(isOn).length
  return (
    <div className={`tgl-dd${open ? ' open' : ''}`} ref={ref}>
      <button type="button" id={id} className="tgl-dd-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{label}{n ? ` (${n})` : ''}</span><span className="tgl-dd-arrow" aria-hidden="true">▾</span>
      </button>
      {open && <div className="tgl-dd-menu" role="menu">
        {options.map(o => (
          <label key={o} className="tgl-row" role="menuitemcheckbox" aria-checked={isOn(o)}>
            <span>{o}</span>
            <input type="checkbox" className="tgl" checked={isOn(o)} onChange={() => onToggle(o)} />
          </label>
        ))}
      </div>}
    </div>
  )
}

/* Link „Termenii și condițiile” într-un label de checkbox. */
export function TermsLink({ onAccept, openTerms }) {
  return <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); openTerms(onAccept) }}>Termenii și condițiile</a>
}
