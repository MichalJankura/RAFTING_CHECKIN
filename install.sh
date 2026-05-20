#!/bin/bash
# install.sh — RAFTING DUNAJEC — prvý inštalačný skript (Linux / macOS)
# Použitie: chmod +x install.sh && ./install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SD="$SCRIPT_DIR/secrets"

echo
echo " ========================================="
echo "  RAFTING DUNAJEC — Prvý inštalačný skript"
echo " ========================================="
echo

# ── 1. Docker check ───────────────────────────────────────────────────────────
if ! docker info >/dev/null 2>&1; then
    echo " CHYBA: Docker nie je spustený."
    echo " Spustite Docker a skúste znova."
    exit 1
fi
echo " [OK] Docker beží."

# ── Docker Compose check (v2 prednostne) ─────────────────────────────────────
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
else
    echo " CHYBA: 'docker compose' nenájdené."
    echo " Nainštalujte Docker Desktop alebo Docker Compose v2."
    exit 1
fi
echo " [OK] ${DC} dostupné."
echo

# ── 2. Vytvor priečinok secrets/ ─────────────────────────────────────────────
mkdir -p "$SD"

# ── 3. Existujúce kľúče? ─────────────────────────────────────────────────────
GEN_SECRETS=1
if [ -f "$SD/app_encryption_key" ]; then
    echo " POZOR: Tajné kľúče už existujú v secrets/"
    echo " Nové kľúče ZRUŠIA šifrovanie existujúcej databázy (staré dáta budú nečitateľné)!"
    echo
    read -rp "  Vygenerovať NOVÉ kľúče? [a/N]: " CONFIRM
    if [[ ! "${CONFIRM:-N}" =~ ^[Aa]$ ]]; then
        echo " Preskakujem generovanie kľúčov."
        echo
        GEN_SECRETS=0
    fi
fi

# ── 4. Generovanie tajných kľúčov ─────────────────────────────────────────────
if [ "$GEN_SECRETS" = "1" ]; then
    echo " Generujem tajné kľúče..."

    # Overenie dostupnosti openssl
    if ! command -v openssl >/dev/null 2>&1; then
        echo " CHYBA: 'openssl' nenájdené. Nainštalujte openssl."
        exit 1
    fi

    # 64 hex chars (32 náhodných bajtov) pre každý kľúč
    openssl rand -hex 32 | tr -d '\n' > "$SD/app_encryption_key"
    openssl rand -hex 32 | tr -d '\n' > "$SD/db_password"
    openssl rand -hex 32 | tr -d '\n' > "$SD/session_secret"
    openssl rand -hex 32 | tr -d '\n' > "$SD/backup_passphrase"

    # app_password — 24 alfanumerických znakov (žiadne špeciálne znaky)
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24 | tr -d '\n' > "$SD/app_password"

    # Ochrana súborov — čitateľné len vlastníkom
    chmod 600 "$SD"/*

    echo " [OK] Všetky kľúče vygenerované."
    echo
fi

# ── 5. Build a spustenie kontajnera ──────────────────────────────────────────
echo " Buildujem a spúšťam Docker kontajner..."
echo " (prvý build trvá 3–5 minút, ďalší build je rýchly)"
echo
$DC up --build -d
echo

# ── 6. Čakanie na server ──────────────────────────────────────────────────────
echo " Čakám kým server naštartuje..."
TRIES=0
until bash -c 'echo >/dev/tcp/localhost/3001' 2>/dev/null; do
    sleep 2
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge 30 ]; then
        echo " CHYBA: Server sa nespustil do 60 sekúnd."
        echo " Logy kontajnera:"
        $DC logs --tail 40
        exit 1
    fi
done
echo " [OK] Server beží na porte 3001."
echo

# ── 7. Migrácia existujúcich záznamov ────────────────────────────────────────
echo " Migrácia dát: šifrovanie existujúcich záznamov..."
docker exec rafting-dunajec node /app/server/migrate-encrypt.js
echo

# ── 8. Výpis hesla ────────────────────────────────────────────────────────────
APP_PASS=$(cat "$SD/app_password")
PASS_LEN=${#APP_PASS}
PAD=$(( (37 - PASS_LEN) / 2 ))
PADSTR=$(printf '%*s' "$PAD" '')

echo
echo " ╔═══════════════════════════════════════╗"
echo " ║       HESLO DO APLIKÁCIE              ║"
echo " ╠═══════════════════════════════════════╣"
printf " ║%s%s%*s║\n" "$PADSTR" "$APP_PASS" "$((39 - PAD - PASS_LEN))" ""
echo " ╠═══════════════════════════════════════╣"
echo " ║  Zapíšte si toto heslo!               ║"
echo " ║  Súbor: secrets/app_password          ║"
echo " ╚═══════════════════════════════════════╝"
echo
echo " Adresa: http://localhost:3001"
echo
echo " Ďalšie príkazy:"
echo "   START.bat / docker compose up -d    — spustenie"
echo "   STOP.bat  / docker compose down     — zastavenie"
echo
read -rp " Stlačte Enter pre ukončenie..."
