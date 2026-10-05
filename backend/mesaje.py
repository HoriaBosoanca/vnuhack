"""Mesageria: conversații chiriaș ↔ proprietar și conversația cu Echipa SPAȚIU."""

import os

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from util import current_user, fetch_all, fetch_one, iso, pool

router = APIRouter(prefix="/api/conversatii", tags=["mesaje"])
SUPORT = "Echipa SPAȚIU"
# Contul echipei: cine se loghează pe el vede toate conversațiile de suport și răspunde ca „Echipa SPAȚIU”.
# Dacă nu există un utilizator cu acest id, conversațiile de suport rămân fără cont (owner_id NULL), ca înainte.
SUPPORT_ID: int | None = int(os.environ.get("SUPPORT_USER_ID", "16") or 0) or None


async def link_support(conn):
    """La pornire: leagă de contul echipei conversațiile și mesajele automate făcute înainte să existe contul."""
    global SUPPORT_ID
    if SUPPORT_ID and not await fetch_one(conn, "SELECT 1 FROM utilizatori WHERE id = %s", (SUPPORT_ID,)):
        SUPPORT_ID = None
    if not SUPPORT_ID:
        return
    sid = {"sid": SUPPORT_ID}
    # Conversația de suport a contului echipei cu el însuși nu are sens.
    await conn.execute("DELETE FROM conversatii WHERE user_id = %(sid)s AND owner_id IS NULL AND listing_id IS NULL", sid)
    # Dacă un utilizator are deja și o conversație directă cu contul echipei, le unim: mesajele trec în cea directă.
    await conn.execute("""
        UPDATE mesaje m SET conv_id = d.id FROM conversatii s, conversatii d
        WHERE m.conv_id = s.id AND s.owner_id IS NULL AND s.listing_id IS NULL
          AND d.listing_id IS NULL AND d.owner_id IS NOT NULL
          AND LEAST(d.user_id, d.owner_id) = LEAST(s.user_id, %(sid)s) AND GREATEST(d.user_id, d.owner_id) = GREATEST(s.user_id, %(sid)s)
    """, sid)
    await conn.execute("""
        DELETE FROM conversatii s WHERE s.owner_id IS NULL AND s.listing_id IS NULL AND NOT EXISTS (SELECT 1 FROM mesaje WHERE conv_id = s.id)
          AND EXISTS (SELECT 1 FROM conversatii d WHERE d.listing_id IS NULL AND d.owner_id IS NOT NULL
                      AND LEAST(d.user_id, d.owner_id) = LEAST(s.user_id, %(sid)s) AND GREATEST(d.user_id, d.owner_id) = GREATEST(s.user_id, %(sid)s))
    """, sid)
    await conn.execute("UPDATE conversatii SET owner_id = %(sid)s WHERE owner_id IS NULL AND listing_id IS NULL", sid)
    await conn.execute("""
        UPDATE mesaje m SET sender_id = %(sid)s FROM conversatii c
        WHERE m.conv_id = c.id AND m.sender_id IS NULL AND c.listing_id IS NULL AND %(sid)s IN (c.user_id, c.owner_id)
    """, sid)


async def support_conv(conn, user_id: int):
    """Conversația utilizatorului cu Echipa SPAȚIU (o creează dacă nu există). Întoarce (conversația, nou_creată)."""
    if SUPPORT_ID:
        c = await fetch_one(conn, """
            SELECT id, user_id FROM conversatii WHERE listing_id IS NULL
              AND ((user_id = %(u)s AND owner_id = %(s)s) OR (user_id = %(s)s AND owner_id = %(u)s))
        """, {"u": user_id, "s": SUPPORT_ID})
    else:
        c = await fetch_one(conn, "SELECT id, user_id FROM conversatii WHERE user_id = %s AND listing_id IS NULL AND owner_id IS NULL", (user_id,))
    if c:
        return c, False
    c = await fetch_one(conn, "INSERT INTO conversatii (user_id, owner_id, owner_name) VALUES (%s, %s, %s) RETURNING id, user_id",
                        (user_id, SUPPORT_ID, SUPORT))
    return c, True


async def notify_support(conn, user_id: int, text: str):
    """Trimite un mesaj automat de la Echipa SPAȚIU (confirmări de rezervare, bun venit etc.), de pe contul echipei."""
    if user_id == SUPPORT_ID:
        return
    c, _ = await support_conv(conn, user_id)
    await conn.execute("INSERT INTO mesaje (conv_id, sender_id, text) VALUES (%s, %s, %s)", (c["id"], SUPPORT_ID, text))
    side = "user_unread" if c["user_id"] == user_id else "owner_unread"
    await conn.execute(f"UPDATE conversatii SET {side} = {side} + 1 WHERE id = %s", (c["id"],))


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
        team = c["listing_id"] is None and SUPPORT_ID is not None and SUPPORT_ID in (c["user_id"], c["owner_id"])  # conversație cu Echipa SPAȚIU
        out.append({
            "id": c["id"],
            "with": SUPORT if team and me != SUPPORT_ID else c["owner_name"] if is_user else c["user_name"],
            "listingId": c["listing_id"],
            # mesaj direct din pagina de profil; conversațiile cu Echipa SPAȚIU rămân „Suport”
            "direct": c["listing_id"] is None and c["owner_id"] is not None and not team,
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


class ConvDirecta(BaseModel):
    userId: int


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
    if u["id"] == SUPPORT_ID:
        raise HTTPException(400, "Ești pe contul Echipei SPAȚIU: conversațiile de suport le vezi în „Mesaje”.")
    async with pool(request).connection() as conn:
        c, nou = await support_conv(conn, u["id"])
        if nou:
            await conn.execute("INSERT INTO mesaje (conv_id, sender_id, text) VALUES (%s, %s, %s)", (c["id"], SUPPORT_ID, SUPORT_SALUT))
        return (await conversations_for(conn, u["id"], c["id"]))[0]


@router.post("/direct")
async def direct(body: ConvDirecta, request: Request, u=Depends(current_user)):
    """„Trimite mesaj” din profilul unui utilizator: o singură conversație între doi utilizatori, fără anunț."""
    if body.userId == u["id"]:
        raise HTTPException(400, "Acesta este profilul tău.")
    async with pool(request).connection() as conn:
        peer = await fetch_one(conn, "SELECT id, name FROM utilizatori WHERE id = %s", (body.userId,))
        if not peer:
            raise HTTPException(404, "Utilizatorul nu există.")
        c = await fetch_one(conn, """
            SELECT id FROM conversatii WHERE listing_id IS NULL
              AND ((user_id = %(a)s AND owner_id = %(b)s) OR (user_id = %(b)s AND owner_id = %(a)s))
        """, {"a": u["id"], "b": peer["id"]})
        if not c:
            c = await fetch_one(conn, "INSERT INTO conversatii (user_id, owner_id, owner_name) VALUES (%s, %s, %s) RETURNING id",
                                (u["id"], peer["id"], peer["name"]))
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
