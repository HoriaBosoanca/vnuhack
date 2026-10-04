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

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import AsyncConnectionPool

import anunturi
import auth
import mesaje
import rezervari
from schema import init_db

def load_env_file(path=os.path.join(os.path.dirname(__file__), ".env")):
    """Citește backend-py/.env (KEY=valoare pe fiecare linie), dacă există. Variabilele deja setate au prioritate."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            key, sep, value = line.strip().partition("=")
            if sep and key and not key.startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_env_file()
# Link-ul la baza de date vine doar din mediu: pe Render din „Environment”, local din backend-py/.env.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
PORT = int(os.environ.get("PORT", "8000"))
# Site-urile care pot apela API-ul, separate prin virgulă (ex. https://spatiu.onrender.com). Implicit: oricare.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DATABASE_URL:
        raise RuntimeError("Lipsește DATABASE_URL: setează variabila de mediu (pe Render: Environment) sau pune-o în backend-py/.env")
    # prepare_threshold=None: fără prepared statements pe server, ca să meargă prin pooler-ul Neon (PgBouncer).
    pool = AsyncConnectionPool(DATABASE_URL, min_size=1, max_size=5, open=False, kwargs={"prepare_threshold": None})
    await pool.open()
    async with pool.connection() as conn:
        await init_db(conn)
    app.state.pool = pool
    yield
    await pool.close()


app = FastAPI(title="Inchiriere spatii", lifespan=lifespan)
log = logging.getLogger("uvicorn.error")


@app.middleware("http")
async def erori_neprevazute(request: Request, call_next):
    """Orice eroare neprevăzută devine un 500 JSON cu mesajul ei (scris și în log).
    Middleware-ul e în interiorul celui de CORS, așa că și erorile primesc header-ele CORS
    și browserul arată eroarea reală, nu „CORS header missing”."""
    try:
        return await call_next(request)
    except Exception as e:
        log.exception("Eroare la %s %s", request.method, request.url.path)
        return JSONResponse({"detail": f"Eroare de server: {type(e).__name__}: {e}"[:500]}, status_code=500)


app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(anunturi.router)
app.include_router(rezervari.router)
app.include_router(mesaje.router)


@app.get("/health")
async def health():
    # Render setează RENDER_GIT_COMMIT: așa vezi ce versiune a codului rulează.
    return {"ok": True, "commit": os.environ.get("RENDER_GIT_COMMIT", "local")[:7]}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=os.environ.get("HOST", "127.0.0.1"), port=PORT, reload=True)
