import { useSyncExternalStore } from 'react'
import { seedListings, SEED_PLACE, SEED_REVIEWS } from './data'
import { geocode } from './geo'
import { ticketHTML } from './ticket'
import {
  avgOf, todayKey, fmtLei, fmtRanges, fmtPrice, label, ruleKey, noiseLevel, accessWindow, toMin,
  downloadBlob, sleep, SAFETY_PHRASE, TERMS_VERSION, newSalt, hashPass,
} from './utils'

/* ================== STARE GLOBALĂ ==================
   Un singur „store” mutabil; componentele se abonează cu useStore() și se re-randează la emit(). */
export const MODALS = ['detail', 'publish', 'msg', 'account', 'auth', 'book', 'ticket', 'review', 'risk', 'terms'] // ordinea = ordinea de suprapunere

export const defaultFilters = () => ({ q: '', type: 'all', duration: 'all', county: '', min: '', max: '', noise: '0', access: 'any', from: '18:00', to: '23:00', rules: [] })

export const S = {
  listings: seedListings(), users: [], bookings: [], reviews: SEED_REVIEWS.slice(), convsByUser: {}, favs: new Set(),
  user: null, conversations: [],
  ui: {
    open: Object.fromEntries(MODALS.map(m => [m, false])),
    detailId: null, detailNonce: 0, ticketId: null, review: null, book: null,
    authReason: '', authTab: 'reg', pending: null, termsAccept: null,
    activeConv: null, inThread: false, msgDraft: '', msgNonce: 0,
    filters: defaultFilters(), fltOpen: false, mapHidden: false, mapHiddenInstant: false,
    toast: { msg: '', n: 0 }, dbOk: false,
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
export const isMine = x => !!(S.user && x.owner.email && x.owner.email === S.user.email)
export const nextFree = x => { const tk = todayKey(); return [...x.avail].filter(k => k >= tk).sort()[0] }
export const ownerKey = o => o.email ? o.email : 'seed:' + o.name
export function listingRating(x) { const rs = S.reviews.filter(r => r.type === 'listing' && r.listingId === x.id); return { n: rs.length, avg: avgOf(rs.map(r => r.stars)) } }
export function hostRating(key) { const rs = S.reviews.filter(r => r.type === 'listing' && (r.ownerKey || ownerKey((byId(r.listingId) || { owner: {} }).owner)) === key); return { n: rs.length, avg: avgOf(rs.map(r => r.hostStars)) } }
export function guestRating(email) { const rs = S.reviews.filter(r => r.type === 'guest' && r.guestEmail === email); return { n: rs.length, avg: avgOf(rs.map(r => r.stars)) } }
export const bookingStarted = b => [...b.days].sort()[0] <= todayKey()
export const findReview = (b, type) => S.reviews.find(r => r.bookingId === b.id && r.type === type)
export const myBookings = () => S.user ? S.bookings.filter(b => b.userEmail === S.user.email) : []
export const recvBookings = () => S.bookings.filter(b => { const x = byId(b.listingId); return x && isMine(x) })
export const canCancel = b => b.status === 'confirmată' && [...b.days].sort()[0] >= todayKey()
export const conv = id => S.conversations.find(c => c.id === id)
export const lastTime = c => c.messages.length ? c.messages[c.messages.length - 1].t : c.created
export const unreadCount = () => S.conversations.reduce((s, c) => s + c.unread, 0)

/* ================== TOAST & FERESTRE ================== */
export function toast(msg) { S.ui.toast = { msg, n: S.ui.toast.n + 1 }; emit() }
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

/* ================== SALVARE ÎN BROWSER (IndexedDB) ==================
   Anunțurile (cu poze și contracte), conturile, rezervările și mesajele rămân salvate în acest browser,
   pe acest dispozitiv, și după refresh. Nu sunt partajate între dispozitive sau utilizatori diferiți:
   pentru asta e nevoie de un server (ex. Supabase / Firebase). */
const DB = { db: null, ok: false }
function idbOpen() { return new Promise(res => { try { const r = indexedDB.open('spatiu-db', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { DB.db = r.result; DB.ok = true; res(true) }; r.onerror = r.onblocked = () => res(false) } catch (e) { res(false) } }) }
export function idbGet(k) { return new Promise(res => { if (!DB.ok) return res(undefined); try { const r = DB.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined) } catch (e) { res(undefined) } }) }
export function idbSet(k, v) { return new Promise(res => { if (!DB.ok) return res(false); try { const tx = DB.db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => res(false) } catch (e) { console.warn(e); res(false) } }) }

function serListing(x) { const o = { ...x }; delete o.img; if (o.photoBlobs) delete o.imgs; if (o.contract) o.contract = { name: o.contract.name, size: o.contract.size, blob: o.contract.blob }; return o }
function deserListing(o) { if (o.photoBlobs) o.imgs = o.photoBlobs.map(b => URL.createObjectURL(b)); o.img = o.imgs[0]; if (o.contract && o.contract.blob) o.contract.url = URL.createObjectURL(o.contract.blob); return o }
const cleanConv = c => ({ id: c.id, with: c.with, listingId: c.listingId, unread: c.unread, created: c.created, messages: c.messages })

function stateObj() {
  if (S.user) S.convsByUser[S.user.email] = S.conversations.map(cleanConv)
  return { v: 1, savedAt: new Date(), users: S.users, session: S.user ? S.user.email : null, listings: S.listings.map(serListing), bookings: S.bookings, reviews: S.reviews, convsByUser: S.convsByUser, favs: [...S.favs] }
}
let saveT
export function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 120) }
export async function saveNow() {
  clearTimeout(saveT); const st = stateObj()
  if (!DB.ok) return
  const ok = await idbSet('state', st)
  if (!ok) toast('Nu am putut salva datele în browser (spațiu insuficient sau mod privat).')
}

