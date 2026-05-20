@echo off
chcp 65001 >nul
title Rafting Dunajec
set URL=http://localhost:3001

echo Spustam RAFTING DUNAJEC...

:: Skontroluj ci Docker bezi
docker info >nul 2>&1
if errorlevel 1 (
    echo CHYBA: Docker nie je spusteny.
    echo Spusti Docker Desktop a skus znova.
    pause
    exit /b 1
)

:: Build + spusti kontajner
echo Buildujem a spustam kontajner ^(moze trvat par minut pri prvom spusteni^)...
docker compose up -d --build
if errorlevel 1 (
    echo CHYBA: docker compose zlyhal.
    pause
    exit /b 1
)

:: Cakaj kym server bezi na porte 3001
echo Cakam kym server nastartuje...
set TRIES=0
:wait
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('localhost',3001);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :open
set /a TRIES=%TRIES%+1
if %TRIES% lss 30 goto :wait
echo CHYBA: Server sa nespustil do 60 sekund.
echo Skontroluj logy: docker compose logs
pause
exit /b 1

:open
start "" "%URL%"
echo.
echo Aplikacia bezi na %URL%
echo.
for /f "tokens=2 delims=:" %%a in ('netbird status 2^>nul ^| findstr /i "NetBird IP"') do (
    set NB_IP=%%a
    setlocal enabledelayedexpansion
    set NB_IP=!NB_IP: =!
    if not "!NB_IP!"=="N/A" echo   Netbird:   http://!NB_IP!:3001
    endlocal
)
for /f %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^172\.' -and $_.IPAddress -notmatch '^169\.' }).IPAddress -join ' '"') do (
    for %%j in (%%i) do echo   LAN:       http://%%j:3001
)
echo.
echo Na zastavenie spusti STOP.bat
echo Na zobrazenie logov: docker compose logs -f
