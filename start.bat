@echo off
REM Double-click to start FlowShop (backend + frontend)
start "FlowShop backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "FlowShop frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 6 /nobreak >nul
start http://localhost:5173
