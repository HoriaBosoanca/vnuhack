"""Endpoint-urile pentru postări: POST /post, GET /post, GET /post/{id_postare}."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from psycopg.rows import dict_row
from pydantic import (
    AliasChoices, BaseModel, BeforeValidator, ConfigDict, Field, WithJsonSchema, field_validator,
)

router = APIRouter()


# ---------- Modele ----------

def parse_data_ro(v):
    """Acceptă '4.10.2026' sau '04.10.2026' (zi.lună.an)."""
    if isinstance(v, date):
        return v
    try:
        return datetime.strptime(str(v).strip(), "%d.%m.%Y").date()
    except ValueError:
        raise ValueError(f"Dată invalidă '{v}', formatul așteptat e ZZ.LL.AAAA")


# Tipuri cu schema din docs ca în api-structure/post.json, nu ISO
DataRo = Annotated[
    date,
    BeforeValidator(parse_data_ro),
    WithJsonSchema({"type": "string", "description": "ZZ.LL.AAAA", "examples": ["4.10.2026"]}),
]
OraRo = Annotated[
    time,
    WithJsonSchema({"type": "string", "description": "HH:MM", "examples": ["12:00"]}),
]

EXEMPLU_POSTARE = {
    "id_ofertant": "ofertant123",
    "taguri": ["escape room", "party"],
    "data": "4.10.2026",
    "titlu": "Oferta escape room",
    "descriere": "Adresa este ..., e ff frumos, reguli ...",
    "tip spatiu": "apartament",
    "suprafata": "100",
    "nr camere": "3",
    "zile": {"data start": "4.10.2026", "data end": "10.10.2026"},
    "ore": {"ora start": "12:00", "ora end": "18:00"},
    "pret pre unitate": "100",
    "unitate pret": "pe ora",
}


class Zile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data_start: DataRo = Field(alias="data start")
    data_end: DataRo = Field(alias="data end")


class Ore(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ora_start: OraRo = Field(alias="ora start")
    ora_end: OraRo = Field(alias="ora end")


class Postare(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        str_strip_whitespace=True,
        json_schema_extra={"examples": [EXEMPLU_POSTARE]},
    )

    id_ofertant: str
    taguri: list[str] = []
    data: DataRo
    titlu: str = Field(min_length=1, max_length=200)
    descriere: str = Field(min_length=1)
    tip_spatiu: Literal["apartament", "casa", "terasa", "teren"] = Field(alias="tip spatiu")
    suprafata: Decimal = Field(gt=0)
    nr_camere: int = Field(alias="nr camere", ge=0)
    zile: Zile
    ore: Ore
    pret_pe_unitate: Decimal = Field(
        validation_alias=AliasChoices("pret pe unitate", "pret pre unitate", "pret_pe_unitate"),
        ge=0,
    )
    unitate_pret: Literal["pe ora", "pe zi"] = Field(alias="unitate pret")

    @field_validator("taguri")
    @classmethod
    def curata_taguri(cls, v):
        # lowercase, fără spații în plus, fără duplicate (păstrând ordinea)
        return list(dict.fromkeys(t.strip().lower() for t in v if t.strip()))


class PostareCreata(BaseModel):
    id_postare: int
    created_at: datetime
    status: str


# ---------- Endpoint ----------

@router.post("/post", status_code=201, response_model=PostareCreata)
async def creeaza_postare(p: Postare, request: Request):
    zile, ore = p.zile, p.ore
    try:
        async with request.app.state.pool.connection() as conn:
            cur = await conn.execute(
                """
                INSERT INTO postari (
                    id_ofertant, taguri, data_publicare, titlu, descriere,
                    tip_spatiu, suprafata_m2, nr_camere,
                    data_start, data_end, ora_start, ora_end,
                    pret_unitate, unitate_pret
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id_postare, created_at
                """,
                (
                    p.id_ofertant, p.taguri, p.data, p.titlu, p.descriere,
                    p.tip_spatiu, p.suprafata, p.nr_camere,
                    zile.data_start, zile.data_end, ore.ora_start, ore.ora_end,
                    p.pret_pe_unitate, p.unitate_pret,
                ),
            )
            row = await cur.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la salvare: {e}")

    return {"id_postare": row[0], "created_at": row[1].isoformat(), "status": "publicat"}


# ---------- Citire ----------

SELECT_POSTARI = """
    SELECT id_postare, id_ofertant, taguri, data_publicare, titlu, descriere,
           tip_spatiu, suprafata_m2, nr_camere,
           data_start, data_end, ora_start, ora_end,
           pret_unitate, unitate_pret
    FROM postari
"""


def format_data_ro(d: date) -> str:
    return f"{d.day}.{d.month}.{d.year}"


def rand_in_postare(r) -> dict:
    """Transformă un rând din DB în formatul din api-structure/post.json."""
    return {
        "id_postare": r["id_postare"],
        "id_ofertant": r["id_ofertant"],
        "taguri": r["taguri"],
        "data": format_data_ro(r["data_publicare"]),
        "titlu": r["titlu"],
        "descriere": r["descriere"],
        "tip spatiu": r["tip_spatiu"],
        "suprafata": float(r["suprafata_m2"]),
        "nr camere": r["nr_camere"],
        "zile": {
            "data start": format_data_ro(r["data_start"]),
            "data end": format_data_ro(r["data_end"]),
        },
        "ore": {
            "ora start": r["ora_start"].strftime("%H:%M"),
            "ora end": r["ora_end"].strftime("%H:%M"),
        },
        "pret pre unitate": float(r["pret_unitate"]),
        "unitate pret": r["unitate_pret"],
    }


@router.get("/post")
async def listeaza_postari(request: Request):
    async with request.app.state.pool.connection() as conn:
        cur = conn.cursor(row_factory=dict_row)
        await cur.execute(SELECT_POSTARI + " ORDER BY created_at DESC")
        rows = await cur.fetchall()
    return [rand_in_postare(r) for r in rows]


@router.get("/post/{id_postare}")
async def citeste_postare(id_postare: int, request: Request):
    async with request.app.state.pool.connection() as conn:
        cur = conn.cursor(row_factory=dict_row)
        await cur.execute(SELECT_POSTARI + " WHERE id_postare = %s", (id_postare,))
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Postarea nu există")
    return rand_in_postare(row)
