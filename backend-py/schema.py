"""Tabelele aplicației SPAȚIU și datele demo cu care pornește."""

from datetime import timedelta

from psycopg.types.json import Jsonb

from util import today

SCHEMA = """
CREATE TABLE IF NOT EXISTS utilizatori (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    phone             TEXT,
    salt              TEXT NOT NULL,
    pass_hash         TEXT NOT NULL,
    terms_version     TEXT NOT NULL,
    terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    newsletter        BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sesiuni (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES utilizatori(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS anunturi (
    id            SERIAL PRIMARY KEY,
    owner_id      INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,  -- NULL = anunț demo
    owner_name    TEXT NOT NULL,
    owner_phone   TEXT NOT NULL,
    owner_since   TEXT NOT NULL,
    title         TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('storage', 'event', 'work', 'leisure')),
    price         NUMERIC(10, 2) NOT NULL CHECK (price > 0),
    unit          TEXT NOT NULL CHECK (unit IN ('lună', 'zi', 'oră')),
    area          NUMERIC(10, 2) NOT NULL CHECK (area > 0),
    county        TEXT NOT NULL,
    city          TEXT NOT NULL,
    location      TEXT NOT NULL,
    address       TEXT NOT NULL,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    geo           TEXT NOT NULL DEFAULT 'ok',
    noise         TEXT NOT NULL,
    access        TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    rules         TEXT[] NOT NULL DEFAULT '{}',
    safety        JSONB NOT NULL,
    declaration   JSONB,
    img_urls      TEXT[] NOT NULL DEFAULT '{}',   -- poze externe (anunțurile demo)
    avail         DATE[] NOT NULL DEFAULT '{}',   -- zilele în care spațiul e liber
    contract_name TEXT,
    contract_mime TEXT,
    contract_size INTEGER,
    contract_data BYTEA,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS poze (
    id        SERIAL PRIMARY KEY,
    anunt_id  INTEGER NOT NULL REFERENCES anunturi(id) ON DELETE CASCADE,
    pos       INTEGER NOT NULL,
    mime      TEXT NOT NULL,
    data      BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poze_anunt ON poze (anunt_id, pos);
CREATE TABLE IF NOT EXISTS rezervari (
    id            SERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    listing_id    INTEGER NOT NULL,             -- fără FK: rezervarea rămâne și dacă anunțul e retras
    owner_id      INTEGER,
    user_id       INTEGER NOT NULL REFERENCES utilizatori(id) ON DELETE CASCADE,
    user_name     TEXT NOT NULL,
    ticket_email  TEXT NOT NULL,
    days          DATE[] NOT NULL,
    hour_from     TEXT,
    hour_to       TEXT,
    hours         NUMERIC(6, 2) NOT NULL DEFAULT 0,
    total         NUMERIC(12, 2) NOT NULL,
    line          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'confirmată',
    snapshot      JSONB NOT NULL,               -- titlu, adresă, poză, proprietar, preț la momentul rezervării
    payment       JSONB NOT NULL,
    cancelled_at  TIMESTAMPTZ,
    cancel_reason TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rezervari_user ON rezervari (user_id);
CREATE INDEX IF NOT EXISTS idx_rezervari_owner ON rezervari (owner_id);
CREATE TABLE IF NOT EXISTS recenzii (
    id          SERIAL PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('listing', 'guest')),
    booking_id  INTEGER,
    listing_id  INTEGER NOT NULL,
    owner_key   TEXT,
    guest_id    INTEGER,
    guest_name  TEXT,
    author_id   INTEGER,
    author_name TEXT NOT NULL,
    stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    host_stars  INTEGER CHECK (host_stars BETWEEN 1 AND 5),
    comment     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, type)
);
CREATE TABLE IF NOT EXISTS conversatii (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES utilizatori(id) ON DELETE CASCADE,  -- cine a scris primul
    owner_id     INTEGER,             -- proprietarul anunțului; NULL = anunț demo sau suport
    listing_id   INTEGER,             -- NULL = conversația cu Echipa SPAȚIU
    owner_name   TEXT NOT NULL,
    user_unread  INTEGER NOT NULL DEFAULT 0,
    owner_unread INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_listing ON conversatii (user_id, listing_id) WHERE listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_suport ON conversatii (user_id) WHERE listing_id IS NULL;
CREATE TABLE IF NOT EXISTS mesaje (
    id         SERIAL PRIMARY KEY,
    conv_id    INTEGER NOT NULL REFERENCES conversatii(id) ON DELETE CASCADE,
    sender_id  INTEGER,               -- NULL = mesaj automat (suport / proprietar demo)
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mesaje_conv ON mesaje (conv_id, id);
"""

