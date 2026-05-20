#!/bin/bash
# backup.sh — encrypted PostgreSQL backup
#
# Creates a GPG-encrypted pg_dump of the rafting_dunajec database.
# Store the backup passphrase in a file that is SEPARATE from the
# app secrets directory — ideally on a USB drive or NAS, not on the same disk.
#
# Usage:
#   ./scripts/backup.sh
#
# Or to run from inside the container:
#   docker exec rafting-dunajec /app/scripts/backup.sh
#
# Cron (runs daily at 02:00 on the host):
#   0 2 * * * docker exec rafting-dunajec /app/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PASSPHRASE_FILE="${PASSPHRASE_FILE:-/run/secrets/backup_passphrase}"
DB_NAME="${DB_NAME:-rafting_dunajec}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$BACKUP_DIR/rafting_${TIMESTAMP}.sql.gpg"

if [ ! -f "$PASSPHRASE_FILE" ]; then
    echo "[backup] CHYBA: Súbor hesla '$PASSPHRASE_FILE' nenájdený."
    echo "[backup] Uložte zálohovacie heslo do $PASSPHRASE_FILE (mimo repozitára)."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[backup] Zálohujem databázu '$DB_NAME' do $OUTPUT_FILE ..."

su -s /bin/bash postgres -c "pg_dump -U postgres $DB_NAME" \
  | gpg --symmetric \
        --cipher-algo AES256 \
        --batch \
        --yes \
        --passphrase-file "$PASSPHRASE_FILE" \
        --output "$OUTPUT_FILE"

echo "[backup] Záloha uložená: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"

# ── Retention: keep only the last 30 daily backups ───────────────────────────
find "$BACKUP_DIR" -name "rafting_*.sql.gpg" -type f \
  | sort -r \
  | tail -n +31 \
  | xargs -r rm --
echo "[backup] Staré zálohy (>30 dní) vymazané."