function applyState(st) {
  S.users = st.users || []; S.bookings = st.bookings || []; if (Array.isArray(st.reviews)) S.reviews = st.reviews
  S.convsByUser = st.convsByUser || {}; S.favs = new Set(st.favs || [])
  if (st.listings && st.listings.length) S.listings = st.listings.map(deserListing)
  S.user = null; S.conversations = []; S.ui.activeConv = null
  if (st.session) { const u = S.users.find(u => u.email === st.session); if (u) setUser(u) }
}

function fixSeeds() {
  S.listings = S.listings.filter(x => !x.removed)
  S.listings.forEach(x => {
    if (x.id >= 1 && x.id <= 6) { if (!x.city) [x.county, x.city] = SEED_PLACE[x.id - 1]; x.rules = (x.rules || []).filter(r => !/mâncare lângă echipamentul foto/i.test(r)) }
  })
}

export async function loadState() {
  await idbOpen(); S.ui.dbOk = DB.ok
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist() } catch (e) {}
  const st = await idbGet('state')
  if (st) applyState(st)
  fixSeeds(); save()
  const ui = await idbGet('ui'); if (ui && ui.mapHidden) { S.ui.mapHidden = true; S.ui.mapHiddenInstant = true }
  emit()
  if (!DB.ok) toast('Acest browser nu permite salvarea datelor aici, deci se pierd la refresh. Deschide site-ul în Chrome, Edge sau Firefox.')
  geocodeMissing()
}

/* Salvare și la închiderea paginii / a tab-ului. */
addEventListener('pagehide', () => saveNow())
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow() })

/* ===== Export / import al datelor într-un fișier JSON (cu poze și contracte incluse) ===== */
function blobToDataURL(b) { return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(null); f.readAsDataURL(b) }) }
function dataURLToBlob(u) { const i = u.indexOf(','), mime = (u.slice(5, i).split(';')[0]) || 'application/octet-stream', bin = atob(u.slice(i + 1)), a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return new Blob([a], { type: mime }) }
async function packBlobs(v) {
  if (v instanceof Blob) return { __blob: await blobToDataURL(v), name: v.name || '' }
  if (v instanceof Date || v instanceof Set) return v
  if (Array.isArray(v)) return Promise.all(v.map(packBlobs))
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = await packBlobs(v[k]); return o }
  return v
}
function stateReplacer(k, v) { const o = this[k]; if (o instanceof Date) return { __date: o.toISOString() }; if (o instanceof Set) return { __set: [...o] }; return v }
function stateReviver(k, v) { if (v && typeof v === 'object') { if (v.__date) return new Date(v.__date); if (v.__set) return new Set(v.__set); if (v.__blob) return dataURLToBlob(v.__blob) } return v }

