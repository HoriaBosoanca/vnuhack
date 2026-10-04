import { useEffect } from 'react'
import { useStore, findBooking, downloadTicket, printTicket, resendTicket } from '../lib/store'
import { fmtDate } from '../lib/utils'
import { ticketHTML } from '../lib/ticket'
import { Modal, CloseBtn } from './ui'

export default function TicketModal() {
  const s = useStore(), b = s.ui.ticketId ? findBooking(s.ui.ticketId) : null
  useEffect(() => { if (s.ui.open.ticket) document.getElementById('ticketBox').scrollTop = 0 }, [s.ui.open.ticket, s.ui.ticketId])
  const e = b?.email || {}
  return (
    <Modal name="ticket" id="ticketModal" boxId="ticketBox">
      {b && <>
        <div className="modalhead no-print"><h2>Biletul tău</h2><CloseBtn name="ticket" /></div>
        <div className="email-status no-print">
          {e.status === 'trimis' ? <>✉ Biletul a fost trimis pe e-mail la <b>{b.ticketEmail}</b> ({fmtDate(new Date(e.at))}).</>
            : e.status === 'eroare' ? <>✉ E-mailul către {b.ticketEmail} nu a putut fi trimis. Încearcă „Retrimite pe e-mail”.</>
            : <>✉ Trimiterea pe e-mail nu e configurată încă (vezi <code>EMAILJS</code> în <code>src/lib/store.js</code>). Între timp poți descărca sau printa biletul, iar confirmarea e și în Mesaje.</>}
        </div>
        {/* Biletul e HTML generat din date escapate (vezi lib/ticket.js), la fel ca în e-mail și în fișierul descărcat. */}
        <div dangerouslySetInnerHTML={{ __html: ticketHTML(b) }} />
        <div className="form-actions no-print">
          <button className="btn" onClick={() => resendTicket(b.id)}>✉ Retrimite pe e-mail</button>
          <button className="btn" onClick={() => downloadTicket(b.id)}>⬇ Descarcă biletul</button>
          <button className="btn primary" onClick={printTicket}>🖨 Printează / PDF</button>
        </div>
      </>}
    </Modal>
  )
}
