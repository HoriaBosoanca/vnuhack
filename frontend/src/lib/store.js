import { useSyncExternalStore } from 'react'
import { api, absUrl, hasToken, setToken } from './api'
import { ticketHTML } from './ticket'
import { avgOf, todayKey, label, ruleKey, accessWindow, toMin, downloadBlob, normalizeText } from './utils'

/* ================== STARE GLOBALĂ ==================
   Un singur „store” mutabil; componentele se abonează cu useStore() și se re-randează la emit().
   Datele (anunțuri, conturi, rezervări, recenzii, mesaje) vin de la backend-ul Python. */
export const MODALS = ['help', 'detail', 'publish', 'profile', 'msg', 'account', 'auth', 'book', 'ticket', 'review', 'risk', 'terms'] // ordinea = ordinea de suprapunere

/* Ordine aleatorie, stabilă cât timp pagina e deschisă (nu se amestecă la fiecare re-randare). */
const RANK = new Map()
export const randRank = x => { if (!RANK.has(x.id)) RANK.set(x.id, Math.random()); return RANK.get(x.id) }
export const byRandom = (a, b) => randRank(a) - randRank(b)
export const defaultFilters = () => ({ q: '', type: 'all', county: '', unit: '', min: '', max: '', access: 'any', from: '18:00', to: '23:00', days: new Set(), rules: [], sort: 'random' })

/* Preferințe locale (doar în acest browser): favorite și harta ascunsă. */
const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} },
}

export const S = {
  listings: [], reviews: [], bookingsMine: [], bookingsRecv: [],
  user: null, conversations: [], loaded: false,
  ui: {
    open: Object.fromEntries(MODALS.map(m => [m, false])),
    detailId: null, detailNonce: 0, profile: null, ticketId: null, review: null, book: null,
    authReason: '', authTab: 'reg', pending: null, termsAccept: null,
    activeConv: null, inThread: false, msgDraft: '', msgNonce: 0,
    filters: defaultFilters(), fltOpen: false, mapHidden: !!local.get('spatiu-ui', {}).mapHidden, mapHiddenInstant: !!local.get('spatiu-ui', {}).mapHidden,
    toast: { msg: '', n: 0 },
    menuOpen: false,
    /* Animațiile landing-ului: pornite implicit, oprite dacă utilizatorul le-a oprit sau cere „reduce motion”. */
    animOn: (() => { try { if (localStorage.getItem('spatiu_anim') === 'off') return false } catch (e) {} return !(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) })(),
  },
}

let version = 0
const subs = new Set()
export function emit() { version++; subs.forEach(f => f()) }
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
export function useStore() { useSyncExternalStore(subscribe, () => version); return S }

/* Legătura cu harta (setată de componenta MapPanel). */
export const mapApi = { focusListing() {}, hoverPin() {}, closeMapCard() {}, isVisible() { return false }, invalidate() {} }

/* ================== UTILITARE PE DATE ================== */
export const byId = id => S.listings.find(x => x.id === id)
export const isMine = x => !!(S.user && x.owner.id != null && x.owner.id === S.user.id)
export const nextFree = x => { const tk = todayKey(); return [...x.avail].filter(k => k >= tk).sort()[0] }
export const ownerKey = o => 'u' + o.id
export function listingRating(x) { const rs = S.reviews.filter(r => r.type === 'listing' && r.listingId === x.id); return { n: rs.length, avg: avgOf(rs.map(r => r.stars)) } }
export function hostRating(key) { const rs = S.reviews.filter(r => r.type === 'listing' && r.ownerKey === key); return { n: rs.length, avg: avgOf(rs.map(r => r.hostStars)) } }
export function guestRating(userId) { const rs = S.reviews.filter(r => r.type === 'guest' && r.guestId === userId); return { n: rs.length, avg: avgOf(rs.map(r => r.stars)) } }
export const bookingStarted = b => [...b.days].sort()[0] <= todayKey()
export const findReview = (b, type) => S.reviews.find(r => r.bookingId === b.id && r.type === type)
export const myBookings = () => S.bookingsMine
export const recvBookings = () => S.bookingsRecv
export const findBooking = id => S.bookingsMine.find(b => b.id === id) || S.bookingsRecv.find(b => b.id === id)
export const canCancel = b => b.status === 'confirmată' && [...b.days].sort()[0] >= todayKey()
export const conv = id => S.conversations.find(c => c.id === id)
export const lastTime = c => new Date(c.messages.length ? c.messages[c.messages.length - 1].t : c.created)
export const unreadCount = () => S.conversations.reduce((s, c) => s + c.unread, 0)

