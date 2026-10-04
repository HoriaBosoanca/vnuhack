"""Mesageria: conversații chiriaș ↔ proprietar și conversația cu Echipa SPAȚIU."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from util import current_user, fetch_all, fetch_one, iso, pool

router = APIRouter(prefix="/api/conversatii", tags=["mesaje"])
SUPORT = "Echipa SPAȚIU"


async def notify_support(conn, user_id: int, text: str):
    """Trimite un mesaj automat de la Echipa SPAȚIU (confirmări de rezervare, bun venit etc.)."""
    c = await fetch_one(conn, "SELECT id FROM conversatii WHERE user_id = %s AND listing_id IS NULL", (user_id,))
    if not c:
        c = await fetch_one(conn, "INSERT INTO conversatii (user_id, owner_name) VALUES (%s, %s) RETURNING id", (user_id, SUPORT))
    await conn.execute("INSERT INTO mesaje (conv_id, text) VALUES (%s, %s)", (c["id"], text))
    await conn.execute("UPDATE conversatii SET user_unread = user_unread + 1 WHERE id = %s", (c["id"],))


async def conversations_for(conn, me: int, only_id: int | None = None) -> list[dict]:
    """Conversațiile utilizatorului (ca chiriaș sau ca proprietar), din perspectiva lui."""
    rows = await fetch_all(conn, """
        SELECT c.*, u.name AS user_name FROM conversatii c JOIN utilizatori u ON u.id = c.user_id
        WHERE (c.user_id = %s OR c.owner_id = %s) AND (%s::int IS NULL OR c.id = %s)
    """, (me, me, only_id, only_id))
    if not rows:
        return []
    msgs = await fetch_all(conn, "SELECT * FROM mesaje WHERE conv_id = ANY(%s) ORDER BY id", ([r["id"] for r in rows],))
    out = []
    for c in rows:
        is_user = c["user_id"] == me
        out.append({
            "id": c["id"],
            "with": c["owner_name"] if is_user else c["user_name"],
            "listingId": c["listing_id"],
            "unread": c["user_unread"] if is_user else c["owner_unread"],
            "created": iso(c["created_at"]),
            "messages": [{"from": "me" if m["sender_id"] == me else "them", "text": m["text"], "t": iso(m["created_at"])}
                         for m in msgs if m["conv_id"] == c["id"]],
        })
    return out


SUPORT_SALUT = "Bună! Dacă ai orice problemă sau întâmpini orice dificultate pe platformă, contactează-ne aici și te ajutăm."


# ---------- Endpoint-uri ----------

class ConvNoua(BaseModel):
    listingId: int


class MesajNou(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.get("")
async def lista(request: Request, u=Depends(current_user)):
    async with pool(request).connection() as conn:
        return await conversations_for(conn, u["id"])


@router.post("")
async def deschide(body: ConvNoua, request: Request, u=Depends(current_user)):
    """Deschide (sau găsește) conversația cu proprietarul unui anunț."""
    async with pool(request).connection() as conn:
        x = await fetch_one(conn, "SELECT id, owner_id, owner_name FROM anunturi WHERE id = %s", (body.listingId,))
        if not x:
            raise HTTPException(404, "Anunțul a fost retras.")
        if x["owner_id"] == u["id"]:
            raise HTTPException(400, "Acesta este anunțul tău.")
        c = await fetch_one(conn, """
            INSERT INTO conversatii (user_id, owner_id, listing_id, owner_name) VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, listing_id) WHERE listing_id IS NOT NULL DO UPDATE SET owner_name = EXCLUDED.owner_name
            RETURNING id
        """, (u["id"], x["owner_id"], x["id"], x["owner_name"]))
        return (await conversations_for(conn, u["id"], c["id"]))[0]


@router.post("/suport")
async def suport(request: Request, u=Depends(current_user)):
    """„Ai nevoie de ajutor?”: deschide (sau creează, cu un mesaj de salut) conversația cu Echipa SPAȚIU."""
    async with pool(request).connection() as conn:
        c = await fetch_one(conn, "SELECT id FROM conversatii WHERE user_id = %s AND listing_id IS NULL", (u["id"],))
        if not c:
            c = await fetch_one(conn, "INSERT INTO conversatii (user_id, owner_name) VALUES (%s, %s) RETURNING id", (u["id"], SUPORT))
            await conn.execute("INSERT INTO mesaje (conv_id, text) VALUES (%s, %s)", (c["id"], SUPORT_SALUT))
        return (await conversations_for(conn, u["id"], c["id"]))[0]


@router.post("/{conv_id}/mesaje")
async def trimite(conv_id: int, body: MesajNou, request: Request, u=Depends(current_user)):
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Mesajul e gol.")
    async with pool(request).connection() as conn:
        c = await fetch_one(conn, "SELECT * FROM conversatii WHERE id = %s AND (user_id = %s OR owner_id = %s)", (conv_id, u["id"], u["id"]))
        if not c:
            raise HTTPException(404, "Conversația nu există.")
        await conn.execute("INSERT INTO mesaje (conv_id, sender_id, text) VALUES (%s, %s, %s)", (conv_id, u["id"], text))
        other = "owner_unread" if c["user_id"] == u["id"] else "user_unread"
        await conn.execute(f"UPDATE conversatii SET {other} = {other} + 1 WHERE id = %s", (conv_id,))
        return (await conversations_for(conn, u["id"], conv_id))[0]


@router.post("/{conv_id}/citit")
async def citit(conv_id: int, request: Request, u=Depends(current_user)):
    async with pool(request).connection() as conn:
        await conn.execute("""
            UPDATE conversatii SET
              user_unread  = CASE WHEN user_id  = %(me)s THEN 0 ELSE user_unread END,
              owner_unread = CASE WHEN owner_id = %(me)s THEN 0 ELSE owner_unread END
            WHERE id = %(id)s
        """, {"me": u["id"], "id": conv_id})
    return {"ok": True}
