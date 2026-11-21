@echo off
cd /d "%~dp0"
title Discord Ticket Bot - Auto Restart

:loop
echo [%date% %time%] Starting bot...
node index.js
echo [%date% %time%] Bot stopped. Restarting in 5 seconds...
ping -n 6 127.0.0.1 >nul
goto loop
