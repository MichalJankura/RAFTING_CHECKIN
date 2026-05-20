-- RAFTING DUNAJEC — PostgreSQL schema
-- Bezpecne spustatelne opakovane (IF NOT EXISTS)

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TABLE IF NOT EXISTS orders (
    id                    TEXT          PRIMARY KEY,
    number                INTEGER       NOT NULL UNIQUE DEFAULT nextval('order_number_seq'),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    arrival_at            TIMESTAMPTZ   NOT NULL,
    updated_at            TIMESTAMPTZ,
    operator              TEXT          NOT NULL DEFAULT '',
    status                TEXT          NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'complete')),
    completed_at          TIMESTAMPTZ,

    -- zakaznik (flat stlpce kvoli search/filter)
    cust_name             TEXT          NOT NULL,
    cust_surname          TEXT          NOT NULL,
    cust_country          TEXT          NOT NULL DEFAULT '',
    cust_id_type          TEXT          NOT NULL DEFAULT 'ID',
    cust_id_code          TEXT          NOT NULL DEFAULT '',
    cust_address          TEXT          NOT NULL DEFAULT '',
    cust_phone            TEXT          NOT NULL DEFAULT '',

    -- trasa a osoby
    route                 TEXT          NOT NULL,
    adults                INTEGER       NOT NULL DEFAULT 0,
    kids                  INTEGER       NOT NULL DEFAULT 0,

    -- financie
    manual_adjustment     NUMERIC(10,2) NOT NULL DEFAULT 0,
    manual_total_override NUMERIC(10,2),
    notes                 TEXT          NOT NULL DEFAULT '',

    -- polozky objednavky ako JSONB (heterogenne typy: BOAT, BIKE, INSTRUCTOR, atd.)
    lines                 JSONB         NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_orders_arrival_at  ON orders (arrival_at);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_number       ON orders (number DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cust_surname ON orders (cust_surname);