export async function exportData() {
  const json = JSON.stringify(await packBlobs(stateObj()), stateReplacer)
  downloadBlob(new Blob([json], { type: 'application/json' }), 'spatiu-date.json')
  toast('Am descărcat fișierul cu toate datele. Îl poți importa pe alt calculator din „Contul meu”.')
}
export async function importData(file) {
  if (!file) return
  try {
    const st = JSON.parse(await file.text(), stateReviver)
    if (!st || !Array.isArray(st.listings)) throw new Error('format')
    applyState(st); fixSeeds(); await saveNow(); emit()
    toast('Datele au fost importate.')
  } catch (e) { console.warn(e); toast('Fișierul nu conține date SPAȚIU valide.') }
}

/* ================== CONT ================== */
export function setUser(u) { S.user = u; S.conversations = (S.convsByUser[u.email] || []).map(c => ({ ...c, typing: false })); S.ui.activeConv = null }
export function requireAuth(fn, reason) {
  if (S.user) return fn()
  S.ui.pending = fn; S.ui.authReason = reason || ''; S.ui.authTab = S.users.length ? 'login' : 'reg'; openM('auth')
}
function afterAuth() { const next = S.ui.pending; S.ui.pending = null; S.ui.open.auth = false; save(); emit(); if (next) next() }

/* Întoarce un mesaj de eroare sau null dacă s-a conectat. */
export async function login(email, pass) {
  const u = S.users.find(u => u.email === email)
  if (!u || await hashPass(pass, u.salt) !== u.passHash) return 'E-mailul sau parola nu sunt corecte.'
  setUser(u); toast(`Bine ai revenit, ${u.name.split(' ')[0]}!`); afterAuth(); return null
}
export async function register({ name, email, phone, pass, newsletter }) {
  const salt = newSalt()
  const u = { name, email, phone, salt, passHash: await hashPass(pass, salt), termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(), newsletter, createdAt: new Date() }
  S.users.push(u); setUser(u)
  S.conversations.unshift({ id: 'welcome', with: 'Echipa SPAȚIU', listingId: null, unread: 1, created: new Date(), messages: [{ from: 'them', t: new Date(), text: `Bun venit pe SPAȚIU, ${name.split(' ')[0]}! 👋\nAici vezi conversațiile cu proprietarii și confirmările rezervărilor tale. Ca să contactezi un proprietar, apasă „Mesaj” în pagina unui anunț sau pe hartă.` }] })
  toast(`Cont creat. Ai acceptat Termenii și condițiile v${TERMS_VERSION}.`)
  afterAuth()
}
export function logout() { saveNow(); S.user = null; S.conversations = []; S.ui.activeConv = null; S.ui.open.account = false; save(); emit(); toast('Te-ai deconectat.') }
export function openAccount() { if (!S.user) return requireAuth(() => {}, 'Cu un cont poți publica anunțuri și trimite mesaje.'); openM('account') }
export function openPublish() { requireAuth(() => openM('publish'), 'Ca să publici un anunț ai nevoie de un cont.') }
export function openTerms(onAccept) { S.ui.termsAccept = onAccept || null; openM('terms') }

/* ================== LISTĂ & FILTRE ================== */
export function setFilter(patch) { Object.assign(S.ui.filters, patch); emit() }
export function resetFilters() { S.ui.filters = defaultFilters(); emit() }
export function toggleFav(id) { S.favs.has(id) ? S.favs.delete(id) : S.favs.add(id); save(); emit() }

