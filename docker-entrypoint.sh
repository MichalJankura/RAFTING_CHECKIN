#!/bin/bash
set -e

PGDATA=/var/lib/postgresql/data
DB_NAME="${DB_NAME:-rafting_dunajec}"
DB_SUPERUSER="postgres"
DB_APP_USER="${DB_USER:-rafting_app}"

# ── Read the application DB password from the Docker secret ───────────────────
# Falls back to the DB_PASSWORD env var for non-Docker development.
DB_APP_PASSWORD=""
if [ -f /run/secrets/db_password ]; then
    DB_APP_PASSWORD=$(cat /run/secrets/db_password | tr -d '[:space:]')
elif [ -n "$DB_PASSWORD" ]; then
    DB_APP_PASSWORD="$DB_PASSWORD"
else
    echo "CHYBA: db_password secret ani DB_PASSWORD env var nie su nastavene!"
    exit 1
fi

# ── Locate PostgreSQL binaries ────────────────────────────────────────────────
PG_CTL=$(find /usr/lib/postgresql -name pg_ctl  -type f 2>/dev/null | head -1)
INITDB=$(find /usr/lib/postgresql -name initdb  -type f 2>/dev/null | head -1)

if [ -z "$PG_CTL" ] || [ -z "$INITDB" ]; then
    echo "CHYBA: PostgreSQL binárky nenájdené!"
    exit 1
fi

# ── First-run: initialise the DB cluster ─────────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "[PG] Prvé spustenie — inicializujem databázu..."
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    # Use md5 auth for network connections and trust for local socket.
    # The Node app connects via TCP (host=localhost), so it authenticates with md5.
    su -s /bin/bash postgres -c \
        "$INITDB --auth-local=trust --auth-host=md5 -U $DB_SUPERUSER -D $PGDATA -E UTF8 --locale=C" \
        > /dev/null
    echo "[PG] Inicializácia hotová."
fi

# ── Ensure PostgreSQL only listens on loopback ────────────────────────────────
# (default after initdb, but assert it explicitly)
if ! grep -q "^listen_addresses" "$PGDATA/postgresql.conf" 2>/dev/null; then
    echo "listen_addresses = 'localhost'" >> "$PGDATA/postgresql.conf"
fi

# ── Start PostgreSQL ──────────────────────────────────────────────────────────
echo "[PG] Spúšťam PostgreSQL..."
su -s /bin/bash postgres -c "$PG_CTL -D $PGDATA start -l /tmp/pg.log -w" > /dev/null

echo -n "[PG] Čakám na databázu"
until su -s /bin/bash postgres -c "pg_isready -q" 2>/dev/null; do
    echo -n "."
    sleep 1
done
echo " pripravená."

# ── Create application database (idempotent) ─────────────────────────────────
DB_EXISTS=$(su -s /bin/bash postgres -c \
    "psql -U $DB_SUPERUSER -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\"")

if [ "$DB_EXISTS" != "1" ]; then
    echo "[PG] Vytváram databázu '$DB_NAME'..."
    su -s /bin/bash postgres -c "psql -U $DB_SUPERUSER -c \"CREATE DATABASE $DB_NAME\"" > /dev/null
fi

# ── Apply main schema (idempotent — CREATE IF NOT EXISTS) ─────────────────────
su -s /bin/bash postgres -c \
    "psql -U $DB_SUPERUSER -d $DB_NAME -f /app/server/schema.sql" > /dev/null
echo "[PG] Schéma je aktuálna."

# ── Apply security schema (roles, audit table, trigger) ──────────────────────
su -s /bin/bash postgres -c \
    "psql -U $DB_SUPERUSER -d $DB_NAME -f /app/server/schema-security.sql" > /dev/null
echo "[PG] Bezpečnostná schéma je aktuálna."

# ── Set / update the application user's password from the secret ──────────────
# This runs on every startup so the password is always in sync with the secret.
su -s /bin/bash postgres -c \
    "psql -U $DB_SUPERUSER -d $DB_NAME -c \"ALTER USER $DB_APP_USER WITH PASSWORD '$DB_APP_PASSWORD'\"" \
    > /dev/null
echo "[PG] Heslo používateľa '$DB_APP_USER' aktualizované."

# ── Start Node.js application ─────────────────────────────────────────────────
echo "[NODE] Spúšťam server na porte ${PORT:-3001}..."
exec node /app/server/index.js
