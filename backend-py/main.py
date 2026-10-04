"""
API pentru publicarea ofertelor de închiriere spații.

Rulare:
    pip install -r requirements.txt
    uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool

import postari

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_DaHNVl7CXOc8@ep-aged-pine-b17368dl-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
)
PORT = int(os.environ.get("PORT", "8000"))

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
    app.state.pool = pool
    yield
    await pool.close()


app = FastAPI(title="Inchiriere spatii", lifespan=lifespan)
app.include_router(postari.router)


@app.get("/health")
async def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=PORT, reload=True)