function passFilters(x, f) {
  if (f.county && x.county !== f.county) return false
  if (f.min !== '' && x.price < +f.min) return false
  if (f.max !== '' && x.price > +f.max) return false
  if (+f.noise && noiseLevel(x) < +f.noise) return false
  if (f.access === '24/7' && x.access !== '24/7') return false
  if (f.access === 'range' && x.access !== '24/7') { const w = accessWindow(x); if (!w) return false; let a = toMin(f.from), b = toMin(f.to); if (b <= a) b += 1440; if (a < w[0]) { a += 1440; b += 1440 } if (a < w[0] || b > w[1]) return false }
  const keys = (x.rules || []).map(ruleKey); for (const k of f.rules) if (!keys.includes(k)) return false
  return true
}
export function filteredListings() {
  const f = S.ui.filters, q = f.q.trim().toLowerCase()
  return S.listings.filter(x => !x.removed && (f.type === 'all' || x.type === f.type)
    && (!q || [x.title, x.location, x.address, x.desc, x.type, label(x.type)].join(' ').toLowerCase().includes(q))
    && (f.duration === 'all' || (f.duration === 'month' && x.unit === 'lună') || (f.duration === 'day' && x.unit === 'zi') || (f.duration === 'hour' && x.unit === 'oră'))
    && passFilters(x, f))
}
export function activeFilterCount() { const f = S.ui.filters; return [f.county, f.min || f.max, f.noise !== '0', f.access !== 'any'].filter(Boolean).length + f.rules.length }

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
export function setMapHidden(h) { S.ui.mapHidden = h; S.ui.mapHiddenInstant = false; if (h) mapApi.closeMapCard(); idbSet('ui', { mapHidden: h }); emit() }

export function publishListing(x) {
  S.listings.unshift(x); save(); S.ui.open.publish = false; resetFilters()
  setTimeout(() => mapApi.focusListing(x.id, true), 0)
  toast('Anunțul a fost publicat și salvat. Rămâne și după refresh.')
}
/* Retragerea șterge anunțul complet (listă, hărți, filtre, favorite, cont). Rezervările viitoare se anulează și se rambursează. */
export function deleteListing(id) {
  const x = byId(id); if (!x || !isMine(x)) return
  const now = new Date(); let n = 0
  S.bookings.forEach(b => { if (b.listingId === id && canCancel(b)) { b.status = 'anulată'; b.cancelledAt = now; b.refund = { amount: b.total, at: now }; b.cancelReason = 'Anunțul a fost retras de proprietar.'; n++ } })
  S.listings = S.listings.filter(l => l !== x); S.favs.delete(id)
  mapApi.closeMapCard(); S.ui.open.detail = false; save(); emit()
  toast(n ? `Anunțul a fost șters definitiv. ${n === 1 ? 'O rezervare a fost anulată și rambursată.' : n + ' rezervări au fost anulate și rambursate.'}` : 'Anunțul a fost retras și șters definitiv.')
}

/* Anunțurile care nu au încă poziția adresei sunt plasate o singură dată pe hartă (1 cerere/secundă). */
async function geocodeMissing() {
  const todo = S.listings.filter(x => x.address && !x.geo); let changed = false
  for (const x of todo) {
    const r = await geocode({ address: x.address, city: x.city || '', county: x.county || 'București' })
    if (r === undefined) break // fără conexiune: încercăm la următoarea deschidere
    x.geo = r ? (r.approx ? 'approx' : 'ok') : 'fail'; if (r) { x.lat = r.lat; x.lng = r.lng; changed = true }
    await sleep(1100)
  }
  if (todo.length) { save(); if (changed) emit() }
}

/* ================== MESAJE ================== */
export function openMessages(id) {
  requireAuth(() => {
    S.ui.open.msg = true
    if (id) return selectConv(id)
    S.ui.inThread = false
    if (!S.ui.activeConv && S.conversations[0] && innerWidth > 720) return selectConv(S.conversations[0].id)
    emit()
  }, 'Ca să trimiți și să primești mesaje ai nevoie de un cont.')
}
export function selectConv(id) {
  const c = conv(id); if (!c) return
  S.ui.activeConv = id; if (c.unread) { c.unread = 0; save() }
  S.ui.inThread = true; S.ui.msgNonce++; emit()
}
export function backToList() { S.ui.inThread = false; emit() }
export function setDraft(t) { S.ui.msgDraft = t; emit() }
export function startChat(listingId) {
  const x = byId(listingId)
  if (isMine(x)) return toast('Acesta este anunțul tău.')
  if (x.removed) return toast('Anunțul a fost retras.')
  requireAuth(() => {
    if (isMine(x)) return toast('Acesta este anunțul tău.')
    S.ui.open.detail = false
    let c = S.conversations.find(c => c.listingId === listingId)
    if (!c) { c = { id: 'c' + Date.now(), with: x.owner.name, listingId, unread: 0, created: new Date(), messages: [] }; S.conversations.unshift(c); save() }
    S.ui.open.msg = true
    if (!c.messages.length && !S.ui.msgDraft) S.ui.msgDraft = `Bună ziua! Mă interesează anunțul „${x.title}”. Spațiul mai este disponibil?`
    selectConv(c.id)
  }, 'Ca să contactezi proprietarul ai nevoie de un cont.')
}
export function sendMsg() {
  const text = S.ui.msgDraft.trim(), c = conv(S.ui.activeConv); if (!text || !c) return
  c.messages.push({ from: 'me', text, t: new Date() }); S.ui.msgDraft = ''; save(); emit(); simulateReply(c, text)
}
/* DEMO: răspunsurile sunt simulate local. În producție mesajele trec printr-un server
   (ex. WebSocket, Firebase sau Supabase Realtime) și ajung la utilizatorul real. */