/* Datele de la server → forma folosită de componente. */
/* Poză implicită, după tip, pentru anunțurile fără poze. */
const DEFAULT_IMAGES = {
  event: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=85',
  storage: 'https://images.unsplash.com/photo-1586528116493-da8b7c3d6b2d?auto=format&fit=crop&w=1000&q=85',
  work: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85',
  leisure: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85',
}
function normListing(x) {
  x.imgs = x.imgs.map(absUrl); if (!x.imgs.length) x.imgs = [DEFAULT_IMAGES[x.type] || DEFAULT_IMAGES.event]
  x.img = x.imgs[0]; x.avail = new Set(x.avail)
  if (x.contract) x.contract.url = absUrl(x.contract.url)
  return x
}
const normBooking = b => ({ ...b, img: absUrl(b.img) })

/* ================== TOAST & FERESTRE ================== */
export function toast(msg) { S.ui.toast = { msg, n: S.ui.toast.n + 1 }; emit() }
const fail = e => toast(e.message)
export function openM(name) { S.ui.open[name] = true; emit() }
export function closeM(name) {
  S.ui.open[name] = false
  if (name === 'auth') S.ui.pending = null
  if (name === 'terms') S.ui.termsAccept = null
  emit()
}
export const anyOpen = () => MODALS.some(m => S.ui.open[m])
export function closeTop() { const top = [...MODALS].reverse().find(m => S.ui.open[m]); if (top) { closeM(top); return true } return false }

/* Validare: duce la primul câmp marcat cu roșu din fereastră, îl scutură și pune focus pe el. */
export function goToFirstInvalid(modalId) {
  setTimeout(() => {
    const bad = [...document.querySelectorAll(`#${modalId} .field.invalid`)]; if (!bad.length) return
    const f = bad[0]; f.scrollIntoView({ block: 'center', behavior: 'smooth' })
    f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash')
    setTimeout(() => f.querySelector('input:not([type=file]):not([type=checkbox]),select,textarea,input[type=checkbox],.day:not(.past),label.add-photo,.stars-in button')?.focus({ preventScroll: true }), 350)
    toast(bad.length === 1 ? 'Completează câmpul marcat cu roșu.' : `Completează cele ${bad.length} câmpuri marcate cu roșu.`)
  }, 0)
}

/* ================== ÎNCĂRCARE ================== */
export async function loadAll() {
  try {
    const [listings, reviews] = await Promise.all([api('/api/anunturi'), api('/api/recenzii')])
    S.listings = listings.map(normListing); S.reviews = reviews
  } catch (e) { toast(e.message) }
  if (hasToken()) {
    try { S.user = await api('/api/auth/me'); await loadUserData() }
    catch (e) { if (e.status === 401) setToken(null); else toast(e.message) }
  }
  S.loaded = true; emit()
  /* Mesajele noi: la fiecare 3 s cât timp e deschisă fereastra de mesaje, altfel la fiecare 9 s. */
  let tick = 0
  setInterval(() => { tick++; if (S.ui.open.msg || tick % 3 === 0) pollConversations() }, 3000)
}

