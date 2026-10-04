import { useEffect, useRef, useState } from 'react'
import { pad, todayKey, fmtDay } from '../lib/utils'

function countText(mode, days) {
  const n = [...days].filter(k => k >= todayKey()).length
  if (mode === 'book') return n ? `${n} ${n === 1 ? 'zi aleasă' : 'zile alese'}` : 'Apasă pe zilele dorite'
  return n ? `${n} ${n === 1 ? 'zi selectată' : 'zile selectate'} în total` : 'Nicio zi selectată'
}

/* Calendar de disponibilitate.
   mode: 'edit' (proprietarul marchează zilele libere), 'view' (doar citire), 'book' (chiriașul alege zilele).
   Selectare prin click sau prin „pictare” (ții apăsat și tragi peste zile; merge și pe touch). */
export default function Calendar({ mode, days, onChange, allowed = null, start }) {
  const init = start || new Date()
  const [ym, setYm] = useState({ y: init.getFullYear(), m: init.getMonth() })
  const ref = useRef(null), paint = useRef(null), daysRef = useRef(days), onChangeRef = useRef(onChange)
  daysRef.current = days; onChangeRef.current = onChange
  const editable = mode !== 'view'

  const apply = k => {
    const cur = daysRef.current; if (cur.has(k) === paint.current) return
    const n = new Set(cur); paint.current ? n.add(k) : n.delete(k); daysRef.current = n; onChangeRef.current?.(n)
  }

  useEffect(() => {
    if (!editable) return
    const move = e => {
      if (paint.current === null) return
      const b = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day')
      if (b && ref.current?.contains(b) && !b.classList.contains('past')) apply(b.dataset.k)
    }
    const up = () => { paint.current = null }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up)
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up) }
  }, [editable])

  const { y, m } = ym, now = new Date(), first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), tk = todayKey()
  const atStart = y === now.getFullYear() && m === now.getMonth(), atEnd = (y - now.getFullYear()) * 12 + m - now.getMonth() >= 12
  const nav = d => setYm(({ y, m }) => { m += d; if (m < 0) { m = 11; y-- } if (m > 11) { m = 0; y++ } return { y, m } })
  const setMonth = on => {
    const s = new Set(days)
    for (let d = 1; d <= n; d++) { const k = `${y}-${pad(m + 1)}-${pad(d)}`; if (k < tk) continue; on ? s.add(k) : s.delete(k) }
    onChange(s)
  }

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(<span key={'e' + i} />)
  for (let d = 1; d <= n; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`, blocked = !!(allowed && k >= tk && !allowed.has(k)), off = k < tk || blocked, on = days.has(k)
    cells.push(
      <button key={k} type="button" data-k={k}
        className={`day${on ? ' avail' : ''}${off ? ' past' : ''}${blocked ? ' off' : ''}${k === tk ? ' today' : ''}`}
        tabIndex={off || !editable ? -1 : undefined} aria-pressed={on}
        aria-label={`${fmtDay(k)}${on ? (mode === 'book' ? ', aleasă' : ', liber') : ''}${blocked ? ', indisponibil' : ''}`}
        onPointerDown={editable ? e => { if (off) return; e.preventDefault(); paint.current = !daysRef.current.has(k); apply(k) } : undefined}
        onClick={editable ? e => { if (e.detail !== 0 || off) return; paint.current = !daysRef.current.has(k); apply(k); paint.current = null } : undefined}
      >{d}</button>
    )
  }

  return (
    <div ref={ref} className={`cal${!editable ? ' ro' : ''}${mode === 'book' ? ' book' : ''}`}>
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => nav(-1)} disabled={atStart} aria-label="Luna anterioară">‹</button>
        <b>{first.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</b>
        <button type="button" className="cal-nav" onClick={() => nav(1)} disabled={atEnd} aria-label="Luna următoare">›</button>
      </div>
      <div className="cal-grid">
        {['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(d => <span key={d} className="cal-dow">{d}</span>)}
        {cells}
      </div>
      <div className="cal-foot">
        {mode === 'edit' ? <>
          <span className="grow cal-count">{countText(mode, days)}</span>
          <button type="button" className="btn sm" onClick={() => setMonth(true)}>Toată luna</button>
          <button type="button" className="btn sm" onClick={() => setMonth(false)}>Golește luna</button>
        </> : mode === 'book' ? <>
          <span className="grow cal-count">{countText(mode, days)}</span>
          <span className="legend"><i className="sel" />Ales</span><span className="legend"><i className="off" />Indisponibil</span>
        </> : <>
          <span className="legend"><i />Liber</span><span className="legend"><i className="off" />Ocupat / indisponibil</span>
        </>}
      </div>
    </div>
  )
}
