import { useLayoutEffect, useRef } from 'react'
import { useStore, byId, conv, lastTime, closeM, selectConv, backToList, setDraft, sendMsg, openDetail } from '../lib/store'
import { fmtTime, fmtPrice, thumb } from '../lib/utils'
import { Avatar, Modal } from './ui'

const autoGrow = t => { if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px' }

export default function MessagesModal() {
  const s = useStore(), c = conv(s.ui.activeConv), x = c && c.listingId ? byId(c.listingId) : null
  const threadRef = useRef(null), taRef = useRef(null)
  const list = [...s.conversations].sort((a, b) => lastTime(b) - lastTime(a))

  useLayoutEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight })
  useLayoutEffect(() => { autoGrow(taRef.current) }, [s.ui.msgDraft])
  useLayoutEffect(() => { if (s.ui.open.msg && c && innerWidth > 720) taRef.current?.focus() }, [s.ui.msgNonce, s.ui.open.msg])

  return (
    <Modal name="msg" id="msgModal" boxClass={`modalbox chatbox${s.ui.inThread ? ' in-thread' : ''}`} boxId="chatbox">
      <aside className="chat-side">
        <div className="chat-side-head"><h2>Mesaje</h2><button className="close" onClick={() => closeM('msg')} aria-label="Închide">×</button></div>
        <div className="conv-list">
          {list.length ? list.map(cv => {
            const lx = cv.listingId ? byId(cv.listingId) : null, last = cv.messages[cv.messages.length - 1]
            return (
              <div key={cv.id} className={`conv${cv.id === s.ui.activeConv ? ' active' : ''}${cv.unread ? ' unread' : ''}`} onClick={() => selectConv(cv.id)}>
                <Avatar name={cv.with} />
                <div className="conv-mid">
                  <div className="conv-name"><span>{cv.with}</span><time>{fmtTime(lastTime(cv))}</time></div>
                  {lx && <div className="conv-sub">{lx.title}</div>}
                  <div className="conv-last">{cv.typing ? <em>scrie…</em> : last ? (last.from === 'me' ? 'Tu: ' : '') + last.text : 'Conversație nouă'}</div>
                </div>
                {cv.unread > 0 && <span className="dot" />}
              </div>
            )
          }) : <p className="hint" style={{ padding: 18 }}>Nicio conversație încă. Deschide un anunț și apasă „Mesaj”.</p>}
        </div>
      </aside>
      <section className="chat-main">
        {c && <div className="chat-head">
          <button className="close m-only" onClick={backToList} aria-label="Înapoi">‹</button>
          <Avatar name={c.with} />
          <div style={{ minWidth: 0 }}><b>{c.with}</b><div className="hint">{x ? 'Proprietar' : c.listingId ? 'Anunț retras' : 'Suport'}</div></div>
          {x && <div className="chat-listing" onClick={() => { closeM('msg'); openDetail(x.id) }}><i style={{ backgroundImage: `url('${thumb(x.img)}')` }} /><span><b>{x.title}</b><br />{fmtPrice(x.price)} lei / {x.unit}</span></div>}
          <button className="close m-only" onClick={() => closeM('msg')} aria-label="Închide" style={x ? undefined : { marginLeft: 'auto' }}>×</button>
        </div>}
        <div className="thread" ref={threadRef}>
          {c ? <>
            {x && <div className="chat-hint">Nu trimite bani în avans înainte să vezi spațiul și documentele lui. Ține discuția aici, pe platformă.</div>}
            {c.messages.map((m, i) => <div key={i} className={`bubble ${m.from}`}>{m.text}<div className="bubble-meta"><time>{fmtTime(m.t)}</time></div></div>)}
            {c.typing && <div className="typing">{c.with.split(' ')[0]} scrie…</div>}
          </> : <div className="chat-empty"><div><div style={{ fontSize: 34 }}>💬</div><b>Mesajele tale</b><p>Alege o conversație din stânga sau contactează un proprietar din pagina unui anunț.</p></div></div>}
        </div>
        {c && <div className="composer">
          <textarea ref={taRef} rows="1" placeholder="Scrie un mesaj…" value={s.ui.msgDraft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMsg() } }} />
          <button className="btn primary" onClick={sendMsg}>Trimite</button>
        </div>}
      </section>
    </Modal>
  )
}
