-- schema-security.sql
-- Run once against the running database to apply all security hardening.
-- Safe to re-run (all statements are idempotent).
--
-- Run as: psql -U postgres -d rafting_dunajec -f /app/server/schema-security.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Least-privilege application user
-- ─────────────────────────────────────────────────────────────────────────────
-- The password here is a placeholder. The real password comes from the
-- Docker secret and is set via the entrypoint script (see docker-entrypoint.sh).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rafting_app') THEN
    -- Password will be reset by entrypoint from the secret file.
    CREATE USER rafting_app WITH PASSWORD 'change-me-via-secret';
  END IF;
END
$$;

-- Allow the app user to connect to the database
GRANT CONNECT ON DATABASE rafting_dunajec TO rafting_app;

-- Allow usage of the public schema
GRANT USAGE ON SCHEMA public TO rafting_app;

-- DML only — no DDL, no TRUNCATE, no superuser
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE orders TO rafting_app;

-- Sequence access required for INSERT (nextval) and the next-number endpoint
GRANT USAGE, SELECT ON SEQUENCE order_number_seq TO rafting_app;

-- Grants for the audit log table are issued after the table is created below.


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the surname B-tree index (useless after encryption)
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_orders_cust_surname;
-- The remaining indexes on arrival_at, status, and number are on non-encrypted
-- columns and remain fully functional.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Audit log table
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores who did what to which order and when.
-- Intentionally stores NO PII values — only order IDs and operator names.
-- A separate INSERT-only permission prevents the app from deleting audit rows.
CREATE TABLE IF NOT EXISTS order_audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    order_id    TEXT         NOT NULL,       -- references orders(id) loosely
    action      TEXT         NOT NULL        -- 'INSERT' | 'UPDATE' | 'DELETE'
                CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    operator    TEXT         NOT NULL DEFAULT '',
    changed_fields TEXT[]                    -- list of column names that changed (UPDATE only)
);

CREATE INDEX IF NOT EXISTS idx_audit_order_id    ON order_audit_log (order_id);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON order_audit_log (occurred_at DESC);

-- App user: INSERT only on audit log — cannot UPDATE or DELETE audit entries
GRANT INSERT ON TABLE order_audit_log TO rafting_app;
GRANT SELECT ON TABLE order_audit_log TO rafting_app;
GRANT USAGE, SELECT ON SEQUENCE order_audit_log_id_seq TO rafting_app;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Audit trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- Runs as the DB superuser (SECURITY DEFINER) so it can INSERT into audit_log
-- even when the app connects as rafting_app.
-- The trigger fires AFTER each DML operation on orders.
-- The trigger records WHICH non-PII fields changed during an UPDATE.
-- PII field names (cust_*) are included in the changed_fields list only as
-- column *names* — the encrypted values themselves are never written to the log.
CREATE OR REPLACE FUNCTION trg_orders_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO order_audit_log (order_id, action, operator)
    VALUES (OLD.id, 'DELETE', OLD.operator);

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO order_audit_log (order_id, action, operator)
    VALUES (NEW.id, 'INSERT', NEW.operator);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Build list of changed column names (not values).
    -- Uses explicit IS DISTINCT FROM comparisons — no extensions required.
    IF OLD.arrival_at         IS DISTINCT FROM NEW.arrival_at         THEN v_changed := array_append(v_changed, 'arrival_at'::text); END IF;
    IF OLD.operator           IS DISTINCT FROM NEW.operator           THEN v_changed := array_append(v_changed, 'operator'::text); END IF;
    IF OLD.status             IS DISTINCT FROM NEW.status             THEN v_changed := array_append(v_changed, 'status'::text); END IF;
    IF OLD.completed_at       IS DISTINCT FROM NEW.completed_at       THEN v_changed := array_append(v_changed, 'completed_at'::text); END IF;
    IF OLD.cust_name          IS DISTINCT FROM NEW.cust_name          THEN v_changed := array_append(v_changed, 'cust_name'::text); END IF;
    IF OLD.cust_surname       IS DISTINCT FROM NEW.cust_surname       THEN v_changed := array_append(v_changed, 'cust_surname'::text); END IF;
    IF OLD.cust_country       IS DISTINCT FROM NEW.cust_country       THEN v_changed := array_append(v_changed, 'cust_country'::text); END IF;
    IF OLD.cust_id_type       IS DISTINCT FROM NEW.cust_id_type       THEN v_changed := array_append(v_changed, 'cust_id_type'::text); END IF;
    IF OLD.cust_id_code       IS DISTINCT FROM NEW.cust_id_code       THEN v_changed := array_append(v_changed, 'cust_id_code'::text); END IF;
    IF OLD.cust_address       IS DISTINCT FROM NEW.cust_address       THEN v_changed := array_append(v_changed, 'cust_address'::text); END IF;
    IF OLD.cust_phone         IS DISTINCT FROM NEW.cust_phone         THEN v_changed := array_append(v_changed, 'cust_phone'::text); END IF;
    IF OLD.route              IS DISTINCT FROM NEW.route              THEN v_changed := array_append(v_changed, 'route'::text); END IF;
    IF OLD.adults             IS DISTINCT FROM NEW.adults             THEN v_changed := array_append(v_changed, 'adults'::text); END IF;
    IF OLD.kids               IS DISTINCT FROM NEW.kids               THEN v_changed := array_append(v_changed, 'kids'::text); END IF;
    IF OLD.manual_adjustment  IS DISTINCT FROM NEW.manual_adjustment  THEN v_changed := array_append(v_changed, 'manual_adjustment'::text); END IF;
    IF OLD.manual_total_override IS DISTINCT FROM NEW.manual_total_override THEN v_changed := array_append(v_changed, 'manual_total_override'::text); END IF;
    IF OLD.notes              IS DISTINCT FROM NEW.notes              THEN v_changed := array_append(v_changed, 'notes'::text); END IF;

    INSERT INTO order_audit_log (order_id, action, operator, changed_fields)
    VALUES (NEW.id, 'UPDATE', NEW.operator, v_changed);
  END IF;

  RETURN NULL; -- AFTER trigger — return value is ignored for AFTER triggers
END;
$$;

DROP TRIGGER IF EXISTS orders_audit_trigger ON orders;
CREATE TRIGGER orders_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION trg_orders_audit();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Revoke dangerous default privileges from public schema
-- ─────────────────────────────────────────────────────────────────────────────
-- PostgreSQL ≥15 does this by default, but earlier versions allow any user
-- to create objects in public. Explicit revoke is safe to run on any version.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
