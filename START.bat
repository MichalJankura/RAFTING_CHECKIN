@echo off
setlocal enabledelayedexpansion
title Rafting Dunajec
set URL=http://localhost:3001

echo Spustam RAFTING DUNAJEC...

rem Skontroluj ci Docker bezi
docker info >nul 2>&1
if errorlevel 1 (
    echo CHYBA: Docker nie je spusteny.
    echo Spusti Docker Desktop a skus znova.
    pause
    exit /b 1
)

rem Spusti obe sluzby (rafting-dunajec + ocr-service) definovane v docker-compose.yml
echo Spustam kontajnery (rafting-dunajec + ocr-service)...
docker compose up -d
if errorlevel 1 (
    echo CHYBA: docker compose zlyhal.
    pause
    exit /b 1
)

rem Cakaj kym server bezi na porte 3001.
rem ocr-service ma start_period 120s - hlavna appka nastartuje az potom.
echo Cakam kym server nastartuje (moze trvat 2-3 minuty)...
set TRIES=0
:wait
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',3001);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :open
set /a TRIES=%TRIES%+1
set /a MOD=%TRIES% %% 10
if %MOD% equ 0 echo   ... stale cakam ^(%TRIES%x3 s^) - OCR sluzba sa inicializuje...
if %TRIES% lss 120 goto :wait
echo CHYBA: Server sa nespustil do 6 minut.
echo Skontroluj logy: docker compose logs
pause
exit /b 1

:open
start "" "%URL%"
echo.
echo Aplikacia bezi na %URL%
echo.

rem Zobraz Netbird VPN adresu ak je dostupna
for /f "tokens=2 delims=:" %%a in ('netbird status 2^>nul ^| findstr /i "NetBird IP"') do (
    set NB_IP=%%a
    set NB_IP=!NB_IP: =!
    if not "!NB_IP!"=="N/A" echo   Netbird:   http://!NB_IP!:3001
)

rem Zobraz LAN adresu
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^172\.' -and $_.IPAddress -notmatch '^169\.' }).IPAddress -join ' '"') do (
    for %%j in (%%i) do echo   LAN:       http://%%j:3001
)

echo.
echo Bezace kontajnery:
docker compose ps --format "table {{.Name}}\t{{.Status}}"
echo.
echo Na zastavenie spusti STOP.bat
echo Na zobrazenie logov: docker compose logs -f
