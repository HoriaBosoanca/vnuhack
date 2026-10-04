import { esc, fmtRanges, fmtLei, fmtDate } from './utils'

/* Biletul e HTML cu stiluri inline, ca să arate la fel în pagină, în fișierul descărcat și în e-mail. */
export function ticketHTML(b) {
  const cancelled = b.status === 'anulată'
  const row = (k, v) => `<tr><td style="padding:7px 0;color:#7a6e62;font-size:13px;vertical-align:top;width:38%">${k}</td><td style="padding:7px 0;font-size:14px;color:#2e2823;font-weight:600">${v}</td></tr>`
  return `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eadfce;border-radius:16px;overflow:hidden;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#2e2823">
 <div style="background:${cancelled ? '#7f1d1d' : '#3f6a4e'};color:#fff;padding:18px 22px"><div style="font-size:21px;font-weight:850;letter-spacing:-.5px">SPAȚIU.</div><div style="font-size:13px;opacity:.9">Bilet de rezervare și dovadă de plată</div></div>
 <table style="width:100%;border-collapse:collapse;border-bottom:2px dashed #eadfce"><tr><td style="padding:16px 22px"><div style="font-size:12px;color:#7a6e62">Cod rezervare</div><div style="font-size:26px;font-weight:850;letter-spacing:2px">${b.code}</div></td>
 <td style="padding:16px 22px;text-align:right"><span style="display:inline-block;padding:6px 12px;border-radius:999px;font-weight:800;font-size:13px;background:${cancelled ? '#fef2f2' : '#edf1de'};color:${cancelled ? '#b91c1c' : '#2c5e45'}">${cancelled ? 'ANULATĂ' : 'CONFIRMATĂ'}</span></td></tr></table>
 <div style="padding:10px 22px 14px"><table style="width:100%;border-collapse:collapse">
 ${row('Spațiu', esc(b.listingTitle))}${row('Adresă', esc(b.address))}${row('Perioada', fmtRanges(b.days))}${b.from ? row('Interval orar', `${b.from} – ${b.to}`) : ''}
 ${row('Calcul', esc(b.line))}${row(cancelled ? 'Sumă plătită' : 'Total plătit', `<span style="font-size:18px">${fmtLei(b.total)}</span>`)}
 ${row('Plată', `${b.payment.brand} •••• ${b.payment.last4}, ${esc(b.payment.holder)}`)}${row('ID tranzacție', b.payment.txn)}${row('Data plății', fmtDate(new Date(b.payment.paidAt)))}
 ${row('Rezervat de', `${esc(b.userName)}<br><span style="font-weight:500">${esc(b.ticketEmail)}</span>`)}${row('Proprietar', `${esc(b.ownerName)}<br><span style="font-weight:500">${esc(b.ownerPhone)}</span>`)}
 ${cancelled ? row('Anulată la', fmtDate(new Date(b.cancelledAt))) + (b.cancelReason ? row('Motiv', esc(b.cancelReason)) : '') + row('Rambursare', `${fmtLei(b.refund.amount)}, inițiată`) : ''}
 </table></div>
 <div style="padding:14px 22px;background:#fbf6ec;font-size:12px;color:#7a6e62;line-height:1.55">${cancelled ? 'Această rezervare a fost anulată și nu mai este valabilă.' : 'Prezintă acest bilet proprietarului la sosire. Poți anula gratuit din „Contul meu” până în prima zi a rezervării.'}<br>Document emis de SPAȚIU la ${fmtDate(new Date(b.createdAt))}. Plată procesată în regim demonstrativ.</div></div>`
}