function simulateReply(c, text) {
  clearTimeout(c.t1); clearTimeout(c.t2)
  c.t1 = setTimeout(() => { c.typing = true; emit() }, 700)
  c.t2 = setTimeout(() => {
    if (!S.conversations.includes(c)) return
    c.typing = false; c.messages.push({ from: 'them', text: replyFor(c, text), t: new Date() })
    const viewing = S.ui.open.msg && S.ui.activeConv === c.id && (innerWidth > 720 || S.ui.inThread)
    if (!viewing) { c.unread++; toast(`💬 Mesaj nou de la ${c.with}`) }
    save(); emit()
  }, 2000 + Math.random() * 1200)
}
function replyFor(c, text) {
  const t = text.toLowerCase(), x = c.listingId ? byId(c.listingId) : null
  if (!x && c.listingId) return 'Acest anunț a fost retras de proprietar.'
  if (!x) return 'Mulțumim pentru mesaj! Un coleg din echipa de suport îți răspunde în cel mult 24 de ore.'
  const s = x.safety
  if (/isu|incendiu|stingăt|stingat|evacuare|siguran/.test(t)) {
    if (s.isu) return `Da, spațiul are autorizație ISU${s.isuNo ? ' (nr. ' + s.isuNo + ')' : ''}. Vă pot trimite o copie înainte să semnăm.`
    const has = ['extinguisher', 'evacuation', 'smoke'].filter(k => s[k]).map(k => SAFETY_PHRASE[k])
    return `Momentan spațiul nu are autorizație ISU${has.length ? ', dar are ' + has.join(' și ') : ''}. Vă rog să țineți cont de asta pentru tipul de activitate.`
  }
  if (/pre[tț]|negoci|reducere|discount|cost/.test(t)) return `Prețul este ${fmtPrice(x.price)} lei / ${x.unit}. Pentru o perioadă mai lungă putem discuta o reducere.`
  if (/vizion|vizit|văd|vad|vedea|programare/.test(t)) return 'Sigur, putem stabili o vizionare. Vă convine mâine după ora 17:00?'
  if (/disponibil|liber|când|cand|perioad/.test(t)) return 'Da, spațiul este disponibil. Pentru ce perioadă v-ar interesa?'
  if (/mul[tț]umesc|mersi/.test(t)) return 'Cu plăcere! Vă stau la dispoziție.'
  return 'Mulțumesc pentru mesaj! Revin cu detalii cât de curând.'
}
function notifySupport(text) {
  if (!S.user) return; let c = S.conversations.find(c => c.id === 'welcome')
  if (!c) { c = { id: 'welcome', with: 'Echipa SPAȚIU', listingId: null, unread: 0, created: new Date(), messages: [] }; S.conversations.unshift(c) }
  c.messages.push({ from: 'them', text, t: new Date() }); c.unread++
}