async function loadUserData() {
  const [b, convs] = await Promise.all([api('/api/rezervari'), api('/api/conversatii')])
  S.bookingsMine = b.mine.map(normBooking); S.bookingsRecv = b.received.map(normBooking)
  S.conversations = convs; S.ui.activeConv = null
}
async function refreshBookings() { const b = await api('/api/rezervari'); S.bookingsMine = b.mine.map(normBooking); S.bookingsRecv = b.received.map(normBooking); emit() }
async function refreshListings() { S.listings = (await api('/api/anunturi')).map(normListing); emit() }

/* Mesajele noi se verifică periodic (fără WebSocket, ca să rămână simplu); vezi loadAll. */
let polling = false, sending = 0
async function pollConversations() {
  if (!S.user || polling || sending || document.visibilityState === 'hidden') return
  let fresh
  polling = true
  try { fresh = await api('/api/conversatii') } catch (e) { return } finally { polling = false }
  if (!S.user || sending) return
  for (const c of fresh) {
    const old = conv(c.id), viewing = S.ui.open.msg && S.ui.activeConv === c.id && (innerWidth > 720 || S.ui.inThread)
    if (c.unread && viewing) { c.unread = 0; api(`/api/conversatii/${c.id}/citit`, { method: 'POST' }).catch(() => {}) }
    else if (c.unread > (old?.unread || 0)) toast(`💬 Mesaj nou de la ${c.with}`)
  }
  S.conversations = fresh; emit()
}

/* ================== CONT ================== */
export function requireAuth(fn, reason) {
  if (S.user) return fn()
  S.ui.pending = fn; S.ui.authReason = reason || ''; S.ui.authTab = 'reg'; openM('auth')
}
async function afterAuth(res) {
  setToken(res.token); S.user = res.user
  try { await loadUserData() } catch (e) { toast(e.message) }
  const next = S.ui.pending; S.ui.pending = null; S.ui.open.auth = false; emit(); if (next) next()
}
/* Întorc null dacă a mers, altfel eroarea (cu .status și .message). */
export async function login(email, password) {
  try { const res = await api('/api/auth/login', { method: 'POST', body: { email, password } }); toast(`Bine ai revenit, ${res.user.name.split(' ')[0]}!`); await afterAuth(res); return null }
  catch (e) { return e }
}
export async function register(data) {
  try { const res = await api('/api/auth/register', { method: 'POST', body: data }); toast(`Cont creat. Ai acceptat Termenii și condițiile v${res.user.termsVersion}.`); await afterAuth(res); return null }
  catch (e) { return e }
}
export function logout() {
  api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  setToken(null); S.user = null; S.conversations = []; S.bookingsMine = []; S.bookingsRecv = []; S.ui.activeConv = null; S.ui.open.account = false
  emit(); toast('Te-ai deconectat.')
}
export function openAccount() {
  if (!S.user) return requireAuth(() => {}, 'Cu un cont poți publica anunțuri și trimite mesaje.')
  openM('account'); refreshBookings().catch(() => {})
}
export function openPublish() { requireAuth(() => openM('publish'), 'Ca să publici un anunț ai nevoie de un cont.') }
export function openTerms(onAccept) { S.ui.termsAccept = onAccept || null; openM('terms') }

/* ================== LISTĂ & FILTRE ================== */
export function setFilter(patch) { Object.assign(S.ui.filters, patch); emit() }
export function resetFilters() { S.ui.filters = defaultFilters(); emit() }

