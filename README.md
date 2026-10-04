https://vnuhack-frontend.onrender.com

## Rulare locală

Backend (FastAPI + PostgreSQL), în `backend-py`:
```
cp .env.example .env        # apoi pune link-ul real la baza de date în .env
pip install -r requirements.txt
uvicorn main:app --reload
```
Pornește pe http://localhost:8000 (documentația API: http://localhost:8000/docs). La pornire creează tabelele, dacă nu există.

Frontend (React), în `frontend`:
```
npm install
npm run dev
```

## Variabile de mediu
- `DATABASE_URL` (backend, **obligatoriu**): link-ul la baza de date Postgres (Neon). Pe Render se setează în Environment; local în `backend-py/.env`, care nu intră în git.
- `CORS_ORIGINS` (backend, opțional): site-urile care pot apela API-ul, ex. `https://vnuhack-frontend.onrender.com`; implicit oricare.
- `VITE_API_URL` (frontend, opțional): adresa backend-ului; implicit `https://vnuhack-backend-py.onrender.com`. Pentru backend-ul local: `http://localhost:8000`.
