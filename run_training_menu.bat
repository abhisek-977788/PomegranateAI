@echo off
title PomegranateAI Model Trainer
cd /d d:\Deep\pomegranate_ai
:MENU
cls
echo ============================================================
echo  PomegranateAI Deep Learning Training Center
echo ============================================================
echo.
echo  [1] Train Disease Classifier (EfficientNet-B0)
echo  [2] Train Ripeness ViT (ViT-B/16)
echo  [3] Train Multi-Task Grading (Dual-Head EfficientNetV2-L)
echo  [4] Train ALL 3 Models Sequentially
echo  [5] Exit
echo.
set /p choice="Select an option (1-5): "

if "%choice%"=="1" goto D1
if "%choice%"=="2" goto D2
if "%choice%"=="3" goto D3
if "%choice%"=="4" goto DALL
if "%choice%"=="5" exit /b 0
goto MENU

:D1
echo.
echo Running Disease Classifier Training...
python train_disease_classifier.py --epochs 20 --batch-size 16
pause
goto MENU

:D2
echo.
echo Running Ripeness ViT Training...
python train_ripeness_vit.py --epochs 10 --batch-size 16
pause
goto MENU

:D3
echo.
echo Running Multi-Task Grading Training...
python train_multitask.py --epochs 20 --batch-size 8
pause
goto MENU

:DALL
echo.
echo Running ALL 3 Training Pipelines...
python train_disease_classifier.py --epochs 20 --batch-size 16
python train_ripeness_vit.py --epochs 10 --batch-size 16
python train_multitask.py --epochs 20 --batch-size 8
echo.
echo All training completed! Saved to weights/
pause
goto MENU