function passFilters(x, f) {
  if (f.county && x.county !== f.county) return false
  /* Prețul se filtrează doar în cadrul unui tip de plată (lei/oră, lei/zi sau lei/lună), altfel nu se pot compara. */
  if (f.unit && x.unit !== f.unit) return false
  if (f.unit && f.min !== '' && x.price < +f.min) return false
  if (f.unit && f.max !== '' && x.price > +f.max) return false
  if (f.access === '24/7' && x.access !== '24/7') return false
  if (f.access === 'range' && x.access !== '24/7') { const w = accessWindow(x); if (!w) return false; let a = toMin(f.from), b = toMin(f.to); if (b <= a) b += 1440; if (a < w[0]) { a += 1440; b += 1440 } if (a < w[0] || b > w[1]) return false }
  /* Disponibilitate: spațiul trebuie să fie liber în toate zilele alese (cele din trecut se ignoră). */
  if (f.days.size) { const tk = todayKey(); for (const k of f.days) if (k >= tk && !x.avail.has(k)) return false }
  /* Opțiunile casei activate în filtre (ex. „Fumatul permis”): spațiul trebuie să le aibă pe toate. */
  const keys = (x.rules || []).map(ruleKey); for (const k of f.rules) if (!keys.includes(k)) return false
  return true
}
export function filteredListings() {
  const f = S.ui.filters, q = normalizeText(f.q)
  const data = S.listings.filter(x => (f.type === 'all' || x.type === f.type)
    && (!q || normalizeText([x.title, x.location, x.address, x.desc, x.type, label(x.type)].join(' ')).includes(q))
    && passFilters(x, f))
  /* Sortare: anunțurile fără recenzii contează ca rating 0; la egalitate, după numărul de recenzii, apoi după preț. */
  const rt = x => { const r = listingRating(x); return r.n ? r.avg : 0 }, nr = x => listingRating(x).n
  if (f.sort === 'random') data.sort(byRandom)
  else if (f.sort === 'priceAsc') data.sort((a, b) => a.price - b.price)
  else if (f.sort === 'priceDesc') data.sort((a, b) => b.price - a.price)
  else if (f.sort === 'ratingDesc') data.sort((a, b) => rt(b) - rt(a) || nr(b) - nr(a) || a.price - b.price)
  else if (f.sort === 'ratingAsc') data.sort((a, b) => rt(a) - rt(b) || nr(a) - nr(b) || a.price - b.price)
  return data
}
export function activeFilterCount() { const f = S.ui.filters; return [f.type !== 'all', f.county, f.unit, f.unit && (f.min || f.max), f.access !== 'any'].filter(Boolean).length + f.rules.length + (f.days.size ? 1 : 0) }

/* ================== ANUNȚURI ================== */
export function openDetail(id) {
  if (!byId(id)) return
  S.ui.detailId = id; S.ui.detailNonce++; S.ui.open.detail = true; emit()
  if (mapApi.isVisible(id)) mapApi.focusListing(id)
}
export function showOnMap(id) {
  closeM('detail')
  if (S.ui.mapHidden) { setMapHidden(false); return setTimeout(() => showOnMap(id), 450) }
  if (!mapApi.isVisible(id)) resetFilters()
  setTimeout(() => mapApi.focusListing(id, true), 0)
}
export function setMapHidden(h) { S.ui.mapHidden = h; S.ui.mapHiddenInstant = false; if (h) mapApi.closeMapCard(); local.set('spatiu-ui', { mapHidden: h }); emit() }

/* Trimite anunțul la server. Întoarce true dacă a fost publicat. */
export async function publishListing(payload) {
  try {
    const x = normListing(await api('/api/anunturi', { method: 'POST', body: payload }))
    S.listings.unshift(x); S.ui.open.publish = false; resetFilters()
    setTimeout(() => mapApi.focusListing(x.id, true), 0)
    toast('Anunțul a fost publicat.')
    return true
  } catch (e) { fail(e); return false }
}
/* Retragerea șterge anunțul complet. Rezervările viitoare se anulează și se rambursează (pe server). */
export async function deleteListing(id) {
  const x = byId(id); if (!x || !isMine(x)) return
  try {
    const { cancelled: n } = await api(`/api/anunturi/${id}`, { method: 'DELETE' })
    S.listings = S.listings.filter(l => l !== x);
    mapApi.closeMapCard(); S.ui.open.detail = false; emit(); refreshBookings().catch(() => {})
    toast(n ? `Anunțul a fost șters definitiv. ${n === 1 ? 'O rezervare a fost anulată și rambursată.' : n + ' rezervări au fost anulate și rambursate.'}` : 'Anunțul a fost retras și șters definitiv.')
  } catch (e) { fail(e) }
}

