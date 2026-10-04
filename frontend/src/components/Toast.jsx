import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'

export default function Toast() {
  const t = useStore().ui.toast, [show, setShow] = useState(false)
  useEffect(() => {
    if (!t.n) return
    setShow(true); const h = setTimeout(() => setShow(false), 3400); return () => clearTimeout(h)
  }, [t.n])
  return <div className={`toast${show ? ' show' : ''}`} role="status">{t.msg}</div>
}