# ---------- Date demo (aceleași ca în frontend-ul inițial) ----------

U = "https://images.unsplash.com/"
SEED_LISTINGS = [
    dict(title="Garaj mare pentru depozitare", type="storage", price=350, unit="lună", area=32, county="București", city="Sector 3", location="București · Titan", address="Str. Liviu Rebreanu nr. 17, Sector 3", lat=44.421, lng=26.154, noise="≤55 dB", access="24/7",
         img=U + "photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80", desc="Spațiu uscat, securizat, acces cu mașina.",
         owner=("Andrei Popescu", "0700 000 101", "2023"), safety=dict(isu=False, isuNo="", extinguisher=True, evacuation=False, smoke=False), rules=[]),
    dict(title="Casă cu curte pentru petreceri", type="event", price=750, unit="zi", area=180, county="București", city="Sector 1", location="București · Băneasa", address="Str. Nordului nr. 52, Sector 1", lat=44.512, lng=26.079, noise="≤80 dB", access="10:00–01:00",
         img=U + "photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=800&q=80", desc="Curte mare, terasă și bucătărie. Potrivită pentru evenimente private.",
         owner=("Maria Ionescu", "0700 000 102", "2022"), safety=dict(isu=True, isuNo="2107 din 12.05.2025", extinguisher=True, evacuation=True, smoke=True),
         rules=["Fumatul doar în curte", "Muzica se oprește la ora 01:00", "Spațiul se predă curat"]),
    dict(title="Boxă de depozitare securizată", type="storage", price=180, unit="lună", area=12, county="București", city="Sector 6", location="București · Militari", address="Bd. Iuliu Maniu nr. 104, Sector 6", lat=44.433, lng=26.006, noise="Fără limită", access="24/7",
         img=U + "photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=800&q=80", desc="Boxă individuală, cameră supravegheată video.",
         owner=("Radu Stan", "0700 000 103", "2024"), safety=dict(isu=True, isuNo="", extinguisher=True, evacuation=True, smoke=True), rules=[]),
    dict(title="Studio pentru lucru / foto", type="work", price=120, unit="oră", area=55, county="București", city="Sector 3", location="București · Centru", address="Str. Academiei nr. 9, Sector 3", lat=44.435, lng=26.101, noise="≤65 dB", access="08:00–22:00",
         img=U + "photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80", desc="Studio luminos cu Wi-Fi rapid, mese și fundal foto.",
         owner=("Ioana Dumitru", "0700 000 104", "2023"), safety=dict(isu=True, isuNo="", extinguisher=True, evacuation=True, smoke=False), rules=["Pantofii se lasă la intrare"]),
    dict(title="Curte privată pentru activități", type="leisure", price=300, unit="zi", area=400, county="Ilfov", city="Otopeni", location="București · Otopeni", address="Str. Zborului nr. 21", lat=44.548, lng=26.072, noise="≤65 dB", access="09:00–22:00",
         img=U + "photo-1558521958-0a228e77e984?auto=format&fit=crop&w=800&q=80", desc="Spațiu verde privat pentru grupuri mici și activități.",
         owner=("Mihai Georgescu", "0700 000 105", "2024"), safety=dict(isu=False, isuNo="", extinguisher=True, evacuation=False, smoke=False), rules=[]),
    dict(title="Depozit 80 m² cu acces auto", type="storage", price=900, unit="lună", area=80, county="Ilfov", city="Chitila", location="București · Chitila", address="Str. Gării nr. 8", lat=44.478, lng=25.974, noise="Fără limită", access="24/7",
         img=U + "photo-1586528116493-da8b7c3d6b2d?auto=format&fit=crop&w=800&q=80", desc="Ideal pentru materiale, mobilier sau marfă. Acces auto direct.",
         owner=("Cristina Matei", "0700 000 106", "2021"), safety=dict(isu=True, isuNo="", extinguisher=True, evacuation=True, smoke=False), rules=[]),
]

