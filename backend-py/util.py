"""Utilitare comune: acces la baza de date, autentificare, formatare în română."""

import hashlib
import secrets
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import Header, HTTPException, Request
from psycopg.rows import dict_row

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Europe/Bucharest")
except Exception:  # fără baza de fusuri orare: folosim ora serverului
    TZ = None


# ---------- Baza de date ----------

def pool(request: Request):
    return request.app.state.pool


async def fetch_all(conn, sql, params=()):
    cur = conn.cursor(row_factory=dict_row)
    await cur.execute(sql, params)
    return await cur.fetchall()


async def fetch_one(conn, sql, params=()):
    cur = conn.cursor(row_factory=dict_row)
    await cur.execute(sql, params)
    return await cur.fetchone()


# ---------- Autentificare (token de sesiune trimis în header-ul Authorization) ----------

def hash_pass(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()


def new_token() -> str:
    return secrets.token_urlsafe(32)


async def _user_from_header(request: Request, authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    async with pool(request).connection() as conn:
        return await fetch_one(conn, """
            SELECT u.* FROM sesiuni s JOIN utilizatori u ON u.id = s.user_id WHERE s.token = %s
        """, (authorization[7:],))


async def current_user(request: Request, authorization: str | None = Header(None)):
    """Dependency: utilizatorul conectat sau 401."""
    u = await _user_from_header(request, authorization)
    if not u:
        raise HTTPException(401, "Trebuie să fii conectat.")
    return u


def user_json(u) -> dict:
    return {
        "id": u["id"], "name": u["name"], "email": u["email"], "phone": u["phone"] or "",
        "termsVersion": u["terms_version"], "termsAcceptedAt": iso(u["terms_accepted_at"]),
    }


# ---------- Date și formatare ----------

MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie",
          "august", "septembrie", "octombrie", "noiembrie", "decembrie"]


def today() -> date:
    return datetime.now(TZ).date() if TZ else date.today()


def iso(v):
    return v.isoformat() if v is not None else None


def num(v):
    """NUMERIC → int dacă e întreg, altfel float (pentru JSON)."""
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def fmt_num(n, decimals=2) -> str:
    """1500 → '1.500', 12.5 → '12,5' (format românesc)."""
    n = round(float(n), decimals)
    whole, _, frac = f"{n:.{decimals}f}".partition(".")
    frac = frac.rstrip("0")
    whole = f"{int(whole):,}".replace(",", ".")
    return whole + ("," + frac if frac else "")


def fmt_lei(n) -> str:
    return fmt_num(n) + " lei"


def fmt_day_y(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def fmt_ranges(days) -> str:
    """Zile consecutive grupate: '4 octombrie 2026 – 6 octombrie 2026, 9 octombrie 2026'."""
    ds = sorted(days)
    if not ds:
        return "–"
    out, s, p = [], ds[0], ds[0]
    for d in ds[1:] + [None]:
        if d is not None and d == p + timedelta(days=1):
            p = d
            continue
        out.append(fmt_day_y(s) if s == p else f"{fmt_day_y(s)} – {fmt_day_y(p)}")
        s = p = d
    return ", ".join(out)


def to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def access_window(access: str):
    """'10:00–01:00' → (600, 1500); None = fără restricție de oră."""
    parts = (access or "").split("–")
    if len(parts) != 2 or not all(len(p) == 5 and p[2] == ":" for p in parts):
        return None
    a, b = to_min(parts[0]), to_min(parts[1])
    if b <= a:
        b += 1440
    return a, b
