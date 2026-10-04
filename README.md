https://vnuhack-frontend.onrender.com

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
- `CORS_ORIGINS` (backend, opțional): site-urile care pot apela API-ul, ex. `https://vnuhack-frontend.onrender.com`; implicit oricare.
- `VITE_API_URL` (frontend, opțional): adresa backend-ului; implicit `https://vnuhack-backend-py.onrender.com`. Pentru backend-ul local: `http://localhost:8000`.
