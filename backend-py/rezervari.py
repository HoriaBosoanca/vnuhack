"""Rezervări (cu plată demo) și recenzii."""

import math
import re
import secrets
import time as _time
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from mesaje import notify_support
from util import access_window, current_user, fetch_all, fetch_one, fmt_lei, fmt_num, fmt_ranges, iso, num, pool, to_min, today

router = APIRouter(prefix="/api", tags=["rezervari"])
HOUR_RE = re.compile(r"^([01]\d|2[0-3]):[03]0$|^24:00$")


def booking_json(b) -> dict:
    s = b["snapshot"]
    cancelled = b["status"] == "anulată"
    return {
        "id": b["id"], "code": b["code"], "listingId": b["listing_id"], "listingTitle": s["listingTitle"], "address": s["address"],
        "img": s["img"], "ownerName": s["ownerName"], "ownerPhone": s["ownerPhone"], "userId": b["user_id"], "userName": b["user_name"],
        "ticketEmail": b["ticket_email"], "days": [d.isoformat() for d in sorted(b["days"])], "from": b["hour_from"], "to": b["hour_to"],
        "hours": num(b["hours"]), "unit": s["unit"], "price": s["price"], "line": b["line"], "total": num(b["total"]),
        "status": b["status"], "createdAt": iso(b["created_at"]), "payment": b["payment"],
        "cancelledAt": iso(b["cancelled_at"]), "cancelReason": b["cancel_reason"],
        "refund": {"amount": num(b["total"]), "at": iso(b["cancelled_at"])} if cancelled else None,
    }


def booking_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "SP-" + "".join(secrets.choice(alphabet) for _ in range(6))


# ---------- Rezervări ----------

class Plata(BaseModel):
    """Plată demo: cardul se validează în browser, aici ajung doar tipul, ultimele 4 cifre și titularul."""
    brand: str = Field(max_length=40)
    last4: str = Field(pattern=r"^\d{4}$")
    holder: str = Field(min_length=3, max_length=100)


class RezervareNoua(BaseModel):
    listingId: int
    days: list[date] = Field(min_length=1, max_length=400)
    hourFrom: str | None = None
    hourTo: str | None = None
    ticketEmail: str = Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
    payment: Plata


@router.get("/rezervari")
async def rezervarile_mele(request: Request, u=Depends(current_user)):
    """Rezervările făcute de mine și cele primite la anunțurile mele."""
    async with pool(request).connection() as conn:
        mine = await fetch_all(conn, "SELECT * FROM rezervari WHERE user_id = %s ORDER BY created_at DESC", (u["id"],))
        recv = await fetch_all(conn, """
            SELECT r.* FROM rezervari r JOIN anunturi a ON a.id = r.listing_id
            WHERE r.owner_id = %s ORDER BY r.created_at DESC
        """, (u["id"],))
    return {"mine": [booking_json(b) for b in mine], "received": [booking_json(b) for b in recv]}


@router.post("/rezervari", status_code=201)
async def rezerva(b: RezervareNoua, request: Request, u=Depends(current_user)):
    days, t0 = sorted(set(b.days)), today()
    async with pool(request).connection() as conn:
        # FOR UPDATE: două rezervări simultane nu pot lua aceeași zi.
        x = await fetch_one(conn, "SELECT * FROM anunturi WHERE id = %s FOR UPDATE", (b.listingId,))
        if not x:
            raise HTTPException(404, "Anunțul a fost retras.")
        if x["owner_id"] == u["id"]:
            raise HTTPException(400, "Nu îți poți rezerva propriul anunț.")
        avail = set(x["avail"])
        if any(d < t0 or d not in avail for d in days):
            raise HTTPException(409, "Unele zile tocmai au fost rezervate. Alege din nou.")
        price, unit, hours, hf, ht = float(x["price"]), x["unit"], 0.0, None, None
        if unit == "zi":
            qty = len(days)
            line = f"{qty} {'zi' if qty == 1 else 'zile'} × {fmt_lei(price)}"
        elif unit == "lună":
            qty = math.ceil(len(days) / 30)
            line = f"{qty} {'lună' if qty == 1 else 'luni'} × {fmt_lei(price)} ({len(days)} zile; se plătește fiecare lună începută)"
        else:
            hf, ht = b.hourFrom or "", b.hourTo or ""
            if not HOUR_RE.match(hf) or not HOUR_RE.match(ht) or hf == ht:
                raise HTTPException(422, "Alege un interval orar valid.")
            mins = to_min(ht) - to_min(hf)
            hours = (mins if mins > 0 else mins + 1440) / 60
            w = access_window(x["access"])
            if w:
                a = to_min(hf)
                if a < w[0]:
                    a += 1440
                if a < w[0] or a + hours * 60 > w[1]:
                    raise HTTPException(422, f"Alege un interval în programul de acces: {x['access']}.")
            qty = hours * len(days)
            line = f"{len(days)} {'zi' if len(days) == 1 else 'zile'} × {fmt_num(hours, 1)} h × {fmt_lei(price)}"
        total = round(qty * price, 2)
        img = x["img_urls"][0] if x["img_urls"] else None
        if not img:
            p = await fetch_one(conn, "SELECT id FROM poze WHERE anunt_id = %s ORDER BY pos LIMIT 1", (x["id"],))
            img = f"/api/poze/{p['id']}" if p else ""
        snapshot = {"listingTitle": x["title"], "address": f"{x['address']}, {x['location']}", "img": img,
                    "ownerName": x["owner_name"], "ownerPhone": x["owner_phone"], "unit": unit, "price": num(x["price"])}
        payment = {"txn": "TXN-" + format(int(_time.time() * 1000), "X"), "brand": b.payment.brand, "last4": b.payment.last4,
                   "holder": b.payment.holder.strip(), "paidAt": None}
        await conn.execute("UPDATE anunturi SET avail = %s WHERE id = %s", (sorted(avail - set(days)), x["id"]))
        row = await fetch_one(conn, """
            INSERT INTO rezervari (code, listing_id, owner_id, user_id, user_name, ticket_email, days, hour_from, hour_to, hours, total, line, snapshot, payment)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """, (booking_code(), x["id"], x["owner_id"], u["id"], u["name"], b.ticketEmail.strip(), days, hf, ht, hours, total, line, Jsonb(snapshot), Jsonb(payment)))
        row["payment"]["paidAt"] = iso(row["created_at"])
        await conn.execute("UPDATE rezervari SET payment = %s WHERE id = %s", (Jsonb(row["payment"]), row["id"]))
        await notify_support(conn, u["id"], f"✅ Rezervarea {row['code']} e confirmată: „{x['title']}”, {fmt_ranges(days)}{f', {hf}–{ht}' if hf else ''}. Ai plătit {fmt_lei(total)}. Biletul îl găsești în „Contul meu”.")
        return booking_json(row)


