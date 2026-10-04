"""Tabelele aplicației SPAȚIU."""

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
    owner_id      INTEGER REFERENCES utilizatori(id) ON DELETE SET NULL,
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
    owner_id     INTEGER,             -- proprietarul anunțului; NULL = conversația cu suportul
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
    sender_id  INTEGER,               -- NULL = mesaj automat de la Echipa SPAȚIU
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mesaje_conv ON mesaje (conv_id, id);
"""

# Scoate anunțurile demo adăugate de versiunile anterioare (singurele cu poze externe în img_urls)
# și recenziile lor (singurele fără rezervare). Nu face nimic dacă au fost deja scoase.
CLEANUP_DEMO = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'anunturi' AND column_name = 'img_urls') THEN
    DELETE FROM conversatii WHERE owner_id IS NULL AND listing_id IN (SELECT id FROM anunturi WHERE cardinality(img_urls) > 0);
    DELETE FROM anunturi WHERE owner_id IS NULL AND cardinality(img_urls) > 0;
    DELETE FROM recenzii WHERE booking_id IS NULL;
    ALTER TABLE anunturi DROP COLUMN img_urls;
  END IF;
END $$;
"""


async def init_db(conn):
    """Creează tabelele (dacă nu există)."""
    await conn.execute(SCHEMA)
    await conn.execute(CLEANUP_DEMO)
