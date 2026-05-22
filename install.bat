@echo off
setlocal
title RAFTING DUNAJEC - Prvy install

echo.
echo  =========================================
echo   RAFTING DUNAJEC - Prvy install
echo  =========================================
echo.

rem --- 1. Docker check ---
docker info >nul 2>&1
if errorlevel 1 (
    echo  CHYBA: Docker nie je spusteny.
    echo  Spusti Docker Desktop a skus znova.
    echo.
    pause
    exit /b 1
)
echo  [OK] Docker bezi.
echo.

rem --- 2. Vytvor priecinok secrets\ ---
set "SD=%~dp0secrets"
if not exist "%SD%" mkdir "%SD%"

rem Oprav: ak Docker vytvoril priecinky namiesto suborov, zmaz ich
for %%S in (app_encryption_key app_password db_password session_secret backup_passphrase) do (
    if exist "%SD%\%%S\" (
        echo  Opravujem: "%SD%\%%S" je priecinok ^(Docker bug^), mazem...
        rmdir /s /q "%SD%\%%S"
    )
)

rem --- 3. Existujuce kluce? ---
if exist "%SD%\app_encryption_key" (
    echo  POZOR: Tajne kluce uz existuju v priecinku secrets\
    echo  Nove kluce ZMAZU zasifrovanu databazu ^(stara data budu necitatelne^)!
    echo.
    choice /C AN /M "  Vygenerovat NOVE kluce? [A=Ano  N=Nie, preskocit generovanie]"
    if ERRORLEVEL 2 goto :docker_start
)

rem --- 4. Generovanie tajnych klucov ---
echo.
echo  Generujem tajne kluce (bez BOM, cista ASCII)...

rem app_encryption_key - 64 hex chars (32 nahodnych bajtov)
powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[IO.File]::WriteAllText('%SD%\app_encryption_key',(($b|%%{$_.ToString('x2')})-join''),[Text.Encoding]::ASCII)"
if errorlevel 1 ( echo  CHYBA: app_encryption_key && pause && exit /b 1 )

rem db_password - 64 hex chars
powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[IO.File]::WriteAllText('%SD%\db_password',(($b|%%{$_.ToString('x2')})-join''),[Text.Encoding]::ASCII)"
if errorlevel 1 ( echo  CHYBA: db_password && pause && exit /b 1 )

rem session_secret - 64 hex chars
powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[IO.File]::WriteAllText('%SD%\session_secret',(($b|%%{$_.ToString('x2')})-join''),[Text.Encoding]::ASCII)"
if errorlevel 1 ( echo  CHYBA: session_secret && pause && exit /b 1 )

rem backup_passphrase - 64 hex chars (pre scripts\backup.sh)
powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[IO.File]::WriteAllText('%SD%\backup_passphrase',(($b|%%{$_.ToString('x2')})-join''),[Text.Encoding]::ASCII)"
if errorlevel 1 ( echo  CHYBA: backup_passphrase && pause && exit /b 1 )

rem app_password - 24 alfanumericke znaky (ziadne specialne znaky)
powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);$p=([Convert]::ToBase64String($b)-replace'[^a-zA-Z0-9]');[IO.File]::WriteAllText('%SD%\app_password',$p.Substring(0,[Math]::Min(24,$p.Length)),[Text.Encoding]::ASCII)"
if errorlevel 1 ( echo  CHYBA: app_password && pause && exit /b 1 )

echo  [OK] Vsetky kluce vygenerovane.
echo.

rem --- 5. Build a spustenie kontajnerov ---
:docker_start
echo  Buildujem a spustam Docker kontajnery...
echo.
echo  UPOZORNENIE: prvy build stiahne PyTorch + EasyOCR modely (~1.5 GB).
echo  To moze trvat 15-30 minut podla rychlosti internetu.
echo  Dalsie buildy su rychle (vrstvy su cachovane).
echo.
docker compose up --build -d
if errorlevel 1 (
    echo.
    echo  CHYBA: docker compose up zlyhal. Pozri vystup vyssie.
    pause
    exit /b 1
)
echo.

rem --- 6. Cakanie na server ---
rem rafting-dunajec caka kym ocr-service je healthy (start_period 120s + retries).
rem Celkovo moze spustenie trvat 3-5 minut po dokonceni buildu.
echo  Cakam kym server nastartuje (moze trvat 3-5 minut)...
set TRIES=0
:wait
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',3001);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :server_ready
set /a TRIES=%TRIES%+1
set /a MOD=%TRIES% %% 10
if %MOD% equ 0 echo   ... stale cakam (%TRIES%x3 s) - OCR sluzba sa inicializuje...
if %TRIES% lss 120 goto :wait
echo  CHYBA: Server sa nespustil do 6 minut.
echo  Logy kontajnerov:
docker compose logs --tail 60
echo.
pause
exit /b 1

:server_ready
echo  [OK] Server bezi na porte 3001.
echo.

rem --- 7. Migracia existujucich zaznamov ---
echo  Migracia dat: zasifrovanie existujucich zaznamov...
docker exec rafting-dunajec node /app/server/migrate-encrypt.js
echo.

rem --- 8. Vypis hesla ---
for /f "usebackq delims=" %%P in ("%SD%\app_password") do set "APP_PASS=%%P"

echo.
echo  =========================================
echo.
echo    HESLO DO APLIKACIE:
echo.
echo        %APP_PASS%
echo.
echo    Zapiste si toto heslo a ulozit ho
echo    na bezpecne miesto (napr. KeePass).
echo    Subor: secrets\app_password
echo.
echo  =========================================
echo.
echo  Aplikacia: http://localhost:3001
echo.
echo  Dalsie prikazy:
echo    START.bat  -- spustenie po restarte PC
echo    STOP.bat   -- zastavenie kontajnera
echo.
pause
