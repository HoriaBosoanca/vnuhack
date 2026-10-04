Frontend & backend: render.com \
Database: neon.com

## Rulare locală

Backend (FastAPI + PostgreSQL), în `backend-py`:
```
pip install -r requirements.txt
uvicorn main:app --reload
```
Pornește pe http://localhost:8000 (documentația API: http://localhost:8000/docs). La prima pornire creează tabelele și adaugă anunțurile demo.

Frontend (React), în `frontend`:
```
npm install
npm run dev
```

## Variabile de mediu
- `DATABASE_URL` (backend): baza de date Postgres; implicit cea de pe Neon.
- `CORS_ORIGINS` (backend, opțional): site-urile care pot apela API-ul, ex. `https://spatiu.onrender.com`; implicit oricare.
- `VITE_API_URL` (frontend): adresa backend-ului, ex. `https://spatiu-api.onrender.com`; implicit `http://localhost:8000`.
