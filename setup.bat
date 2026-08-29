@echo off
setlocal EnableDelayedExpansion

echo ============================================================
echo  PomegranateAI - Automated Grading System Setup
echo ============================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10+ from python.org
    pause & exit /b 1
)
echo [OK] Python found.

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node 20+ from nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js found.

:: Python venv
if not exist ".venv" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat

echo [SETUP] Installing Python ML dependencies...
pip install --quiet --upgrade pip
pip install --quiet -r ml_service\requirements.txt

:: Backend
echo [SETUP] Installing Node backend dependencies...
cd backend
call npm install --silent
cd ..

:: Frontend
echo [SETUP] Installing Node frontend dependencies...
cd frontend
call npm install --silent
cd ..

echo.
echo ============================================================
echo  SETUP COMPLETE
echo ============================================================
echo.
echo  Next Steps:
echo  1. TRAIN MODELS (run in the .venv virtual environment):
echo     python train_disease_classifier.py
echo     python train_ripeness_vit.py
echo     python train_multitask.py
echo.
echo  2. START SERVICES (development mode):
echo     Start ML service:   uvicorn ml_service.app:app --host 0.0.0.0 --port 8000
echo     Start Backend:      cd backend ^&^& node server.js
echo     Start Frontend:     cd frontend ^&^& npm run dev
echo.
echo  3. OR USE DOCKER (production):
echo     docker-compose up --build
echo.
echo  Dashboard: http://localhost:3000
echo  API:       http://localhost:5000
echo  ML Service: http://localhost:8000/docs
echo.
pause
