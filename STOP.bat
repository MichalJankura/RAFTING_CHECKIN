@echo off
chcp 65001 >nul
title Rafting Dunajec — zastavanie

echo Zastavujem RAFTING DUNAJEC...

docker compose down
if errorlevel 1 (
    echo CHYBA: docker compose down zlyhal.
    pause
    exit /b 1
)

echo Server zastaveny. Data su zachovane v Docker volume.
pause
