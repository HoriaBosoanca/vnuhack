"""Endpoint-ul POST /post pentru publicarea ofertelor de închiriere spații."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

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


class Zile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data_start: date = Field(alias="data start")
    data_end: date = Field(alias="data end")

    _parse = field_validator("data_start", "data_end", mode="before")(parse_data_ro)


class Ore(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ora_start: time = Field(alias="ora start")
    ora_end: time = Field(alias="ora end")


class Postare(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    id_ofertant: str
    taguri: list[str] = []
    data: date
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

    _parse_data = field_validator("data", mode="before")(parse_data_ro)

    @field_validator("taguri")
    @classmethod
    def curata_taguri(cls, v):
        # lowercase, fără spații în plus, fără duplicate (păstrând ordinea)
        return list(dict.fromkeys(t.strip().lower() for t in v if t.strip()))


# ---------- Endpoint ----------

@router.post("/post", status_code=201)
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
