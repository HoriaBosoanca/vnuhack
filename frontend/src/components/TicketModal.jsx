import { useEffect } from 'react'
import { useStore, findBooking, downloadTicket, printTicket } from '../lib/store'
import { ticketHTML } from '../lib/ticket'
import { Modal, CloseBtn } from './ui'

export default function TicketModal() {
  const s = useStore(), b = s.ui.ticketId ? findBooking(s.ui.ticketId) : null
  useEffect(() => { if (s.ui.open.ticket) document.getElementById('ticketBox').scrollTop = 0 }, [s.ui.open.ticket, s.ui.ticketId])
  return (
    <Modal name="ticket" id="ticketModal" boxId="ticketBox">
      {b && <>
        <div className="modalhead no-print"><h2>Biletul tău</h2><CloseBtn name="ticket" /></div>
        {/* Biletul e HTML generat din date escapate (vezi lib/ticket.js), la fel ca în fișierul descărcat. */}
        <div dangerouslySetInnerHTML={{ __html: ticketHTML(b) }} />
        <div className="form-actions no-print">
          <button className="btn" onClick={() => downloadTicket(b.id)}>⬇ Descarcă biletul</button>
          <button className="btn primary" onClick={printTicket}>🖨 Printează / PDF</button>
        </div>
      </>}
    </Modal>
  )
}