SEED_REVIEWS = [
    (0, "Elena M.", 5, 5, "Garaj curat și uscat, acces ușor cu mașina. Andrei a răspuns repede la mesaje.", "2026-08-14"),
    (0, "Vlad C.", 4, 5, "Exact ce scria în anunț. Ușa e puțin grea, dar în rest totul perfect.", "2026-07-02"),
    (1, "Ioana T.", 5, 5, "Am făcut aici ziua de naștere a fiicei mele. Curtea e superbă, Maria a fost foarte de treabă.", "2026-09-06"),
    (1, "Radu P.", 4, 4, "Spațiu foarte bun pentru petreceri. Parcarea e cam mică pentru mulți invitați.", "2026-08-23"),
    (1, "Cristi D.", 5, 5, "Totul impecabil, ne întoarcem sigur.", "2026-06-30"),
    (2, "Mihaela S.", 4, 4, "Boxă sigură, cu cameră. Programul non-stop e un mare plus.", "2026-09-11"),
    (3, "Andreea F.", 5, 5, "Lumină naturală excelentă pentru fotografie. Recomand!", "2026-09-20"),
    (3, "George L.", 5, 4, "Studio foarte bine echipat, Wi-Fi rapid.", "2026-08-05"),
    (4, "Bianca R.", 4, 5, "Curte mare și liniștită, am organizat un picnic pentru firmă.", "2026-07-19"),
    (5, "Sorin N.", 5, 5, "Am depozitat mobila pe durata renovării. Acces auto direct, foarte practic.", "2026-05-28"),
]


async def init_db(conn):
    """Creează tabelele și, dacă nu există niciun anunț, adaugă anunțurile și recenziile demo."""
    await conn.execute(SCHEMA)
    cur = await conn.execute("SELECT count(*) FROM anunturi")
    if (await cur.fetchone())[0]:
        return
    t0, ids = today(), []
    for n, s in enumerate(SEED_LISTINGS, start=1):
        # Disponibilitate demo: următoarele 120 de zile, cu câteva zile ocupate.
        avail = [t0 + timedelta(days=i) for i in range(120) if s["type"] == "storage" or (i * 7 + n * 3) % 10 > 2]
        name, phone, since = s["owner"]
        cur = await conn.execute("""
            INSERT INTO anunturi (owner_name, owner_phone, owner_since, title, type, price, unit, area, county, city, location,
                address, lat, lng, noise, access, description, rules, safety, img_urls, avail)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (name, phone, since, s["title"], s["type"], s["price"], s["unit"], s["area"], s["county"], s["city"], s["location"],
              s["address"], s["lat"], s["lng"], s["noise"], s["access"], s["desc"], s["rules"], Jsonb(s["safety"]), [s["img"]], avail))
        ids.append((await cur.fetchone())[0])
    for i, author, stars, host, text, d in SEED_REVIEWS:
        await conn.execute("""
            INSERT INTO recenzii (type, listing_id, owner_key, author_name, stars, host_stars, comment, created_at)
            VALUES ('listing', %s, %s, %s, %s, %s, %s, %s)
        """, (ids[i], "seed:" + SEED_LISTINGS[i]["owner"][0], author, stars, host, text, d + "T12:00:00+03:00"))