/* ================== MESAJE ================== */
export function openMessages(id) {
  requireAuth(() => {
    S.ui.open.msg = true
    pollConversations()
    if (id) return selectConv(id)
    S.ui.inThread = false
    if (!S.ui.activeConv && S.conversations[0] && innerWidth > 720) return selectConv([...S.conversations].sort((a, b) => lastTime(b) - lastTime(a))[0].id)
    emit()
  }, 'Ca să trimiți și să primești mesaje ai nevoie de un cont.')
}
export function selectConv(id) {
  const c = conv(id); if (!c) return
  S.ui.activeConv = id
  if (c.unread) { c.unread = 0; api(`/api/conversatii/${id}/citit`, { method: 'POST' }).catch(() => {}) }
  S.ui.inThread = true; S.ui.msgNonce++; emit()
}
export function backToList() { S.ui.inThread = false; emit() }
export function setDraft(t) { S.ui.msgDraft = t; emit() }
function upsertConv(c) { const i = S.conversations.findIndex(z => z.id === c.id); i >= 0 ? S.conversations.splice(i, 1, c) : S.conversations.unshift(c) }
/* „Ai nevoie de ajutor?” → pop-up „Nu ezita să ne contactezi” → conversația cu Echipa SPAȚIU. */
export function openHelp() { openM('help') }
export function openSupport() {
  requireAuth(async () => {
    let c
    try { c = await api('/api/conversatii/suport', { method: 'POST' }) } catch (e) { return fail(e) }
    upsertConv(c); S.ui.open.msg = true; selectConv(c.id)
  }, 'Ca să scrii echipei SPAȚIU ai nevoie de un cont.')
}
/* ================== PROFIL PUBLIC ================== */
/* Profilul unui utilizator (proprietar sau autor de recenzie). Anunțurile și recenziile vin din listele deja încărcate. */
export async function openProfile(userId) {
  if (userId == null) return
  S.ui.profile = { id: userId, name: '', since: '', loading: true }; openM('profile')
  try { S.ui.profile = await api(`/api/utilizatori/${userId}`) } catch (e) { S.ui.open.profile = false; fail(e) }
  emit()
}
/* „Trimite mesaj” din profil: conversație directă între doi utilizatori, fără anunț. */
export function messageProfile(userId) {
  if (S.user && S.user.id === userId) return toast('Acesta este profilul tău.')
  requireAuth(async () => {
    if (S.user.id === userId) return toast('Acesta este profilul tău.')
    let c
    try { c = await api('/api/conversatii/direct', { method: 'POST', body: { userId } }) } catch (e) { return fail(e) }
    upsertConv(c); S.ui.open.profile = false; S.ui.open.detail = false; S.ui.open.msg = true
    if (!c.messages.length && !S.ui.msgDraft) S.ui.msgDraft = `Bună ziua, ${c.with.split(' ')[0]}! `
    selectConv(c.id)
  }, 'Ca să trimiți un mesaj ai nevoie de un cont.')
}
export function startChat(listingId) {
  const x = byId(listingId)
  if (!x) return toast('Anunțul a fost retras.')
  if (isMine(x)) return toast('Acesta este anunțul tău.')
  requireAuth(async () => {
    if (isMine(x)) return toast('Acesta este anunțul tău.')
    let c
    try { c = await api('/api/conversatii', { method: 'POST', body: { listingId } }) } catch (e) { return fail(e) }
    upsertConv(c); S.ui.open.detail = false; S.ui.open.msg = true
    if (!c.messages.length && !S.ui.msgDraft) S.ui.msgDraft = `Bună ziua! Mă interesează anunțul „${x.title}”. Spațiul mai este disponibil?`
    selectConv(c.id)
  }, 'Ca să contactezi proprietarul ai nevoie de un cont.')
}
export async function sendMsg() {
  const text = S.ui.msgDraft.trim(), c = conv(S.ui.activeConv); if (!text || !c) return
  c.messages.push({ from: 'me', text, t: new Date().toISOString() }); S.ui.msgDraft = ''; emit()
  let fresh
  sending++ // cât timp se trimite, verificarea periodică nu suprascrie conversația
  try { fresh = await api(`/api/conversatii/${c.id}/mesaje`, { method: 'POST', body: { text } }) }
  catch (e) { c.messages.pop(); S.ui.msgDraft = text; emit(); return fail(e) }
  finally { sending-- }
  upsertConv(fresh); emit()
}

