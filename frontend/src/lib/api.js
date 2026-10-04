/* ================== LEGĂTURA CU BACKEND-UL (backend-py) ==================
   Adresa API-ului se setează în VITE_API_URL (vezi .env.example); implicit backend-ul de pe Render. */
export const API = (import.meta.env.VITE_API_URL || 'https://vnuhack-backend-py.onrender.com').replace(/\/$/, '')

const TOKEN_KEY = 'spatiu-token'
let token = null
try { token = localStorage.getItem(TOKEN_KEY) } catch (e) {}

export const hasToken = () => !!token
export function setToken(t) {
  token = t
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch (e) {}
}

/* Cerere JSON către API. Aruncă o eroare cu mesajul serverului (în română) și codul HTTP. */
export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(API + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    const err = new Error('Nu mă pot conecta la server. Verifică conexiunea și încearcă din nou.'); err.status = 0; throw err
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    const msg = typeof d.detail === 'string' ? d.detail : Array.isArray(d.detail) ? 'Unele date nu sunt valide. Verifică formularul.' : `Eroare de server (${res.status}).`
    const err = new Error(msg); err.status = res.status; throw err
  }
  return res.json()
}

/* Pozele și contractele încărcate sunt servite de API (căi care încep cu „/api/...”). */
export const absUrl = u => u && u.startsWith('/') ? API + u : u

export function blobToDataURL(b) {
  return new Promise((resolve, reject) => { const f = new FileReader(); f.onload = () => resolve(f.result); f.onerror = () => reject(f.error); f.readAsDataURL(b) })
}