@router.post("/rezervari/{booking_id}/anuleaza")
async def anuleaza(booking_id: int, request: Request, u=Depends(current_user)):
    """Anulare gratuită până în prima zi a rezervării, inclusiv; zilele redevin libere."""
    async with pool(request).connection() as conn:
        r = await fetch_one(conn, "SELECT * FROM rezervari WHERE id = %s AND user_id = %s FOR UPDATE", (booking_id, u["id"]))
        if not r:
            raise HTTPException(404, "Rezervarea nu există.")
        if r["status"] != "confirmată" or min(r["days"]) < today():
            raise HTTPException(400, "Rezervarea nu mai poate fi anulată.")
        r = await fetch_one(conn, "UPDATE rezervari SET status = 'anulată', cancelled_at = now() WHERE id = %s RETURNING *", (booking_id,))
        await conn.execute("""
            UPDATE anunturi SET avail = ARRAY(SELECT DISTINCT d FROM unnest(avail || %s::date[]) d ORDER BY d) WHERE id = %s
        """, ([d for d in r["days"] if d >= today()], r["listing_id"]))
        await notify_support(conn, u["id"], f"Rezervarea {r['code']} („{r['snapshot']['listingTitle']}”) a fost anulată. Rambursarea de {fmt_lei(r['total'])} a fost inițiată.")
        return booking_json(r)


# ---------- Recenzii ----------

class RecenzieNoua(BaseModel):
    bookingId: int
    type: Literal["listing", "guest"]
    stars: int = Field(ge=1, le=5)
    hostStars: int | None = Field(default=None, ge=1, le=5)
    comment: str = Field(default="", max_length=500)


def review_json(r) -> dict:
    return {"id": r["id"], "type": r["type"], "bookingId": r["booking_id"], "listingId": r["listing_id"], "ownerKey": r["owner_key"],
            "guestId": r["guest_id"], "guestName": r["guest_name"], "authorName": r["author_name"], "stars": r["stars"],
            "hostStars": r["host_stars"], "comment": r["comment"], "createdAt": iso(r["created_at"])}


def short_name(n: str) -> str:
    p = n.split()
    return f"{p[0]} {p[-1][0]}." if len(p) > 1 else p[0]


@router.get("/recenzii")
async def recenzii(request: Request):
    async with pool(request).connection() as conn:
        return [review_json(r) for r in await fetch_all(conn, "SELECT * FROM recenzii ORDER BY created_at DESC")]


@router.post("/recenzii", status_code=201)
async def lasa_recenzie(b: RecenzieNoua, request: Request, u=Depends(current_user)):
    """Chiriașul notează spațiul și gazda; proprietarul notează clientul. O recenzie de fiecare tip per rezervare."""
    async with pool(request).connection() as conn:
        r = await fetch_one(conn, "SELECT * FROM rezervari WHERE id = %s", (b.bookingId,))
        allowed = r and (r["user_id"] == u["id"] if b.type == "listing" else r["owner_id"] == u["id"])
        if not allowed:
            raise HTTPException(404, "Rezervarea nu există.")
        if r["status"] != "confirmată" or min(r["days"]) > today():
            raise HTTPException(400, "Poți lăsa o recenzie după ce începe rezervarea.")
        if b.type == "listing" and not b.hostStars:
            raise HTTPException(422, "Alege de la 1 la 5 stele pentru gazdă.")
        owner_key = f"u{r['owner_id']}" if r["owner_id"] else "seed:" + r["snapshot"]["ownerName"]
        row = await fetch_one(conn, """
            INSERT INTO recenzii (type, booking_id, listing_id, owner_key, guest_id, guest_name, author_id, author_name, stars, host_stars, comment)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (booking_id, type) DO NOTHING RETURNING *
        """, (b.type, r["id"], r["listing_id"], owner_key if b.type == "listing" else None,
              r["user_id"] if b.type == "guest" else None, r["user_name"] if b.type == "guest" else None,
              u["id"], short_name(u["name"]), b.stars, b.hostStars if b.type == "listing" else None, b.comment.strip()))
        if not row:
            raise HTTPException(409, "Ai lăsat deja această recenzie.")
        return review_json(row)
