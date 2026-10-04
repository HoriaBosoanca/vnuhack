import { useEffect } from 'react'
import { useStore, closeM, openDetail, messageProfile, hostRating, guestRating, byId } from '../lib/store'
import { fmtPrice, fmtRt, thumb } from '../lib/utils'
import { Avatar, Modal, Stars } from './ui'

const byDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)

function Review({ r, host }) {
  const x = host ? byId(r.listingId) : null
  return (
    <div className="rv"><div className="rv-body">
      <div className="rv-head"><b>{r.authorName}</b><span className="hint">{new Date(r.createdAt).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</span></div>
      <div><Stars n={host ? r.hostStars : r.stars} />{x && <span className="hint"> · {x.title}</span>}</div>
      {r.comment && <p>{r.comment}</p>}
    </div></div>
  )
}

/* Profilul public: spațiile publicate, recenziile ca gazdă și ca client, buton de mesaj. */
export default function ProfileModal() {
  const s = useStore(), p = s.ui.profile
  useEffect(() => { if (s.ui.open.profile) { const b = document.getElementById('profileBox'); if (b) b.scrollTop = 0 } }, [s.ui.open.profile, p?.id])
  if (!p) return <Modal name="profile" id="profileModal" boxId="profileBox" />
  const key = 'u' + p.id, isMe = s.user?.id === p.id
  const mine = s.listings.filter(x => x.owner.id === p.id)
  const h = hostRating(key), g = guestRating(p.id)
  const asHost = s.reviews.filter(r => r.type === 'listing' && r.ownerKey === key).sort(byDate)
  const asGuest = s.reviews.filter(r => r.type === 'guest' && r.guestId === p.id).sort(byDate)
  const name = p.name || '…'
  return (
    <Modal name="profile" id="profileModal" boxId="profileBox">
      <div className="modalhead" style={{ justifyContent: 'flex-end' }}><button className="close" onClick={() => closeM('profile')} aria-label="Închide">×</button></div>
      <div className="pf-head"><Avatar name={name} cls="lg" />
        <div><h2>{name}</h2><div className="hint">{mine.length ? 'Proprietar' : 'Membru'}{p.since ? `, pe SPAȚIU din ${p.since}` : ''}</div>
          <div className="rt-row" style={{ marginTop: 6 }}>
            <span className="tag">{h.n ? `★ ${fmtRt(h.avg)} ca gazdă (${h.n})` : 'Ca gazdă: fără recenzii'}</span>
            <span className="tag">{g.n ? `★ ${fmtRt(g.avg)} ca client (${g.n})` : 'Ca client: fără recenzii'}</span>
          </div>
        </div>
        <div className="pf-actions">{isMe ? <span className="hint">Acesta este profilul tău</span> : <button className="btn primary" onClick={() => messageProfile(p.id)}>💬 Trimite mesaj</button>}</div>
      </div>
      {mine.length > 0 && <div className="pf-sec"><h3>Spații publicate ({mine.length})</h3>
        <div className="pf-list">{mine.map(x => (
          <div key={x.id} className="pf-card" onClick={() => { closeM('profile'); openDetail(x.id) }}><i style={{ backgroundImage: `url('${thumb(x.img)}')` }} /><div><b>{x.title}</b>{fmtPrice(x.price)} lei / {x.unit}</div></div>
        ))}</div></div>}
      {asHost.length > 0 && <div className="pf-sec"><h3>Recenzii ca gazdă</h3>{asHost.map(r => <Review key={r.id} r={r} host />)}</div>}
      {asGuest.length > 0 && <div className="pf-sec"><h3>Recenzii ca client</h3>{asGuest.map(r => <Review key={r.id} r={r} />)}</div>}
      {!p.loading && !mine.length && !asHost.length && !asGuest.length && <p className="hint" style={{ marginTop: 18 }}>Acest utilizator nu are încă spații sau recenzii publice.</p>}
    </Modal>
  )
}