/* ================== REZERVARE + PLATĂ ================== */
export function startBooking(id) {
  const x = byId(id); if (!x) return
  if (isMine(x)) return toast('Nu îți poți rezerva propriul anunț.')
  if (x.removed) return toast('Anunțul a fost retras.')
  requireAuth(() => {
    if (isMine(x)) return toast('Nu îți poți rezerva propriul anunț.')
    S.ui.book = { id, nonce: (S.ui.book?.nonce || 0) + 1 }; openM('book')
  }, 'Ca să rezervi un spațiu ai nevoie de un cont.')
}
export async function createBooking(b) {
  const x = byId(b.listingId)
  b.days.forEach(k => x.avail.delete(k)); S.bookings.unshift(b)
  notifySupport(`✅ Rezervarea ${b.code} e confirmată: „${b.listingTitle}”, ${fmtRanges(b.days)}${b.from ? `, ${b.from}–${b.to}` : ''}. Ai plătit ${fmtLei(b.total)}. Biletul îl găsești în „Contul meu”.`)
  save(); S.ui.open.book = false; S.ui.open.detail = false; emit()
  await sendTicketEmail(b, 'confirm'); save(); openTicket(b.id)
}
export async function cancelBooking(id) {
  const b = S.bookings.find(z => z.id === id); if (!b || !canCancel(b)) return
  b.status = 'anulată'; b.cancelledAt = new Date(); b.refund = { amount: b.total, at: new Date() }
  const x = byId(b.listingId); if (x) { const tk = todayKey(); b.days.filter(k => k >= tk).forEach(k => x.avail.add(k)) }
  notifySupport(`Rezervarea ${b.code} („${b.listingTitle}”) a fost anulată. Rambursarea de ${fmtLei(b.total)} a fost inițiată.`)
  save(); emit(); toast('Rezervarea a fost anulată. Rambursarea a fost inițiată.')
  await sendTicketEmail(b, 'cancel'); save(); emit()
}

/* ================== BILET ================== */
export function openTicket(id) { S.ui.ticketId = id; openM('ticket') }
export function downloadTicket(id) {
  const b = S.bookings.find(z => z.id === id), html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Bilet ${b.code}</title></head><body style="margin:0;padding:24px;background:#f6f7f9">${ticketHTML(b)}</body></html>`
  downloadBlob(new Blob([html], { type: 'text/html' }), `bilet-${b.code}.html`)
}
export function printTicket() { document.body.classList.add('print-ticket'); window.print() }
addEventListener('afterprint', () => document.body.classList.remove('print-ticket'))
export async function resendTicket(id) { const b = S.bookings.find(z => z.id === id); const ok = await sendTicketEmail(b, b.status === 'anulată' ? 'cancel' : 'confirm'); save(); emit(); toast(ok ? 'Biletul a fost retrimis.' : 'E-mailul nu a putut fi trimis.') }

/* ===== Trimiterea biletului pe e-mail (EmailJS) =====
   Ca biletul să ajungă pe e-mail pe bune: fă un cont gratuit pe emailjs.com, conectează un serviciu de e-mail
   (ex. Gmail) și creează un șablon, apoi completează cele 3 valori de mai jos. În șablon pune:
   To Email = {{to_email}}, Subject = {{subject}}, iar în conținut (HTML) = {{{ticket_html}}}. */
const EMAILJS = { publicKey: '', serviceId: '', templateId: '' }
async function sendTicketEmail(b, kind) {
  if (!EMAILJS.publicKey || !EMAILJS.serviceId || !EMAILJS.templateId) { b.email = { status: 'neconfigurat', at: new Date() }; return false }
  try {
    const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      service_id: EMAILJS.serviceId, template_id: EMAILJS.templateId, user_id: EMAILJS.publicKey,
      template_params: { to_email: b.ticketEmail, to_name: b.userName, subject: kind === 'cancel' ? `Rezervarea ${b.code} a fost anulată` : `Biletul tău SPAȚIU, rezervarea ${b.code}`,
        booking_code: b.code, listing_title: b.listingTitle, listing_address: b.address, dates: fmtRanges(b.days), total: fmtLei(b.total), transaction_id: b.payment.txn, status: b.status, ticket_html: ticketHTML(b) } }) })
    b.email = { status: r.ok ? 'trimis' : 'eroare', at: new Date() }; return r.ok
  } catch (e) { b.email = { status: 'eroare', at: new Date() }; return false }
}

/* ================== RECENZII ==================
   • Chiriașul notează SPAȚIUL și GAZDA (proprietarul), după ce începe rezervarea.
   • Proprietarul notează CLIENTUL (chiriașul), tot după ce începe rezervarea.
   O singură recenzie de fiecare tip per rezervare. */
export function openReview(bookingId, type) { S.ui.review = { bookingId, type, nonce: (S.ui.review?.nonce || 0) + 1 }; openM('review') }
export function addReview(r) { S.reviews.push(r); save(); S.ui.open.review = false; emit(); toast('Mulțumim! Recenzia a fost publicată.') }
