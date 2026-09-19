@echo off
title PomegranateAI Service Launcher
echo ============================================================
echo  Launching PomegranateAI Full-Stack Services in 3 Terminals
echo ============================================================

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo Starting ML Service on port 8000...
start "PomegranateAI - ML Service (Port 8000)" cmd /k "cd /d "%ROOT_DIR%" && if exist .venv\Scripts\activate.bat (call .venv\Scripts\activate.bat) && python -m uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Backend API on port 5000...
start "PomegranateAI - Express Backend (Port 5000)" cmd /k "cd /d "%ROOT_DIR%\backend" && node server.js"

echo Starting Frontend on port 3000...
start "PomegranateAI - React Frontend (Port 3000)" cmd /k "cd /d "%ROOT_DIR%\frontend" && npm run dev"

echo.
echo All 3 services launched in separate windows!
echo - Frontend:    http://localhost:3000
echo - Backend:     http://localhost:5000
echo - ML Swagger:  http://localhost:8000/docs
echo.
pause
