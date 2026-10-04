"""Anunțurile: listare, publicare (cu poze și contract), retragere, poze și contract."""

import base64
import binascii
from datetime import date, datetime, timezone
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from auth import TERMS_VERSION, valid_phone
from mesaje import notify_support
from util import current_user, fetch_all, fetch_one, fmt_lei, num, pool, today

router = APIRouter(prefix="/api", tags=["anunturi"])
MAX_FILE = 10 * 1024 * 1024
CONTRACT_EXT = (".pdf", ".doc", ".docx", ".odt")

LISTING_COLS = """id, owner_id, owner_name, owner_phone, owner_since, title, type, price, unit, area, county, city, location,
    address, lat, lng, geo, noise, access, description, rules, safety, declaration, avail,
    contract_name, contract_size"""


def listing_json(x, photo_ids=()) -> dict:
    imgs = [f"/api/poze/{p}" for p in photo_ids]
    return {
        "id": x["id"], "title": x["title"], "type": x["type"], "price": num(x["price"]), "unit": x["unit"], "area": num(x["area"]),
        "county": x["county"], "city": x["city"], "location": x["location"], "address": x["address"],
        "lat": x["lat"], "lng": x["lng"], "geo": x["geo"], "noise": x["noise"], "access": x["access"], "desc": x["description"],
        "rules": x["rules"], "safety": x["safety"], "declaration": x["declaration"], "imgs": imgs, "img": imgs[0] if imgs else "",
        "avail": [d.isoformat() for d in sorted(x["avail"])],
        "owner": {"id": x["owner_id"], "name": x["owner_name"], "phone": x["owner_phone"], "since": x["owner_since"]},
        "contract": {"name": x["contract_name"], "size": x["contract_size"], "url": f"/api/anunturi/{x['id']}/contract"} if x["contract_name"] else None,
    }


async def load_listings(conn, listing_id: int | None = None) -> list[dict]:
    rows = await fetch_all(conn, f"SELECT {LISTING_COLS} FROM anunturi WHERE %s::int IS NULL OR id = %s ORDER BY created_at DESC, id DESC", (listing_id, listing_id))
    photos = await fetch_all(conn, "SELECT anunt_id, array_agg(id ORDER BY pos) AS ids FROM poze WHERE anunt_id = ANY(%s) GROUP BY anunt_id", ([r["id"] for r in rows],))
    by = {p["anunt_id"]: p["ids"] for p in photos}
    return [listing_json(r, by.get(r["id"], [])) for r in rows]


def parse_data_url(u: str, what: str) -> tuple[str, bytes]:
    """'data:image/jpeg;base64,....' → (mime, bytes)."""
    try:
        head, b64 = u.split(",", 1)
        mime = head[5:].split(";")[0] or "application/octet-stream"
        data = base64.b64decode(b64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, f"{what}: fișier invalid.")
    if len(data) > MAX_FILE:
        raise HTTPException(422, f"{what}: fișierul e mai mare de 10 MB.")
    return mime, data


# ---------- Modele ----------

class Siguranta(BaseModel):
    isu: bool = False
    isuNo: str = ""
    extinguisher: bool = False
    evacuation: bool = False
    smoke: bool = False


