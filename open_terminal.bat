@echo off
title PomegranateAI Project Terminal
cd /d d:\Deep\pomegranate_ai
echo ============================================================
echo  PomegranateAI Project Terminal
echo ============================================================
echo  Working directory: %CD%
echo.
echo  Commands you can run:
echo    - python train_disease_classifier.py --epochs 10 --batch-size 16
echo    - python train_ripeness_vit.py --epochs 5 --batch-size 16
echo    - python train_multitask.py --epochs 10 --batch-size 8
echo    - uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 --reload
echo    - cd backend && node server.js
echo    - cd frontend && npm run dev
echo.
cmd /k
