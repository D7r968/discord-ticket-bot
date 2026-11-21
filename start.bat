@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Discord Ticket Bot

if not exist node_modules (
    echo [i] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo [!] Install failed. Check internet and Node.js.
        pause
        exit /b 1
    )
)

echo [i] Starting bot...
node index.js
echo.
echo [!] Bot stopped.
pause