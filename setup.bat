@echo off
REM Double-click to set up FlowShop (creates the database, .env, installs packages, adds demo data)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
