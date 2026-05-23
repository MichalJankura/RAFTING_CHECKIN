# RAFTING DUNAJEC — Technická inštalačná príručka

> Určené pre nasadenie u zákazníka. Tento dokument pokrýva všetko od nuly po bežiaci systém.

---

## Obsah

1. [Čo je táto aplikácia](#1-čo-je-táto-aplikácia)
2. [Architektúra systému](#2-architektúra-systému)
3. [Požiadavky na hardware a software](#3-požiadavky-na-hardware-a-software)
4. [Prvá inštalácia — Windows](#4-prvá-inštalácia--windows)
5. [Prvá inštalácia — Linux](#5-prvá-inštalácia--linux)
6. [Generovanie a správa secretov](#6-generovanie-a-správa-secretov)
7. [Spustenie aplikácie](#7-spustenie-aplikácie)
8. [Jednorazová migrácia dát](#8-jednorazová-migrácia-dát-len-pri-prenose-existujúcich-záznamov)
9. [Vzdialený prístup cez Netbird](#9-vzdialený-prístup-cez-netbird)
10. [Zálohovanie databázy](#10-zálohovanie-databázy)
11. [Aktualizácia aplikácie](#11-aktualizácia-aplikácie)
12. [Riešenie problémov](#12-riešenie-problémov)
13. [Bezpečnostná architektúra](#13-bezpečnostná-architektúra)
14. [Dôležité súbory a ich umiestnenie](#14-dôležité-súbory-a-ich-umiestnenie)

---

## 1. Čo je táto aplikácia

**Rafting Dunajec** je lokálny check-in systém pre recepciu raftingovej spoločnosti. Umožňuje:

- Vytváranie a správu objednávok (rafting, požičovňa lodí, bicyklov)
- **Skenovanie dokladov totožnosti** cez kameru alebo skener (OCR — automatické vyplnenie mena, priezviska, krajiny, čísla dokladu)
- Správu cenníka
- Kalendárny a denný prehľad
- Tlač potvrdení / zmlúv

**Kľúčové vlastnosti nasadenia:**
- Beží **lokálne na jednom počítači** zákazníka — žiadny cloud, žiadny internet
- Vzdialený prístup je riešený cez **Netbird VPN** (WireGuard)
- Všetky citlivé údaje zákazníkov (meno, ID, adresa) sú **šifrované AES-256-GCM**
- Databáza PostgreSQL a OCR engine bežia **vnútri Docker kontajnerov** (nie na hostiteľskom systéme)
- Prístup do aplikácie je chránený **heslom** (session 7 dní)
- Odfotené doklady **sa nikdy neukladajú** — obraz sa spracuje OCR v pamäti a zahodí

---

## 2. Architektúra systému

```
Hostiteľský počítač (Windows 10/11 alebo Linux)
│
├── Docker Desktop / Docker Engine
│   │
│   ├── Kontajner: rafting-dunajec
│   │   ├── Node.js/Express server (port 3001, bind: 127.0.0.1)
│   │   │   ├── React frontend (Vite build, servovaný Expressom)
│   │   │   ├── REST API (/api/orders, /api/auth, /api/ocr)
│   │   │   └── AES-256-GCM šifrovanie PII polí
│   │   └── PostgreSQL 13 (localhost:5432, len vnútri kontajnera)
│   │       ├── Databáza: rafting_dunajec
│   │       ├── Užívateľ: rafting_app (obmedzené oprávnenia)
│   │       └── Audit log trigger (každý INSERT/UPDATE/DELETE)
│   │
│   └── Kontajner: rafting-ocr   ← OCR sidecar (bez vystavených portov)
│       ├── Python / Flask / EasyOCR
│       ├── CPU-only PyTorch (bez GPU požiadaviek)
│       ├── Jazyky: sk, cs, en, hu, de, pl
│       └── Dostupný LEN vnútri Docker siete (nie z internetu)
│
├── Docker Volume: pg_data (perzistentná databáza)
├── Adresár: secrets/ (súbory s heslami, NIE v gite)
│
└── Netbird (WireGuard VPN)
    └── Sprístupňuje port 3001 vzdialeným zariadeniam cez VPN
```

**Tok dát pri skenovaní dokladu:**
```
Prehliadač (kamera/súbor)
        ↓ base64 JPEG (HTTPS/VPN)
  Node.js /api/ocr/scan-id
        ↓ interná Docker sieť (len v pamäti)
  rafting-ocr (EasyOCR)
        ↓ { text, confidence }[]
  Node.js MRZ parser / heuristika
        ↓ { name, surname, country, idCode }
  Prehliadač — obraz okamžite zahodený
```

**Tok dát pri ukladaní objednávky:**
```
Prehliadač → Netbird VPN → 127.0.0.1:3001 → Node.js
                                               ↓
                                    AES-256-GCM encrypt
                                               ↓
                                         PostgreSQL
```

---

## 3. Požiadavky na hardware a software

### Hardware (minimálne)
- **RAM:** 4 GB (odporúčané 8 GB — OCR service využíva ~1.5 GB pri štarte)
- **CPU:** 2 jadrá (OCR beží na CPU, GPU nie je potrebné)
- **Disk:** 20 GB voľného miesta (OS, Docker, databáza, zálohy + ~2 GB pre PyTorch/EasyOCR vrstvy)
- **OS:** Windows 10/11 Pro alebo Linux (Ubuntu 20.04+, Debian 11+, Rocky Linux 8+)

> **Windows Home:** Nepodporovaný — Docker volumes nefungujú spoľahlivo.

### Software

#### Windows

| Software | Verzia | Kde stiahnuť |
|----------|--------|--------------|
| Docker Desktop | 4.x alebo novší | https://www.docker.com/products/docker-desktop |
| Git | ľubovoľná | https://git-scm.com/download/win |
| Netbird | najnovší | https://netbird.io/download |

#### Linux (Ubuntu/Debian)

```bash
# Docker Engine + Compose plugin (bez Docker Desktop)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Git
sudo apt install -y git

# Netbird (voliteľný — len pre vzdialený prístup)
curl -fsSL https://pkgs.netbird.io/install.sh | sudo bash
```

#### Linux (RHEL / Rocky / AlmaLinux)

```bash
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

**Kontrola po inštalácii:**

```bash
docker --version          # Docker version 24.x alebo novší
docker compose version    # Docker Compose version v2.x
git --version
```

> **Poznámka:** Node.js, Python ani PyTorch na hostiteľskom počítači **nie sú potrebné** — všetko beží vnútri Docker kontajnerov.

---

## 4. Prvá inštalácia — Windows

### Krok 1: Stiahni zdrojový kód

```powershell
cd $env:USERPROFILE\Desktop
git clone <URL_REPOZITARA> "RAFTING DUNAJEC"
cd "RAFTING DUNAJEC"
```

Ak nemáš git, skopíruj celý priečinok projektu na cieľový počítač (USB, sieťový disk).

### Krok 2: Skontroluj štruktúru projektu

Po skopírovaní musíš mať tieto súbory a priečinky:
```
RAFTING DUNAJEC/
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── install.bat                 ← automatická inštalácia (Windows)
├── START.bat                   ← spustenie po reštarte (Windows)
├── STOP.bat
├── package.json
├── package-lock.json
├── src/                        ← React frontend
├── server/                     ← Node.js backend
│   └── routes/
│       ├── orders.js
│       ├── auth.js
│       └── ocr.js              ← OCR proxy + MRZ parser
├── ocr-service/                ← Python EasyOCR sidecar
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
├── scripts/
│   └── backup.sh
├── public/
│   ├── styles.css
│   └── logo.png
└── secrets/                    ← TU BUDEŠ VYTVÁRAŤ HESLA (viď Krok 3)
```

> **DÔLEŽITÉ:** Priečinok `secrets/` nesmie byť v git repozitári. Je zahrnutý v `.gitignore`.

### Krok 3: Spusti automatickú inštaláciu

Najjednoduchší spôsob — dvojklik na:

```
install.bat
```

Skript automaticky:
1. Overí, či Docker beží
2. Vygeneruje všetky secret súbory
3. Zbuilduje oba Docker kontajnery (**prvý build trvá 15–30 minút** — sťahuje PyTorch + EasyOCR modely ~1.5 GB)
4. Počká, kým server naštartuje
5. Zobrazí heslo do aplikácie

> **Po skončení si IHNEĎ ulož heslo** do password managera.

### Krok 3 (manuálne): Vytvor secret súbory cez PowerShell

Ak nechceš použiť `install.bat`:

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"

function New-HexSecret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

function New-B64Secret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

$base = ".\secrets"

[System.IO.File]::WriteAllText("$base\app_encryption_key", (New-HexSecret 32), [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("$base\app_password",       (New-B64Secret 18), [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("$base\db_password",        (New-HexSecret 16), [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("$base\session_secret",     (New-HexSecret 32), [System.Text.Encoding]::ASCII)
[System.IO.File]::WriteAllText("$base\backup_passphrase",  (New-B64Secret 24), [System.Text.Encoding]::ASCII)

# Zobraz heslo do aplikácie
$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "HESLO DO APLIKACIE: $pass"
```

**Over dĺžky súborov:**
```powershell
Get-ChildItem .\secrets\ | Select-Object Name, Length
```

Očakávané dĺžky:
```
app_encryption_key   64
app_password         24
backup_passphrase    32
db_password          32
session_secret       64
```

### Krok 4: Zbuilduj a spusti kontajnery

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"
docker compose up --build -d
```

Sleduj priebeh:
```powershell
docker compose logs -f
```

### Krok 5: Otvor aplikáciu

```
http://localhost:3001
```

Vlož heslo z `secrets/app_password`. Po úspešnom prihlásení si prihlásený **7 dní**.

---

## 5. Prvá inštalácia — Linux

### Krok 1: Stiahni zdrojový kód

```bash
cd ~/Desktop
# alebo /opt/rafting ak chceš inštaláciu pre celý systém
git clone <URL_REPOZITARA> "RAFTING DUNAJEC"
cd "RAFTING DUNAJEC"
```

### Krok 2: Skontroluj oprávnenia skriptu

```bash
chmod +x docker-entrypoint.sh scripts/backup.sh
```

### Krok 3: Vytvor secret súbory

```bash
mkdir -p secrets

# AES-256 kľúč pre databázu (64 hex znakov)
openssl rand -hex 32 > secrets/app_encryption_key

# Heslo do webovej aplikácie (24 base64 znakov)
openssl rand -base64 18 | tr -d '\n=' | head -c 24 > secrets/app_password

# Heslo pre databázového používateľa (32 hex znakov)
openssl rand -hex 16 > secrets/db_password

# Tajomstvo pre session cookies (64 hex znakov)
openssl rand -hex 32 > secrets/session_secret

# Heslo pre šifrované zálohy (32 base64 znakov)
openssl rand -base64 24 | tr -d '\n=' | head -c 32 > secrets/backup_passphrase

# Over dĺžky súborov
wc -c secrets/*
```

Očakávané dĺžky:
```
 64 secrets/app_encryption_key
 24 secrets/app_password
 32 secrets/backup_passphrase
 32 secrets/db_password
 64 secrets/session_secret
```

**Zobraz a ulož heslo:**
```bash
cat secrets/app_password
```

> **KRITICKÉ:** Toto heslo si **ihneď ulož** do password managera. Ak stratíš `app_encryption_key`, **všetky dáta v databáze sú nenávratne stratené**.

### Krok 4: Zbuilduj a spusti kontajnery

```bash
docker compose up --build -d
```

> **Prvý build trvá 15–30 minút** — sťahuje PyTorch (~800 MB) + EasyOCR modely (~700 MB). Ďalšie buildy sú rýchle (cache).

Sleduj priebeh:
```bash
docker compose logs -f
# Ctrl+C zastaví sledovanie, kontajner beží ďalej
```

Úspešný štart:
```
[PG] Prvé spustenie — inicializujem databázu...
[PG] Schéma je aktuálna.
[NODE] Spúšťam server na porte 3001...
RAFTING DUNAJEC server bezi na http://localhost:3001
```

### Krok 5: Otvor aplikáciu

```bash
xdg-open http://localhost:3001
# alebo manuálne v prehliadači: http://localhost:3001
```

### Automatický štart po reboote (Linux)

```bash
# Docker service sa spustí automaticky:
sudo systemctl enable docker

# Kontajner sa reštartuje automaticky (restart: unless-stopped v compose):
# Stačí raz spustiť: docker compose up -d
# Po reboote sa sám obnoví.
```

---

## 6. Generovanie a správa secretov

### Popis každého secret súboru

| Súbor | Dĺžka | Účel | Dôsledok straty |
|-------|-------|------|-----------------|
| `app_encryption_key` | 64 znakov (hex) | AES-256 kľúč na šifrovanie PII v DB | **Všetky dáta nenávratne stratené** |
| `app_password` | 24 znakov (base64) | Heslo pre prihlásenie do webu | Vygeneruj nové, reštartuj |
| `db_password` | 32 znakov (hex) | Heslo DB používateľa rafting_app | Vygeneruj nové, reštartuj |
| `session_secret` | 64 znakov (hex) | Podpisovanie session cookies | Všetci budú odhlásení |
| `backup_passphrase` | 32 znakov (base64) | Šifrovanie GPG záloh | Existujúce zálohy nejde dešifrovať |

### Záloha secretov

1. Skopíruj celý priečinok `secrets/` na USB kľúč
2. Ulož obsah každého súboru aj do password managera (KeePass / Bitwarden)
3. `backup_passphrase` uchovávaj na **inom mieste** ako ostatné secrety

### Zmena hesla do aplikácie

#### Windows (PowerShell)
```powershell
function New-B64Secret([int]$b) {
    $x = New-Object byte[] $b
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($x)
    return [Convert]::ToBase64String($x)
}
[System.IO.File]::WriteAllText(".\secrets\app_password", (New-B64Secret 18), [System.Text.Encoding]::ASCII)
$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "NOVE HESLO: $pass"
docker compose restart
```

#### Windows — vlastné heslo
```powershell
[System.IO.File]::WriteAllText(".\secrets\app_password", "moje_heslo123", [System.Text.Encoding]::ASCII)
docker compose restart
```

#### Linux (Bash)
```bash
openssl rand -base64 18 | tr -d '\n=' | head -c 24 > secrets/app_password
echo "NOVE HESLO: $(cat secrets/app_password)"
docker compose restart
```

#### Linux — vlastné heslo
```bash
printf 'moje_heslo123' > secrets/app_password
docker compose restart
```

---

## 7. Spustenie aplikácie

### Normálne spustenie (po reštarte počítača)

#### Windows
```powershell
# Dvojklik na START.bat — alebo v PowerShell:
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"
docker compose up -d
```

#### Linux
```bash
cd ~/Desktop/"RAFTING DUNAJEC"
docker compose up -d
```

### Zastavenie aplikácie

#### Windows
```powershell
docker compose down
# alebo dvojklik na STOP.bat
```

#### Linux
```bash
docker compose down
```

> **Poznámka:** `docker compose down` **nemazaže dáta**. Databáza je uložená vo volume `pg_data`.

### Kontrola stavu

```bash
# Oba kontajnery musia byť "running" / "healthy"
docker compose ps

# Posledné logy
docker compose logs --tail=20

# Sledovať logy v reálnom čase (Ctrl+C na zastavenie)
docker compose logs -f

# Logy len OCR servisu
docker compose logs ocr-service --tail=20
```

### Automatický štart po zapnutí počítača

**Windows:** `Docker Desktop → Settings → General → Start Docker Desktop when you sign in`

**Linux:** `sudo systemctl enable docker` (kontajner sa obnoví automaticky vďaka `restart: unless-stopped`)

---

## 8. Jednorazová migrácia dát (len pri prenose existujúcich záznamov)

> **Kedy je potrebná:** Len ak prenášaš existujúce objednávky z inej inštalácie. Pri čistej novej inštalácii tento krok **preskočiť**.

```bash
docker exec rafting-dunajec node /app/server/migrate-encrypt.js
```

**Očakávaný výstup:**
```
[migrate] Starting PII encryption migration...
[migrate] Batch offset=0: migrated=3 skipped=0
[migrate] Done. Total migrated: 3, already encrypted (skipped): 0
```

---

## 9. Vzdialený prístup cez Netbird

Netbird umožňuje pristupovať k aplikácii z iného zariadenia cez internet, akoby bolo v lokálnej sieti.

### Inštalácia Netbird na hostiteľský počítač

#### Windows
1. Stiahni a nainštaluj z `https://netbird.io/download`
2. Vytvor účet na `https://app.netbird.io`
3. V dashboarde: `Setup Keys → Add Key`
4. V PowerShell:
   ```powershell
   netbird up --setup-key <TVOJ_SETUP_KEY>
   netbird status   # zobrazí Netbird IP (100.x.x.x)
   ```

#### Linux
```bash
sudo netbird up --setup-key <TVOJ_SETUP_KEY>
netbird status   # zobrazí Netbird IP (100.x.x.x)
```

### Sprístupnenie portu 3001 cez Netbird

Aplikácia počúva na `127.0.0.1:3001`. Treba presmerovať na Netbird IP.

#### Windows (PowerShell ako administrátor)
```powershell
# Nahraď 100.x.x.x skutočnou Netbird IP
netsh interface portproxy add v4tov4 `
    listenaddress=100.x.x.x `
    listenport=3001 `
    connectaddress=127.0.0.1 `
    connectport=3001

netsh interface portproxy show all
```

#### Linux
```bash
# Možnosť A — port forward cez iptables (nahraď 100.x.x.x)
sudo iptables -t nat -A PREROUTING -i netbird0 -p tcp --dport 3001 \
    -j DNAT --to-destination 127.0.0.1:3001
sudo iptables -A FORWARD -p tcp -d 127.0.0.1 --dport 3001 -j ACCEPT
```

**Možnosť B (obe OS) — zmena v `docker-compose.yml`:**
```yaml
ports:
  - "100.x.x.x:3001:3001"   # nahraď 100.x.x.x Netbird IP hostiteľa
```
Potom: `docker compose up -d`

### Pripojenie z klientského zariadenia

1. Nainštaluj Netbird, prihlásiť sa do rovnakého účtu
2. Otvor prehliadač: `http://100.x.x.x:3001`

```bash
# Over spojenie:
netbird status
ping 100.x.x.x
```

---

## 10. Zálohovanie databázy

### Manuálna záloha

```bash
docker exec rafting-dunajec /app/scripts/backup.sh
```

Záloha sa uloží do `/backups` vnútri kontajnera. Pre zálohy na hostiteľskom disku uprav `docker-compose.yml`:

#### Windows
```yaml
volumes:
  - pg_data:/var/lib/postgresql/data
  - C:/Zalohy/Rafting:/backups
```

#### Linux
```yaml
volumes:
  - pg_data:/var/lib/postgresql/data
  - /home/user/rafting-backups:/backups
```

Potom: `docker compose up -d`

### Automatická denná záloha

#### Windows (Task Scheduler)
1. Otvor **Plánovač úloh** → `Vytvoriť základnú úlohu`
2. Trigger: každý deň 02:00
3. Program: `powershell.exe`
4. Argumenty: `-NonInteractive -Command "docker exec rafting-dunajec /app/scripts/backup.sh"`

#### Linux (cron)
```bash
crontab -e
# Pridaj riadok:
0 2 * * * docker exec rafting-dunajec /app/scripts/backup.sh >> /var/log/rafting-backup.log 2>&1
```

### Obnovenie zo zálohy

#### Windows
```powershell
docker cp "C:\Zalohy\Rafting\rafting_20260101_020000.sql.gpg" rafting-dunajec:/tmp/

docker exec rafting-dunajec gpg `
    --decrypt `
    --passphrase-file /run/secrets/backup_passphrase `
    --batch `
    --output /tmp/restore.sql `
    /tmp/rafting_20260101_020000.sql.gpg

docker exec rafting-dunajec su -s /bin/bash postgres -c `
    "psql -U postgres -d rafting_dunajec -f /tmp/restore.sql"
```

#### Linux
```bash
docker cp ~/rafting-backups/rafting_20260101_020000.sql.gpg rafting-dunajec:/tmp/

docker exec rafting-dunajec gpg \
    --decrypt \
    --passphrase-file /run/secrets/backup_passphrase \
    --batch \
    --output /tmp/restore.sql \
    /tmp/rafting_20260101_020000.sql.gpg

docker exec rafting-dunajec su -s /bin/bash postgres -c \
    "psql -U postgres -d rafting_dunajec -f /tmp/restore.sql"
```

> **UPOZORNENIE:** Obnovenie zálohy **prepíše** aktuálne dáta. Pred obnovením si urob zálohu aktuálneho stavu.

---

## 11. Aktualizácia aplikácie

```bash
# 1. Stiahni novú verziu
git pull

# 2. Rebuild hlavnej aplikácie (rýchly — cache)
docker compose build rafting-dunajec
docker compose up -d

# Ak sa zmenil aj ocr-service:
docker compose build
docker compose up -d

# 3. Over úspešný štart
docker compose logs --tail=20
```

> **DÔLEŽITÉ:**
> - Secrety v `secrets/` sa **neprerušia** — sú mimo Docker image
> - Databáza v `pg_data` volume **prežije** aktualizáciu
> - Ak aktualizácia vyžaduje zmenu schémy DB, bude to uvedené v release notes

---

## 12. Riešenie problémov

### Kontajner sa nespustí / točí v slučke

```bash
docker compose logs --tail=30
```

**Najčastejšia príčina A: Chýbajú secret súbory**
```
CHYBA: db_password secret ani DB_PASSWORD env var nie su nastavene!
```
Riešenie: Vytvor súbory podľa [Kroku 3](#krok-3-vytvor-secret-súbory).

**Najčastejšia príčina B: Secret súbory sú priečinky namiesto súborov (Windows)**

Docker ich niekedy vytvorí ako priečinky keď ich nenájde pred prvým spustením.

```powershell
Get-ChildItem .\secrets\ | Select-Object Name, Length, PSIsContainer
# Ak PSIsContainer = True, sú to priečinky — zmaž ich:
Get-ChildItem .\secrets\ | Where-Object { $_.PSIsContainer -and $_.Name -ne 'README.txt' } | Remove-Item -Recurse -Force
```

```bash
# Linux — over typy
ls -la secrets/
# Ak sú to adresáre, zmaž ich:
find secrets/ -mindepth 1 -maxdepth 1 -type d -not -name 'README.txt' -exec rm -rf {} +
```

---

### OCR service sa nespúšťa / zostáva "starting"

OCR service pri prvom štarte inicializuje EasyOCR modely — môže trvať **2–3 minúty**.

```bash
# Sleduj štart OCR:
docker compose logs ocr-service -f

# Očakávaný výstup po úspešnom štarte:
# EasyOCR ready.
# [INFO] Booting worker with pid: ...
```

Ak OCR service stále zlyháva:
```bash
# Skontroluj zdravie kontajnera:
docker compose ps

# Ak je "unhealthy", pozri chybu:
docker inspect rafting-ocr | grep -A 10 '"Health"'
```

---

### `npm ci` zlyhá pri buildovaní

```
npm error Missing: express-session from lock file
```

```bash
# Aktualizuj lock file:
npm install
docker compose build --no-cache rafting-dunajec
docker compose up -d
```

---

### Zabudnuté heslo do aplikácie

#### Windows
```powershell
function New-B64Secret([int]$b) {
    $x = New-Object byte[] $b
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($x)
    return [Convert]::ToBase64String($x)
}
[System.IO.File]::WriteAllText(".\secrets\app_password", (New-B64Secret 18), [System.Text.Encoding]::ASCII)
$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "NOVE HESLO: $pass"
docker compose restart
```

#### Linux
```bash
openssl rand -base64 18 | tr -d '\n=' | head -c 24 > secrets/app_password
echo "NOVE HESLO: $(cat secrets/app_password)"
docker compose restart
```

---

### Aplikácia hlási "Chyba databázy" hneď po prihlásení

**Príčina:** PostgreSQL sa ešte nespustil (typicky pri prvom štarte — inicializácia ~10 sekúnd).  
**Riešenie:** Počkaj 15 sekúnd a obnov stránku (F5).

---

### Prvý build trvá príliš dlho / padá so sieťovou chybou

**Príčina:** Obmedzená sieť blokuje sťahovanie Docker image alebo PyTorch (~1.5 GB).  
**Riešenie:** Použi mobilný hotspot na prvý build. Po zbuildovaní internet **nie je potrebný**.

---

### Databáza je prázdna po reštarte počítača

**Príčina:** Volume `pg_data` bol zmazaný.

```bash
docker volume ls   # mala by existovať: raftingdunajec_pg_data
```

Ak neexistuje, obnov zo zálohy.

> **VAROVANIE:** Nikdy nespúšťaj `docker compose down -v` — parameter `-v` zmažne volume s celou databázou!

---

### Nemôžem sa pripojiť cez Netbird z iného zariadenia

1. Over že Netbird beží na **oboch** zariadeniach: `netbird status`
2. Over, že obe zariadenia sú v **rovnakej Netbird sieti** (dashboard → Peers)
3. **Windows:** Over port proxy: `netsh interface portproxy show all`
4. **Linux:** Over iptables: `sudo iptables -t nat -L PREROUTING -n`
5. Skontroluj firewall — port 3001 musí byť povolený

---

### Skenovanie dokladu — kamera nefunguje na mobile

**Príčina:** `getUserMedia` (prístup ku kamere) vyžaduje HTTPS. Netbird VPN používa plain HTTP.

**Riešenie:** Použi **Súbor / Skener** tab — nafoť doklad mobilom a zdieľaj obrázok, alebo odfot mobilom a pošli na počítač cez sieť.

---

## 13. Bezpečnostná architektúra

### Šifrovanie citlivých dát

Tieto polia sú šifrované **pred uložením** do databázy (aplikačné šifrovanie v Node.js):

| Pole | Popis |
|------|-------|
| `cust_name` | Krstné meno |
| `cust_surname` | Priezvisko |
| `cust_id_code` | Číslo dokladu totožnosti |
| `cust_address` | Adresa trvalého pobytu |
| `cust_phone` | Telefónne číslo |

**Algoritmus:** AES-256-GCM (autentifikované šifrovanie)  
**Formát v DB:** `iv_hex:authTag_hex:ciphertext_hex`  
**Kľúč:** `secrets/app_encryption_key` — 32 bajtov

### OCR a súkromie

- Odfotený doklad sa **nikdy nezapíše na disk** (ani server-side, ani v OCR kontajneri)
- Obraz sa spracuje v pamäti (RAM) a po extrakcii textu je zahodený
- OCR kontajner (`rafting-ocr`) nie je vystavený na žiaden hostiteľský port — dostupný len vnútri Docker siete
- V logoch sa zaznamenáva len počet rozpoznaných blokov textu, nikdy obsah obrazu

### Vrstvená ochrana

| Vrstva | Mechanizmus |
|--------|-------------|
| Sieťová izolácia | Netbird WireGuard VPN — len autorizované zariadenia sa dostanú k aplikácii |
| Port binding | `127.0.0.1:3001` — port nie je vystavený do lokálnej LAN |
| OCR izolácia | `rafting-ocr` bez vystavených portov — len interná Docker sieť |
| Aplikačné prihlásenie | express-session s `timingSafeEqual` (ochrana proti timing attacku) |
| Session bezpečnosť | `HttpOnly`, `SameSite=Strict`, 7-dňová rolling session |
| Databázový používateľ | `rafting_app` — len DML oprávnenia, žiadne DDL |
| Šifrovanie PII | AES-256-GCM pre všetky citlivé polia |
| Audit log | PostgreSQL trigger — každý INSERT/UPDATE/DELETE (bez hodnôt PII) |
| Docker secrets | Heslá v `tmpfs` súboroch — neobjavujú sa v `docker inspect` ani env premenných |
| Container hardening | `no-new-privileges: true` |

### GDPR

Aplikácia spracúva osobné údaje (mená, čísla dokladov). Šifrovanie PII polí a audit log sú implementované s ohľadom na GDPR pre slovenský/EÚ trh.

---

## 14. Dôležité súbory a ich umiestnenie

### Zdrojový kód projektu
```
RAFTING DUNAJEC/
├── Dockerfile                    — definícia Docker image (Node.js app)
├── docker-compose.yml            — oba kontajnery, volumes, secrets, sieť
├── docker-entrypoint.sh          — štartovací skript (PG init + Node.js)
├── install.bat                   — automatická inštalácia (Windows)
├── START.bat                     — spustenie po reštarte (Windows)
├── STOP.bat                      — zastavenie (Windows)
├── package.json                  — Node.js závislosti
├── package-lock.json             — uzamknuté verzie (nemeň manuálne)
├── public/
│   ├── styles.css                — CSS design systém
│   └── logo.png
├── src/                          — React frontend (Vite)
│   ├── checkin.jsx               — formulár check-in
│   ├── ScanIdModal.jsx           — modal skenovania dokladov (OCR)
│   └── icons.jsx
├── server/
│   ├── index.js                  — Express server, session, middleware
│   ├── db.js                     — PostgreSQL connection pool
│   ├── schema.sql                — hlavná DB schéma
│   ├── schema-security.sql       — bezpečnostná schéma (user, audit, trigger)
│   ├── crypto-fields.js          — AES-256-GCM encrypt/decrypt
│   ├── secrets.js                — čítanie Docker secret súborov
│   ├── migrate-encrypt.js        — jednorazová migrácia plaintext → šifrované
│   ├── middleware/
│   │   └── requireAuth.js        — session autentifikácia
│   └── routes/
│       ├── orders.js             — CRUD API pre objednávky
│       ├── auth.js               — login / logout / me
│       └── ocr.js                — OCR proxy + MRZ parser + heuristika
├── ocr-service/
│   ├── Dockerfile                — python:3.11-slim + CPU PyTorch + EasyOCR
│   ├── app.py                    — Flask API (/ocr, /health)
│   └── requirements.txt          — flask, easyocr, pillow, numpy, gunicorn
└── scripts/
    └── backup.sh                 — GPG-šifrovaná záloha PostgreSQL
```

### Secrets (na každom počítači zvlášť, mimo gitu)
```
secrets/
├── app_encryption_key   64 znakov  — AES-256 kľúč (NAJDÔLEŽITEJŠÍ — zálohovať!)
├── app_password         24 znakov  — Heslo do webu
├── db_password          32 znakov  — Heslo DB
├── session_secret       64 znakov  — Session signing
└── backup_passphrase    32 znakov  — GPG zálohy (uchovávať oddelene)
```

### Docker volumes (spravuje Docker)
```
raftingdunajec_pg_data   — Celá PostgreSQL databáza
                           Prežije: reštart kontajnera, reštart PC, docker compose down
                           Zmaže sa: docker compose down -v  ← NIKDY NESPÚŠŤAJ!
```

---

## Rýchla referenčná karta

### Windows (PowerShell)

```powershell
# ── Základné operácie ──────────────────────────────────────────
docker compose up -d                              # Spustiť oba kontajnery
docker compose down                               # Zastaviť (dáta ostanú)
docker compose restart                            # Reštartovať
docker compose up --build -d                      # Rebuild + spustiť
docker compose logs --tail=30                     # Zobraziť logy
docker compose ps                                 # Stav kontajnerov

# ── Správa dát ─────────────────────────────────────────────────
docker exec rafting-dunajec /app/scripts/backup.sh
docker exec rafting-dunajec node /app/server/migrate-encrypt.js

# ── Heslá ──────────────────────────────────────────────────────
# Zobraziť aktuálne heslo:
[System.IO.File]::ReadAllText(".\secrets\app_password",[System.Text.Encoding]::ASCII)

# Vygenerovať nové heslo:
function New-B64Secret([int]$b){$x=New-Object byte[] $b;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($x);return [Convert]::ToBase64String($x)}
[System.IO.File]::WriteAllText(".\secrets\app_password",(New-B64Secret 18),[System.Text.Encoding]::ASCII)
docker compose restart
```

### Linux (Bash)

```bash
# ── Základné operácie ──────────────────────────────────────────
docker compose up -d                              # Spustiť oba kontajnery
docker compose down                               # Zastaviť (dáta ostanú)
docker compose restart                            # Reštartovať
docker compose up --build -d                      # Rebuild + spustiť
docker compose logs --tail=30                     # Zobraziť logy
docker compose ps                                 # Stav kontajnerov

# ── Správa dát ─────────────────────────────────────────────────
docker exec rafting-dunajec /app/scripts/backup.sh
docker exec rafting-dunajec node /app/server/migrate-encrypt.js

# ── Heslá ──────────────────────────────────────────────────────
# Zobraziť aktuálne heslo:
cat secrets/app_password

# Vygenerovať nové heslo:
openssl rand -base64 18 | tr -d '\n=' | head -c 24 > secrets/app_password
echo "NOVE HESLO: $(cat secrets/app_password)"
docker compose restart

# ── Debug ──────────────────────────────────────────────────────
docker compose logs ocr-service --tail=20         # Logy OCR servisu
docker inspect rafting-ocr | grep -A5 '"Health"'  # Zdravie OCR kontajnera
docker volume ls                                  # Overiť existenciu pg_data
```

---

*Posledná aktualizácia: Máj 2026*