/* ================== REZERVARE + PLATĂ ================== */
export function startBooking(id) {
  const x = byId(id); if (!x) return
  if (isMine(x)) return toast('Nu îți poți rezerva propriul anunț.')
  requireAuth(() => {
    if (isMine(x)) return toast('Nu îți poți rezerva propriul anunț.')
    S.ui.book = { id, nonce: (S.ui.book?.nonce || 0) + 1 }; openM('book')
  }, 'Ca să rezervi un spațiu ai nevoie de un cont.')
}
/* Întoarce null dacă rezervarea a reușit, altfel eroarea. */
export async function createBooking(payload) {
  let b
  try { b = normBooking(await api('/api/rezervari', { method: 'POST', body: payload })) }
  catch (e) { if (e.status === 409) refreshListings().catch(() => {}); return e }
  const x = byId(b.listingId); if (x) b.days.forEach(k => x.avail.delete(k))
  S.bookingsMine.unshift(b); S.ui.open.book = false; S.ui.open.detail = false; emit()
  pollConversations()
  openTicket(b.id)
  return null
}
export async function cancelBooking(id) {
  let b
  try { b = normBooking(await api(`/api/rezervari/${id}/anuleaza`, { method: 'POST' })) } catch (e) { return fail(e) }
  const i = S.bookingsMine.findIndex(z => z.id === id); if (i >= 0) S.bookingsMine[i] = b
  const x = byId(b.listingId); if (x) { const tk = todayKey(); b.days.filter(k => k >= tk).forEach(k => x.avail.add(k)) }
  emit(); toast('Rezervarea a fost anulată. Rambursarea a fost inițiată.'); pollConversations()
}

/* ================== BILET ================== */
export function openTicket(id) { S.ui.ticketId = id; openM('ticket') }
export function downloadTicket(id) {
  const b = findBooking(id), html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Bilet ${b.code}</title></head><body style="margin:0;padding:24px;background:#f8f3ea">${ticketHTML(b)}</body></html>`
  downloadBlob(new Blob([html], { type: 'text/html' }), `bilet-${b.code}.html`)
}
export function printTicket() { document.body.classList.add('print-ticket'); window.print() }
addEventListener('afterprint', () => document.body.classList.remove('print-ticket'))

/* ================== RECENZII ==================
   • Chiriașul notează SPAȚIUL și GAZDA (proprietarul), după ce începe rezervarea.
   • Proprietarul notează CLIENTUL (chiriașul), tot după ce începe rezervarea.
   O singură recenzie de fiecare tip per rezervare. */
export function openReview(bookingId, type) { S.ui.review = { bookingId, type, nonce: (S.ui.review?.nonce || 0) + 1 }; openM('review') }
export async function addReview(payload) {
  try {
    S.reviews.unshift(await api('/api/recenzii', { method: 'POST', body: payload }))
    S.ui.open.review = false; emit(); toast('Mulțumim! Recenzia a fost publicată.')
  } catch (e) { fail(e) }
}
