@echo off
title PomegranateAI Project Terminal
cd /d "%~dp0"
if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat
echo ============================================================
echo  PomegranateAI Project Terminal
echo ============================================================
echo  Working directory: %CD%
echo.
echo  Commands you can run:
echo    - uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 --reload
echo    - cd backend && node server.js
echo    - cd frontend && npm run dev
echo.
cmd /k