class Contract(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    data: str  # data URL


class AnuntNou(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: Literal["storage", "event", "work", "leisure"]
    price: float = Field(gt=0)
    unit: Literal["lună", "zi", "oră"]
    area: float = Field(gt=0)
    county: str = Field(min_length=1)
    city: str = Field(min_length=1)
    address: str = Field(min_length=5)
    lat: float
    lng: float
    geo: Literal["ok", "approx"] = "ok"
    phone: str
    noise: str = ""  # limita de zgomot nu mai apare în formular
    access: str
    desc: str = ""
    rules: list[str] = Field(default=[], max_length=20)
    safety: Siguranta
    avail: list[date] = Field(min_length=1)
    photos: list[str] = Field(min_length=1, max_length=10)  # data URL-uri
    contract: Contract | None = None
    riskAckAt: datetime


# ---------- Endpoint-uri ----------

@router.get("/anunturi")
async def lista(request: Request):
    async with pool(request).connection() as conn:
        return await load_listings(conn)


@router.post("/anunturi", status_code=201)
async def publica(b: AnuntNou, request: Request, u=Depends(current_user)):
    if not valid_phone(b.phone):
        raise HTTPException(422, "Număr invalid. Exemplu: 0722 123 456 sau +40 722 123 456.")
    photos = [parse_data_url(p, "Poza") for p in b.photos]
    if any(not m.startswith("image/") for m, _ in photos):
        raise HTTPException(422, "Pozele trebuie să fie imagini.")
    contract = None
    if b.contract:
        if not b.contract.name.lower().endswith(CONTRACT_EXT):
            raise HTTPException(422, "Contractul trebuie să fie PDF, DOC, DOCX sau ODT.")
        contract = (b.contract.name, *parse_data_url(b.contract.data, "Contractul"))
    contract_cols = (contract[0], contract[1], len(contract[2]), contract[2]) if contract else (None, None, None, None)
    county, city = b.county.strip(), b.city.strip()
    location = f"{city}, București" if county == "București" else f"{city}, jud. {county}"
    # Dovada declarației și a avertismentului de risc acceptate la publicare.
    declaration = {"at": datetime.now(timezone.utc).isoformat(), "termsVersion": TERMS_VERSION,
                   "riskWarning": {"at": b.riskAckAt.isoformat(), "valuablesRemoved": True, "risksAssumed": True, "platformNotLiable": True,
                                   "bodilyInjuryNotLiable": True}}
    rules = list(dict.fromkeys(r.strip()[:150] for r in b.rules if r.strip()))
    async with pool(request).connection() as conn:
        row = await fetch_one(conn, """
            INSERT INTO anunturi (owner_id, owner_name, owner_phone, owner_since, title, type, price, unit, area, county, city, location,
                address, lat, lng, geo, noise, access, description, rules, safety, declaration, avail,
                contract_name, contract_mime, contract_size, contract_data)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (u["id"], u["name"], b.phone.strip(), str(today().year), b.title.strip(), b.type, b.price, b.unit, b.area, county, city, location,
              b.address.strip(), b.lat, b.lng, b.geo, b.noise, b.access, b.desc.strip(), rules, Jsonb(b.safety.model_dump()), Jsonb(declaration),
              sorted(set(b.avail)), *contract_cols))
        for pos, (mime, data) in enumerate(photos):
            await conn.execute("INSERT INTO poze (anunt_id, pos, mime, data) VALUES (%s, %s, %s, %s)", (row["id"], pos, mime, data))
        return (await load_listings(conn, row["id"]))[0]


@router.delete("/anunturi/{listing_id}")
async def retrage(listing_id: int, request: Request, u=Depends(current_user)):
    """Șterge definitiv anunțul. Rezervările viitoare se anulează și se rambursează."""
    async with pool(request).connection() as conn:
        x = await fetch_one(conn, "SELECT id, owner_id, title FROM anunturi WHERE id = %s", (listing_id,))
        if not x:
            raise HTTPException(404, "Anunțul nu există.")
        if x["owner_id"] != u["id"]:
            raise HTTPException(403, "Doar proprietarul poate retrage anunțul.")
        cancelled = await fetch_all(conn, """
            UPDATE rezervari SET status = 'anulată', cancelled_at = now(), cancel_reason = 'Anunțul a fost retras de proprietar.'
            WHERE listing_id = %s AND status = 'confirmată' AND (SELECT min(d) FROM unnest(days) d) >= %s
            RETURNING user_id, code, total
        """, (listing_id, today()))
        for b in cancelled:
            await notify_support(conn, b["user_id"], f"Rezervarea {b['code']} („{x['title']}”) a fost anulată, pentru că proprietarul a retras anunțul. Rambursarea de {fmt_lei(b['total'])} a fost inițiată.")
        await conn.execute("DELETE FROM anunturi WHERE id = %s", (listing_id,))
    return {"cancelled": len(cancelled)}


@router.get("/poze/{photo_id}")
async def poza(photo_id: int, request: Request):
    async with pool(request).connection() as conn:
        p = await fetch_one(conn, "SELECT mime, data FROM poze WHERE id = %s", (photo_id,))
    if not p:
        raise HTTPException(404, "Poza nu există.")
    return Response(bytes(p["data"]), media_type=p["mime"], headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/anunturi/{listing_id}/contract")
async def contract(listing_id: int, request: Request):
    async with pool(request).connection() as conn:
        c = await fetch_one(conn, "SELECT contract_name, contract_mime, contract_data FROM anunturi WHERE id = %s", (listing_id,))
    if not c or not c["contract_data"]:
        raise HTTPException(404, "Anunțul nu are contract atașat.")
    return Response(bytes(c["contract_data"]), media_type=c["contract_mime"],
                    headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(c['contract_name'])}"})
