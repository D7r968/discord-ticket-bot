@echo off
cd /d "%~dp0.."
set "DIR=%CD%"
(
echo === admin autostart setup ===
echo DIR=%DIR%
schtasks /create /tn "Discord Ticket Bot" /tr "\"%DIR%\run-forever.bat\"" /sc ONSTART /ru SYSTEM /rl HIGHEST /f
echo create-exit=%errorlevel%
schtasks /run /tn "Discord Ticket Bot"
echo run-exit=%errorlevel%
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Discord Ticket Bot.lnk" >nul 2>&1
echo startup-shortcut-removed
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
echo powercfg-done
) > "%DIR%\deploy\admin-setup.log" 2>&1
