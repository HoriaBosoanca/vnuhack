# SPAȚIU — frontend (React + Vite)

Marketplace pentru închirierea de spații (case, săli, curți, garaje, depozitare).
Datele (conturi, anunțuri, rezervări, mesaje, recenzii) vin de la backend-ul din `../backend`.

```
npm install
npm run dev
```

Adresa API-ului se setează în `VITE_API_URL` (copiază `.env.example` în `.env`). Implicit e backend-ul de pe Render, `https://vnuhack-backend-py.onrender.com`; pentru backend-ul local pune `VITE_API_URL=http://localhost:8000`.
Favoritele și preferința „ascunde harta” rămân doar în browser.
