/* ================== CONSTANTE & UTILITARE ================== */
export const TERMS_VERSION = '1.0'

/* Județele României + coordonatele aproximative ale reședinței (pentru pin pe hartă). */
export const COUNTIES = {'Alba':[46.07,23.58],'Arad':[46.18,21.31],'Argeș':[44.86,24.87],'Bacău':[46.57,26.91],'Bihor':[47.07,21.92],'Bistrița-Năsăud':[47.13,24.5],'Botoșani':[47.75,26.67],'Brăila':[45.27,27.96],'Brașov':[45.65,25.6],'București':[44.43,26.1],'Buzău':[45.15,26.82],'Călărași':[44.2,27.33],'Caraș-Severin':[45.3,21.89],'Cluj':[46.77,23.59],'Constanța':[44.18,28.63],'Covasna':[45.87,25.79],'Dâmbovița':[44.93,25.46],'Dolj':[44.32,23.8],'Galați':[45.44,28.05],'Giurgiu':[43.9,25.97],'Gorj':[45.04,23.27],'Harghita':[46.36,25.8],'Hunedoara':[45.88,22.9],'Ialomița':[44.56,27.37],'Iași':[47.16,27.59],'Ilfov':[44.55,26.1],'Maramureș':[47.66,23.58],'Mehedinți':[44.63,22.66],'Mureș':[46.54,24.56],'Neamț':[46.93,26.37],'Olt':[44.43,24.36],'Prahova':[44.94,26.02],'Sălaj':[47.19,23.06],'Satu Mare':[47.79,22.89],'Sibiu':[45.79,24.15],'Suceava':[47.65,26.26],'Teleorman':[43.97,25.33],'Timiș':[45.75,21.23],'Tulcea':[45.18,28.8],'Vâlcea':[45.1,24.37],'Vaslui':[46.64,27.73],'Vrancea':[45.7,27.18]}
export const COUNTY_NAMES = Object.keys(COUNTIES).sort((a, b) => a.localeCompare(b, 'ro'))

export const SAFETY = [['isu', 'Autorizație ISU'], ['extinguisher', 'Stingător de incendiu'], ['evacuation', 'Căi de evacuare'], ['smoke', 'Detector de fum']]
export const SAFETY_PHRASE = { extinguisher: 'stingător', evacuation: 'căi de evacuare semnalizate', smoke: 'detector de fum' }
export const RULE_PRESETS = ['🚭 Fumatul interzis', '🐾 Fără animale de companie', '🔇 Liniște după ora 22:00', '🧹 Spațiul se predă curat', '🚗 Parcare doar în locul indicat']

/* ---- Date calendaristice ---- */
export const pad = n => String(n).padStart(2, '0')
export const dKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => dKey(new Date())
export const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }
export const fmtDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }) }
export const fmtDayY = k => new Date(k + 'T00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
export function fmtRanges(keys) {
  const ks = [...keys].sort(); if (!ks.length) return '–'; const out = []; let s = ks[0], p = ks[0]
  const next = k => dKey(addDays(new Date(k + 'T00:00'), 1))
  for (let i = 1; i <= ks.length; i++) { const k = ks[i]; if (k && k === next(p)) { p = k; continue } out.push(s === p ? fmtDayY(s) : `${fmtDayY(s)} – ${fmtDayY(p)}`); s = p = k }
  return out.join(', ')
}

/* ---- Ore ---- */
export const HOURS = []; for (let h = 0; h < 24; h++) for (const m of ['00', '30']) HOURS.push(pad(h) + ':' + m)
export const HOURS_END = [...HOURS.slice(1), '24:00']
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export function hoursBetween(a, b) { let d = toMin(b) - toMin(a); if (d <= 0) d += 1440; return d / 60 }
export const fmtHours = h => h.toLocaleString('ro-RO', { maximumFractionDigits: 1 })
/* Intervalul de acces al anunțului, în minute (ex. „10:00–01:00” → [600, 1500]); null = fără restricție. */
export function accessWindow(x) { const m = /^(\d\d:\d\d)–(\d\d:\d\d)$/.exec(x.access || ''); if (!m) return null; let a = toMin(m[1]), b = toMin(m[2]); if (b <= a) b += 1440; return [a, b] }

/* ---- Formatare ---- */
export const fmtPrice = n => Number(n).toLocaleString('ro-RO')
export const fmtTime = d => new Date(d).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
export const fmtDate = d => new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const fmtLei = n => Number(n).toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' lei'
export const fmtRt = v => v.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fmtSize = b => b < 1024 * 1024 ? Math.round(b / 1024) + ' KB' : (b / 1024 / 1024).toLocaleString('ro-RO', { maximumFractionDigits: 1 }) + ' MB'
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const initials = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
export const shortName = n => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] }
export function colorFor(s) { const p = ['#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626']; let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return p[h % p.length] }
export const thumb = u => u && u.includes('images.unsplash.com') ? u.replace('w=800', 'w=200') : u
export const fullAddress = x => x.address ? `${x.address}, ${x.location}` : x.location
export const validPhone = p => /^(\+40|0040|0)[237]\d{8}$/.test(p.replace(/[\s.\-()]/g, ''))
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
export const telHref = p => 'tel:' + p.replace(/[^\d+]/g, '')
export const maskPhone = p => { const d = p.replace(/\s/g, ''); return d.slice(0, 4) + ' ••• •••' }
export const label = t => ({ storage: '📦 Depozitare', event: '🎉 Evenimente', work: '💻 Lucru', leisure: '🌿 Relaxare' }[t])
export const locText = (city, county) => county === 'București' ? `${city}, București` : `${city}, jud. ${county}`
export const ruleKey = r => String(r).replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase()
export const noiseLevel = x => /fără/i.test(x.noise || '') ? 999 : +((x.noise || '').match(/\d+/) || [0])[0]
export const avgOf = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
export const sleep = ms => new Promise(r => setTimeout(r, ms))
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/* ---- Card ---- */
export function luhn(n) { let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9 } s += d; alt = !alt } return s % 10 === 0 }
export const cardBrand = n => /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : 'Card'
export function expOk(v) { const m = /^(\d\d)\/(\d\d)$/.exec(v); if (!m) return false; const mm = +m[1], yy = 2000 + +m[2]; if (mm < 1 || mm > 12) return false; const now = new Date(); return yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1) }
export const fmtCard = v => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
export const fmtExp = v => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d }
export const bookingCode = () => 'SP-' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

/* ---- Parole: hash SHA-256 cu „sare”. Fiind totul în browser, e o protecție de demo, nu securitate reală. ---- */
export const newSalt = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('')
export async function hashPass(pass, salt) {
  const data = new TextEncoder().encode(salt + ':' + pass)
  if (window.crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') }
  let h = 0; for (const b of data) h = (h * 31 + b) >>> 0; return 'x' + h.toString(16)
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
}

/* Comprimă pozele mari înainte de salvare. */
export async function shrinkImage(f, max = 1600) {
  try {
    const bmp = await createImageBitmap(f); const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); if (k === 1 && f.size < 1.5e6) return f
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise(r => c.toBlob(b => r(b || f), 'image/jpeg', .85))
  } catch (e) { return f }
}
