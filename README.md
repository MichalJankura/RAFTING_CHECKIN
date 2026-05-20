# RAFTING DUNAJEC — Technická inštalačná príručka

> Určené pre nasadenie u zákazníka. Tento dokument pokrýva všetko od nuly po bežiaci systém.

---

## Obsah

1. [Čo je táto aplikácia](#1-čo-je-táto-aplikácia)
2. [Architektúra systému](#2-architektúra-systému)
3. [Požiadavky na hardware a software](#3-požiadavky-na-hardware-a-software)
4. [Prvá inštalácia — krok za krokom](#4-prvá-inštalácia--krok-za-krokom)
5. [Generovanie a správa secretov](#5-generovanie-a-správa-secretov)
6. [Spustenie aplikácie](#6-spustenie-aplikácie)
7. [Jednorazová migrácia dát](#7-jednorazová-migrácia-dát-len-pri-prenose-existujúcich-záznamov)
8. [Vzdialený prístup cez Netbird](#8-vzdialený-prístup-cez-netbird)
9. [Zálohovanie databázy](#9-zálohovanie-databázy)
10. [Aktualizácia aplikácie](#10-aktualizácia-aplikácie)
11. [Riešenie problémov](#11-riešenie-problémov)
12. [Bezpečnostná architektúra](#12-bezpečnostná-architektúra)
13. [Dôležité súbory a ich umiestnenie](#13-dôležité-súbory-a-ich-umiestnenie)

---

## 1. Čo je táto aplikácia

**Rafting Dunajec** je lokálny check-in systém pre recepciu raftingovej spoločnosti. Umožňuje:

- Vytváranie a správu objednávok (rafting, požičovňa lodí, bicyklov)
- Správu cenníka
- Kalendárny a denný prehľad
- Tlač potvrdení / zmlúv

**Kľúčové vlastnosti nasadenia:**
- Beží **lokálne na jednom počítači** zákazníka — žiadny cloud, žiadny internet
- Vzdialený prístup je riešený cez **Netbird VPN** (WireGuard)
- Všetky citlivé údaje zákazníkov (meno, ID, adresa) sú **šifrované AES-256-GCM**
- Databáza PostgreSQL beží **vnútri Docker kontajnera** (nie na hostiteľskom systéme)
- Prístup do aplikácie je chránený **heslom** (session 7 dní)

---

## 2. Architektúra systému

```
Hostiteľský počítač (Windows 10/11)
│
├── Docker Desktop
│   └── Kontajner: rafting-dunajec
│       ├── Node.js/Express server (port 3001, bind: 127.0.0.1)
│       │   ├── React frontend (Vite build, servovaný Expressom)
│       │   ├── REST API (/api/orders, /api/auth)
│       │   └── AES-256-GCM šifrovanie PII polí
│       └── PostgreSQL 13 (localhost:5432, len vnútri kontajnera)
│           ├── Databáza: rafting_dunajec
│           ├── Užívateľ: rafting_app (obmedzené oprávnenia)
│           └── Audit log trigger (každý INSERT/UPDATE/DELETE)
│
├── Docker Volume: pg_data (perzistentná databáza)
├── Adresár: secrets/ (súbory s heslami, NIE v gite)
│
└── Netbird (WireGuard VPN)
    └── Sprístupňuje port 3001 vzdialeným zariadeniam cez VPN
```

**Tok dát pri prístupe:**
```
Prehliadač → Netbird VPN → 127.0.0.1:3001 → Node.js
                                               ↓
                                    AES-256-GCM encrypt/decrypt
                                               ↓
                                         PostgreSQL
```

---

## 3. Požiadavky na hardware a software

### Hardware (minimálne)
- **RAM:** 4 GB (odporúčané 8 GB)
- **CPU:** 2 jadrá
- **Disk:** 20 GB voľného miesta (pre OS, Docker, databázu a zálohy)
- **OS:** Windows 10 Pro / Windows 11 Pro *(Home verzia nepodporuje Docker volumes správne)*

### Software

| Software | Verzia | Kde stiahnuť |
|----------|--------|--------------|
| Docker Desktop | 4.x alebo novší | https://www.docker.com/products/docker-desktop |
| Git | ľubovoľná | https://git-scm.com/download/win |
| Netbird | najnovší | https://netbird.io/download |

> **Poznámka:** Node.js na hostiteľskom počítači **nie je potrebný** — beží len vnútri Docker kontajnera.

### Kontrola pred inštaláciou

Otvor PowerShell a over:
```powershell
docker --version        # má byť Docker version 24.x alebo novší
docker compose version  # má byť Docker Compose version v2.x
git --version           # ľubovoľná verzia
```

---

## 4. Prvá inštalácia — krok za krokom

### Krok 1: Stiahni zdrojový kód

```powershell
# Vytvor priečinok pre aplikáciu (napríklad na ploche)
cd $env:USERPROFILE\Desktop

# Stiahni repo (alebo skopíruj priečinok z USB)
git clone <URL_REPOZITARA> "RAFTING DUNAJEC"
cd "RAFTING DUNAJEC"
```

Ak nemáš git repozitár, skopíruj celý priečinok projektu na cieľový počítač (USB, sieťový disk, atď.).

### Krok 2: Skontroluj štruktúru projektu

Po skopírovaní musíš mať tieto súbory a priečinky:
```
RAFTING DUNAJEC/
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── package.json
├── package-lock.json
├── .env.example
├── src/                    ← React frontend
├── server/                 ← Node.js backend
│   ├── index.js
│   ├── db.js
│   ├── schema.sql
│   ├── schema-security.sql
│   ├── crypto-fields.js
│   ├── secrets.js
│   ├── migrate-encrypt.js
│   ├── middleware/
│   │   └── requireAuth.js
│   └── routes/
│       ├── orders.js
│       └── auth.js
├── scripts/
│   └── backup.sh
├── public/
│   ├── styles.css
│   └── logo.png
└── secrets/                ← TU BUDEŠ VYTVÁRAŤ HESLA (viď Krok 3)
    └── README.txt
```

> **DÔLEŽITÉ:** Priečinok `secrets/` nesmie byť v git repozitári. Je zahrnutý v `.gitignore`. Súbory v ňom vytváraš **manuálne** na každom novom počítači.

### Krok 3: Vytvor secret súbory

Toto je **najdôležitejší krok**. Bez týchto súborov aplikácia nenaštartuje.

Otvor PowerShell v priečinku projektu:

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"
```

Spusti nasledujúce príkazy jeden po druhom:

```powershell
# Pomocná funkcia na generovanie náhodných hexadecimálnych hodnôt
function New-HexSecret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

# Pomocná funkcia na generovanie náhodných Base64 hodnôt
function New-B64Secret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

$base = ".\secrets"

# 1. Šifrovací kľúč pre databázu (32 bajtov = 64 hex znakov)
[System.IO.File]::WriteAllText("$base\app_encryption_key", (New-HexSecret 32), [System.Text.Encoding]::ASCII)

# 2. Heslo pre prihlásenie do webovej aplikácie
[System.IO.File]::WriteAllText("$base\app_password",       (New-B64Secret 18), [System.Text.Encoding]::ASCII)

# 3. Heslo pre databázového používateľa rafting_app
[System.IO.File]::WriteAllText("$base\db_password",        (New-HexSecret 16), [System.Text.Encoding]::ASCII)

# 4. Tajomstvo pre podpisovanie session cookies
[System.IO.File]::WriteAllText("$base\session_secret",     (New-HexSecret 32), [System.Text.Encoding]::ASCII)

# 5. Heslo pre šifrované zálohy databázy
[System.IO.File]::WriteAllText("$base\backup_passphrase",  (New-B64Secret 24), [System.Text.Encoding]::ASCII)
```

**Over že súbory vznikli správne:**
```powershell
Get-ChildItem .\secrets\ | Select-Object Name, Length
```

Očakávaný výstup:
```
Name                Length
----                ------
app_encryption_key      64
app_password            24
backup_passphrase       32
db_password             32
session_secret          64
README.txt            1394
```

Dĺžky musia sedieť **presne** — inak aplikácia odmietne naštartovať.

**Zobraz a ulož heslo do aplikácie:**
```powershell
$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "HESLO DO APLIKACIE: $pass"
```

> **KRITICKÉ:** Toto heslo si **ihneď ulož** do password managera (KeePass, Bitwarden).
> Ak ho stratíš, musíš vygenerovať nové (postup v sekcii [Riešenie problémov](#11-riešenie-problémov)).
>
> Ešte dôležitejší je `app_encryption_key` — ak ho stratíš, **všetky šifrované dáta v databáze sú nenávratne stratené**.

### Krok 4: Spusti Docker a postav image

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"
docker compose up --build -d
```

Prvé spustenie trvá **5–15 minút** (sťahuje Node.js image, inštaluje PostgreSQL, builduje frontend). Ďalšie spustenia sú rýchle (pod 30 sekúnd).

**Sleduj priebeh:**
```powershell
docker compose logs -f
```

Stlač `Ctrl+C` na zastavenie sledovania (kontajner beží ďalej na pozadí).

**Čo uvidíš pri úspešnom štarte:**
```
[PG] Prvé spustenie — inicializujem databázu...
[PG] Schéma je aktuálna.
[PG] Bezpečnostná schéma je aktuálna.
[PG] Heslo používateľa 'rafting_app' aktualizované.
[NODE] Spúšťam server na porte 3001...
RAFTING DUNAJEC server bezi na http://localhost:3001
```

### Krok 5: Otvor aplikáciu

Otvor prehliadač a choď na:
```
http://localhost:3001
```

Uvidíš prihlasovaciu stránku. Vlož heslo z `secrets/app_password`.

Po úspešnom prihlásení si prihlásený **7 dní** — heslo sa nebude pýtať znova, pokiaľ ho pravidelne používaš.

---

## 5. Generovanie a správa secretov

### Popis každého secret súboru

| Súbor | Dĺžka | Účel | Dôsledok straty |
|-------|-------|------|-----------------|
| `app_encryption_key` | 64 znakov (hex) | AES-256 kľúč na šifrovanie PII v DB | **Všetky dáta nenávratne stratené** |
| `app_password` | 24 znakov (base64) | Heslo pre prihlásenie do webu | Vygeneruj nové, reštartuj |
| `db_password` | 32 znakov (hex) | Heslo DB používateľa rafting_app | Vygeneruj nové, reštartuj |
| `session_secret` | 64 znakov (hex) | Podpisovanie session cookies | Všetci budú odhlásení |
| `backup_passphrase` | 32 znakov (base64) | Šifrovanie GPG záloh | Existujúce zálohy nejde dešifrovať |

### Záloha secretov

**Odporúčaný postup:**
1. Skopíruj celý priečinok `secrets/` na USB kľúč
2. Ulož obsah každého súboru aj do password managera (KeePass / Bitwarden)
3. `backup_passphrase` uchovávaj na **inom mieste** ako ostatné secrety — napríklad len na USB kľúči uloženom inde

### Zmena hesla do aplikácie

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"

function New-B64Secret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

[System.IO.File]::WriteAllText(".\secrets\app_password", (New-B64Secret 18), [System.Text.Encoding]::ASCII)

$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "NOVE HESLO: $pass"

docker compose restart
```

---

## 6. Spustenie aplikácie

### Normálne spustenie (po reštarte počítača)

Docker Desktop musí byť spustený. Potom:

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"
docker compose up -d
```

### Zastavenie aplikácie

```powershell
docker compose down
```

> **Poznámka:** `docker compose down` **nemazaže dáta**. Databáza je uložená vo volume `pg_data` a prežije zastavenie aj reštart počítača.

### Kontrola stavu

```powershell
# Je kontajner spustený?
docker compose ps

# Posledné logy
docker compose logs --tail=20

# Sledovať logy v reálnom čase (Ctrl+C na zastavenie)
docker compose logs -f
```

### Automatický štart po zapnutí počítača

**Docker Desktop:**
`Settings → General → Start Docker Desktop when you sign in` — zapni.

**Kontajner** sa automaticky reštartuje keď Docker naštartuje, pretože `docker-compose.yml` obsahuje `restart: unless-stopped`. Stačí ho raz spustiť príkazom `docker compose up -d`.

---

## 7. Jednorazová migrácia dát (len pri prenose existujúcich záznamov)

> **Kedy je potrebná:** Len ak prenášaš existujúce objednávky z inej inštalácie alebo zo starého systému. Pri čistej novej inštalácii tento krok **preskočiť**.

Migrácia zašifruje všetky existujúce plaintext záznamy v databáze. Je **bezpečná opakovane spustiť** — už zašifrované záznamy automaticky preskočí.

```powershell
docker exec rafting-dunajec node /app/server/migrate-encrypt.js
```

**Očakávaný výstup:**
```
[migrate] Starting PII encryption migration...
[migrate] Batch offset=0: migrated=3 skipped=0
[migrate] Done. Total migrated: 3, already encrypted (skipped): 0
```

---

## 8. Vzdialený prístup cez Netbird

Netbird umožňuje pristupovať k aplikácii z iného zariadenia (notebook, tablet) cez internet, akoby bolo zariadenie v lokálnej sieti zákazníka.

### Inštalácia Netbird na hostiteľský počítač (server u zákazníka)

1. Stiahni a nainštaluj Netbird z `https://netbird.io/download`
2. Vytvor si účet na `https://app.netbird.io`
3. V Netbird dashboarde vygeneruj **Setup Key** (`Setup Keys → Add Key`)
4. V PowerShell na počítači zákazníka:
   ```powershell
   netbird up --setup-key <TVOJ_SETUP_KEY>
   ```
5. Zisti Netbird IP adresu tohto počítača:
   ```powershell
   netbird status
   ```
   IP bude v tvare `100.x.x.x` — **zapamätaj si ju**.

### Sprístupnenie portu 3001 cez Netbird

Aplikácia počúva na `127.0.0.1:3001`. Aby bola prístupná cez Netbird VPN, treba presmerovať port.

Otvor PowerShell **ako administrátor**:
```powershell
# Nastav presmerovania (nahraď 100.x.x.x skutočnou Netbird IP)
netsh interface portproxy add v4tov4 `
    listenaddress=100.x.x.x `
    listenport=3001 `
    connectaddress=127.0.0.1 `
    connectport=3001

# Over nastavenie
netsh interface portproxy show all
```

**Alternatíva — zmena v docker-compose.yml:**
```yaml
ports:
  - "100.x.x.x:3001:3001"   # nahraď 100.x.x.x Netbird IP hostiteľa
```
Potom: `docker compose up -d`

### Inštalácia Netbird na klientské zariadenie (tvoj notebook / tablet zákazníka)

1. Nainštaluj Netbird
2. Prihlás sa do **rovnakého Netbird účtu** alebo použi Peer Invite z dashboardu
3. Po spojení otvor prehliadač:
   ```
   http://100.x.x.x:3001
   ```
   kde `100.x.x.x` je Netbird IP hostiteľského počítača

### Overenie spojenia

```powershell
# Na klientskom zariadení over spojenie:
netbird status
ping 100.x.x.x
```

---

## 9. Zálohovanie databázy

### Manuálna záloha

```powershell
docker exec rafting-dunajec /app/scripts/backup.sh
```

Záloha sa uloží do `/backups` **vnútri kontajnera**. Aby zálohy boli na hostiteľskom disku, uprav `docker-compose.yml`:

```yaml
volumes:
  - pg_data:/var/lib/postgresql/data
  - C:/Zalohy/Rafting:/backups      # ← pridaj tento riadok
```

Potom reštartuj: `docker compose up -d`

### Automatická denná záloha (Windows Task Scheduler)

1. Otvor **Plánovač úloh** (Task Scheduler)
2. `Vytvoriť základnú úlohu...`
3. Nastavenia:
   - **Názov:** Rafting záloha
   - **Trigger:** Každý deň, čas: 02:00
   - **Akcia:** Spustenie programu
   - **Program:** `powershell.exe`
   - **Argumenty:** `-NonInteractive -Command "docker exec rafting-dunajec /app/scripts/backup.sh"`
4. Zapni `Spustiť bez ohľadu na to, či je používateľ prihlásený`

### Obnovenie zo zálohy

```powershell
# 1. Skopíruj zálohovací súbor do kontajnera
docker cp "C:\Zalohy\Rafting\rafting_20260101_020000.sql.gpg" rafting-dunajec:/tmp/

# 2. Dešifruj zálohu do SQL súboru
docker exec rafting-dunajec gpg `
    --decrypt `
    --passphrase-file /run/secrets/backup_passphrase `
    --batch `
    --output /tmp/restore.sql `
    /tmp/rafting_20260101_020000.sql.gpg

# 3. Obnov databázu (PREPÍŠE existujúce dáta!)
docker exec rafting-dunajec su -s /bin/bash postgres -c `
    "psql -U postgres -d rafting_dunajec -f /tmp/restore.sql"
```

> **UPOZORNENIE:** Obnovenie zálohy **prepíše** aktuálne dáta. Pred obnovením si urob zálohu aktuálneho stavu.

---

## 10. Aktualizácia aplikácie

Keď dostaneš novú verziu kódu:

```powershell
cd "$env:USERPROFILE\Desktop\RAFTING DUNAJEC"

# 1. Stiahni novú verziu (ak používaš git)
git pull

# 2. Zastav a znova postav kontajner
docker compose down
docker compose up --build -d

# 3. Over úspešný štart
docker compose logs --tail=20
```

> **DÔLEŽITÉ:**
> - Secrety v `secrets/` sa **neprerušia** — sú mimo Docker image
> - Databáza v `pg_data` volume **prežije** aktualizáciu
> - Ak aktualizácia vyžaduje zmenu schémy DB, bude to uvedené v release notes

---

## 11. Riešenie problémov

### Kontajner sa nespustí / točí v slučke

**Skontroluj logy:**
```powershell
docker compose logs --tail=30
```

**Najčastejšia príčina A: Chýbajú secret súbory**
```
CHYBA: db_password secret ani DB_PASSWORD env var nie su nastavene!
```
Riešenie: Vytvor súbory podľa [Kroku 3](#krok-3-vytvor-secret-súbory).

**Najčastejšia príčina B: Secret súbory sú priečinky namiesto súborov**

Docker ich niekedy vytvorí ako priečinky keď ich nenájde pred prvým spustením.
```powershell
Get-ChildItem .\secrets\ | Select-Object Name, Length, PSIsContainer
```
Ak stĺpec `PSIsContainer` ukazuje `True`, sú to priečinky — treba ich zmazať a znova vytvoriť:
```powershell
Get-ChildItem .\secrets\ | Where-Object { $_.PSIsContainer -and $_.Name -ne 'README.txt' } | Remove-Item -Recurse -Force
```
Potom znova spusti príkazy z Kroku 3.

---

### `npm ci` zlyhá pri buildovaní

```
npm error Missing: express-session from lock file
```

**Riešenie:**
```powershell
npm install
docker compose up --build -d
```

---

### Zabudnuté heslo do aplikácie

```powershell
function New-B64Secret([int]$bytes) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}
[System.IO.File]::WriteAllText(".\secrets\app_password", (New-B64Secret 18), [System.Text.Encoding]::ASCII)
$pass = [System.IO.File]::ReadAllText(".\secrets\app_password", [System.Text.Encoding]::ASCII)
Write-Host "NOVE HESLO: $pass"
docker compose restart
```

---

### Aplikácia hlási "Chyba databázy" hneď po prihlásení

**Príčina:** PostgreSQL sa ešte nespustil (typicky pri prvom štarte — inicializácia trvá ~10 sekúnd).

**Riešenie:** Počkaj 15 sekúnd a obnov stránku (F5).

---

### Prvý build trvá príliš dlho / padá so sieťovou chybou

**Príčina:** Eduroam, korporátna WiFi alebo obmedzená sieť blokuje sťahovanie Docker image.

**Riešenie:** Použi mobilný hotspot na prvý build. Po úspešnom zbuildovaní internet **nie je potrebný** — všetko beží lokálne.

---

### Databáza je prázdna po reštarte počítača

**Príčina:** Volume `pg_data` bol zmazaný (napr. príkazom `docker compose down -v`) alebo nebol vytvorený.

**Overenie:**
```powershell
docker volume ls
```
Mala by existovať `raftingdunajec_pg_data`. Ak nie, obnov zo zálohy.

> **VAROVANIE:** Nikdy nespúšťaj `docker compose down -v` — parameter `-v` zmažne volume s celou databázou!

---

### Nemôžem sa pripojiť cez Netbird z iného zariadenia

1. Over že Netbird beží na **oboch** zariadeniach: `netbird status`
2. Over, že obe zariadenia sú v **rovnakej Netbird sieti** (dashboard → Peers)
3. Over port proxy na hostiteľovi: `netsh interface portproxy show all`
4. Skontroluj Windows Firewall — port 3001 musí byť povolený

---

### Aplikácia zobrazuje login stránku aj keď si bol prihlásený

**Príčina:** Session expirovala (7 dní nepoužívania) alebo bol reštartovaný kontajner.

**Riešenie:** Normálne sa prihlásiš znova. Session vydrží ďalších 7 dní.

---

## 12. Bezpečnostná architektúra

### Šifrovanie citlivých dát

Tieto polia sú šifrované **pred uložením** do databázy (aplikačné šifrovanie v Node.js):

| Pole | Popis |
|------|-------|
| `cust_name` | Krstné meno |
| `cust_surname` | Priezvisko |
| `cust_id_code` | Číslo dokladu totožnosti |
| `cust_address` | Adresa trvalého pobytu |
| `cust_phone` | Telefónne číslo |

**Algoritmus:** AES-256-GCM (autentifikované šifrovanie — detekuje aj manipuláciu s dátami)  
**Formát v DB:** `iv_hex:authTag_hex:ciphertext_hex` (TEXT stĺpec)  
**Kľúč:** `secrets/app_encryption_key` — 32 bajtov

Útočník s prístupom k databáze bez kľúča vidí len nečitateľné hex reťazce.

### Vrstvená ochrana

| Vrstva | Mechanizmus |
|--------|-------------|
| Sieťová izolácia | Netbird WireGuard VPN — len autorizované zariadenia sa dostanú k aplikácii |
| Port binding | `127.0.0.1:3001` — port nie je vystavený do lokálnej LAN siete |
| Aplikačné prihlásenie | express-session s `timingSafeEqual` (ochrana proti timing attacku) |
| Session bezpečnosť | `HttpOnly`, `SameSite=Strict`, 7-dňová rolling session |
| Databázový používateľ | `rafting_app` má len DML oprávnenia — žiadne DDL, žiadny superuser |
| Šifrovanie PII | AES-256-GCM pre všetky citlivé polia |
| Audit log | PostgreSQL trigger zaznamenáva každú zmenu (bez hodnôt PII) |
| Docker secrets | Heslá v `tmpfs` súboroch — neobjavujú sa v `docker inspect` ani env premenných |
| Container hardening | `no-new-privileges: true` |

### GDPR

Aplikácia spracúva osobné údaje (mená, čísla dokladov, adresy). Šifrovanie PII polí a audit log sú implementované s ohľadom na GDPR pre slovenský/EÚ trh.

---

## 13. Dôležité súbory a ich umiestnenie

### Zdrojový kód projektu
```
RAFTING DUNAJEC/
├── Dockerfile                    — definícia Docker image
├── docker-compose.yml            — konfigurácia kontajnera, volumes, secrets
├── docker-entrypoint.sh          — štartovací skript (PG init + Node.js)
├── package.json                  — Node.js závislosti
├── package-lock.json             — uzamknuté verzie (nemeň manuálne)
├── public/styles.css             — CSS design systém
├── public/logo.png               — logo aplikácie
├── src/                          — React frontend
├── server/
│   ├── index.js                  — Express server, session, middleware
│   ├── db.js                     — PostgreSQL connection pool
│   ├── schema.sql                — Hlavná DB schéma
│   ├── schema-security.sql       — Bezpečnostná schéma (user, audit, trigger)
│   ├── crypto-fields.js          — AES-256-GCM encrypt/decrypt
│   ├── secrets.js                — Čítanie Docker secret súborov
│   ├── migrate-encrypt.js        — Jednorazová migrácia plaintext → šifrované
│   ├── middleware/requireAuth.js — Session autentifikácia
│   └── routes/
│       ├── orders.js             — CRUD API pre objednávky
│       └── auth.js               — Login / logout / me
└── scripts/backup.sh             — GPG-šifrovaná záloha databázy
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

### Docker volumes (spravuje Docker Desktop)
```
raftingdunajec_pg_data   — Celá PostgreSQL databáza
                           Prežije: reštart kontajnera, reštart PC, docker compose down
                           Zmaže sa: docker compose down -v  ← NIKDY NESPÚŠŤAJ!
```

---

## Rýchla referenčná karta

```powershell
# ── Základné operácie ──────────────────────────────────────────
docker compose up -d                          # Spustiť aplikáciu
docker compose down                           # Zastaviť (dáta ostanú)
docker compose restart                        # Reštartovať
docker compose up --build -d                  # Aktualizovať na novú verziu
docker compose logs --tail=30                 # Zobraziť logy
docker compose ps                             # Stav kontajnera

# ── Správa dát ────────────────────────────────────────────────
docker exec rafting-dunajec /app/scripts/backup.sh          # Zálohovať
docker exec rafting-dunajec node /app/server/migrate-encrypt.js  # Migrovať dáta

# ── Heslá ─────────────────────────────────────────────────────
# Zobraziť aktuálne heslo do aplikácie:
$p=[System.IO.File]::ReadAllText(".\secrets\app_password",[System.Text.Encoding]::ASCII); Write-Host $p

# Vygenerovať nové heslo do aplikácie:
function New-B64Secret([int]$b){$x=New-Object byte[] $b;[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($x);return [Convert]::ToBase64String($x)}
[System.IO.File]::WriteAllText(".\secrets\app_password",(New-B64Secret 18),[System.Text.Encoding]::ASCII)
docker compose restart
```

---

*Posledná aktualizácia: Máj 2026*
