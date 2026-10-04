"""Conturi: creare, conectare, deconectare, utilizatorul curent."""

import re
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from mesaje import notify_support
from util import current_user, fetch_one, hash_pass, new_token, pool, user_json

router = APIRouter(prefix="/api/auth", tags=["cont"])
TERMS_VERSION = "1.0"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def valid_phone(p: str) -> bool:
    return bool(re.fullmatch(r"(\+40|0040|0)[237]\d{8}", re.sub(r"[\s.\-()]", "", p)))


class Inregistrare(BaseModel):
    name: str
    email: str
    phone: str = ""
    password: str
    terms: bool
    newsletter: bool = False


class Conectare(BaseModel):
    email: str
    password: str


async def _session(conn, user_id: int) -> str:
    token = new_token()
    await conn.execute("INSERT INTO sesiuni (token, user_id) VALUES (%s, %s)", (token, user_id))
    return token


@router.post("/register")
async def register(b: Inregistrare, request: Request):
    name, email, phone = b.name.strip(), b.email.strip().lower(), b.phone.strip()
    if len(name) < 3:
        raise HTTPException(422, "Introdu numele complet.")
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Adresa de e-mail nu e validă.")
    if phone and not valid_phone(phone):
        raise HTTPException(422, "Număr invalid. Exemplu: 0722 123 456.")
    if len(b.password) < 8:
        raise HTTPException(422, "Parola trebuie să aibă minim 8 caractere.")
    if not b.terms:
        raise HTTPException(422, "Trebuie să accepți Termenii și condițiile ca să-ți creezi cont.")
    salt = secrets.token_hex(12)
    async with pool(request).connection() as conn:
        u = await fetch_one(conn, """
            INSERT INTO utilizatori (name, email, phone, salt, pass_hash, terms_version, newsletter)
            VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (email) DO NOTHING RETURNING *
        """, (name, email, phone, salt, hash_pass(b.password, salt), TERMS_VERSION, b.newsletter))
        if not u:
            raise HTTPException(409, "Există deja un cont cu acest e-mail. Apasă „Am deja cont”.")
        await notify_support(conn, u["id"], f"Bun venit pe SPAȚIU, {name.split()[0]}! 👋\nAici vezi conversațiile cu proprietarii și confirmările rezervărilor tale. Ca să contactezi un proprietar, apasă „Mesaj” în pagina unui anunț sau pe hartă.")
        return {"token": await _session(conn, u["id"]), "user": user_json(u)}


@router.post("/login")
async def login(b: Conectare, request: Request):
    async with pool(request).connection() as conn:
        u = await fetch_one(conn, "SELECT * FROM utilizatori WHERE email = %s", (b.email.strip().lower(),))
        if not u or not secrets.compare_digest(hash_pass(b.password, u["salt"]), u["pass_hash"]):
            raise HTTPException(401, "E-mailul sau parola nu sunt corecte.")
        return {"token": await _session(conn, u["id"]), "user": user_json(u)}


@router.post("/logout")
async def logout(request: Request, authorization: str | None = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        async with pool(request).connection() as conn:
            await conn.execute("DELETE FROM sesiuni WHERE token = %s", (authorization[7:],))
    return {"ok": True}


@router.get("/me")
async def me(u=Depends(current_user)):
    return user_json(u)
