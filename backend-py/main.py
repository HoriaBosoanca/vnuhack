"""
API pentru SPAȚIU (închiriere spații) — folosit de aplicația React din /frontend.

Rulare:
    pip install -r requirements.txt
    uvicorn main:app --reload

Endpoint-uri (toate sub /api; cele marcate cu * cer „Authorization: Bearer <token>”):
    POST /api/auth/register, /api/auth/login, /api/auth/logout    GET /api/auth/me *
    GET  /api/anunturi    POST /api/anunturi *    DELETE /api/anunturi/{id} *
    GET  /api/poze/{id}   GET /api/anunturi/{id}/contract
    GET  /api/rezervari * POST /api/rezervari *   POST /api/rezervari/{id}/anuleaza *
    GET  /api/recenzii    POST /api/recenzii *
    GET  /api/conversatii *   POST /api/conversatii *   POST /api/conversatii/{id}/mesaje *   POST /api/conversatii/{id}/citit *
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from psycopg_pool import AsyncConnectionPool

import anunturi
import auth
import mesaje
import postari
import rezervari
from schema import init_db

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_DaHNVl7CXOc8@ep-aged-pine-b17368dl-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)
PORT = int(os.environ.get("PORT", "8000"))
# Site-urile care pot apela API-ul, separate prin virgulă (ex. https://spatiu.onrender.com). Implicit: oricare.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

SCHEMA = """
CREATE TABLE IF NOT EXISTS postari (
    id_postare      SERIAL PRIMARY KEY,
    id_ofertant     TEXT NOT NULL,
    taguri          TEXT[] NOT NULL DEFAULT '{}',
    data_publicare  DATE NOT NULL,
    titlu           TEXT NOT NULL,
    descriere       TEXT NOT NULL,
    tip_spatiu      TEXT NOT NULL CHECK (tip_spatiu IN ('apartament', 'casa', 'terasa', 'teren')),
    suprafata_m2    NUMERIC(10, 2) NOT NULL CHECK (suprafata_m2 > 0),
    nr_camere       INTEGER NOT NULL CHECK (nr_camere >= 0),
    data_start      DATE NOT NULL,
    data_end        DATE NOT NULL,
    ora_start       TIME NOT NULL,
    ora_end         TIME NOT NULL,
    pret_unitate    NUMERIC(10, 2) NOT NULL CHECK (pret_unitate >= 0),
    unitate_pret    TEXT NOT NULL CHECK (unitate_pret IN ('pe ora', 'pe zi')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_postari_taguri ON postari USING GIN (taguri);
CREATE INDEX IF NOT EXISTS idx_postari_perioada ON postari (data_start, data_end);
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DATABASE_URL:
        raise RuntimeError("Setează variabila de mediu DATABASE_URL")
    pool = AsyncConnectionPool(DATABASE_URL, min_size=1, max_size=5, open=False)
    await pool.open()
    async with pool.connection() as conn:
        await conn.execute(SCHEMA)
        await init_db(conn)
    app.state.pool = pool
    yield
    await pool.close()


app = FastAPI(title="Inchiriere spatii", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(postari.router)
app.include_router(auth.router)
app.include_router(anunturi.router)
app.include_router(rezervari.router)
app.include_router(mesaje.router)


@app.get("/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=os.environ.get("HOST", "127.0.0.1"), port=PORT, reload=True)
