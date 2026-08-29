#!/usr/bin/env bash
set -e

echo "============================================================"
echo " PomegranateAI - Automated Grading System Setup"
echo "============================================================"

command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 required"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "[ERROR] node required";   exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "[ERROR] npm required";    exit 1; }

# Python venv
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r ml_service/requirements.txt

# Node deps
cd backend && npm install --silent && cd ..
cd frontend && npm install --silent && cd ..

echo ""
echo "============================================================"
echo " SETUP COMPLETE"
echo "============================================================"
echo ""
echo " Train models:"
echo "   python train_disease_classifier.py"
echo "   python train_ripeness_vit.py"
echo "   python train_multitask.py"
echo ""
echo " Start services (dev):"
echo "   uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 &"
echo "   cd backend && node server.js &"
echo "   cd frontend && npm run dev"
echo ""
echo " Or Docker: docker-compose up --build"
echo " Dashboard: http://localhost:3000"
