# PomegranateAI — Automated Grading System

> Production-ready, modular system for **Pomegranate Ripeness Grading**, **Weight Tiering**, and **Defect Detection**.  
> Combines a Python Deep Learning Inference Engine (FastAPI + PyTorch) with a Full-Stack MERN Application.

---

## 🌐 Live Production Deployment & Links

| Component | Link / Details | Status |
| :--- | :--- | :---: |
| ⚡ **Live Web Application (Vercel)** | [**https://frontend-amber-sigma-46.vercel.app**](https://frontend-amber-sigma-46.vercel.app) | 🟢 **LIVE** |
| 📦 **GitHub Repository** | [**https://github.com/abhisek-977788/PomegranateAI.git**](https://github.com/abhisek-977788/PomegranateAI.git) | 🟢 **UP-TO-DATE** |
| 🔑 **JWT Enhanced Secret Key** | `]oz2L*|IkL5*yZ-&A*G.2cLVAYcM;5H0uWwE%d$jE!o` | 🔒 **CONFIGURED** |
| 💻 **Localhost Frontend** | `http://localhost:3000` | 🟢 **DEV SERVER** |
| ⚡ **Localhost Express Backend** | `http://localhost:5000` | 🟢 **REST API** |
| 🧠 **Localhost PyTorch ML Service** | `http://localhost:8000` | 🟢 **CUDA GPU ACTIVE** |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Conveyor Camera  →  React Dashboard (port 3000)                         │
│                            ↓ multipart/form-data                         │
│                   Express.js API (port 5000)                             │
│                            ↓ proxies to                                  │
│                   FastAPI ML Service (port 8000)                         │
│                     ┌──────┬──────────┬──────────────┐                  │
│                     │      │          │               │                  │
│             Disease │ Ripeness │  Multi-Head  │ Rule Engine │            │
│           EfficientNet  ViT-B/16  EfficientNetV2L  → Routing            │
│                     └──────┴──────────┴──────────────┘                  │
│                            ↓ JSON                                        │
│                   MongoDB (port 27017)  ←  Stored Inspections            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

- 🍎 **Gemini Pomegranate Image Validation**: Automatic pre-screening engine prevents non-pomegranate uploads.
- ⚡ **Multi-Model Inference Pipeline**:
  - **Disease Classifier**: EfficientNet-B0 (5 classes: Healthy, Alternaria, Anthracnose, Bacterial Blight, Cercospora).
  - **Ripeness Classifier**: ViT-B/16 (5 stages: Bud, Flower, Early Fruit, Mid Growth, Mature).
  - **Grading & Tiering**: Multi-Head EfficientNetV2-L (Weight Tiers G1-G3, Quality Tiers Q1-Q4).
- 🔗 **Cross-Page Data Persistence**: Complete state synchronization across **Live Inspection**, **Analytics**, and **History** tabs so data is never lost.
- 🔐 **User Authentication**: Secure JWT signup and login with MongoDB Atlas persistence and safe offline fallback.
- 📊 **Real-Time Interactive Analytics**: Recharts distribution graphs, viability metrics, and defect rates.
- 📜 **Historical Record Log**: Filterable table view with image thumbnail previews and routing action badges.

---

## Datasets

| # | Dataset | Location | Classes | Size |
|---|---------|----------|---------|------|
| 1 | **Disease/Defect** | `d:\Deep\Pomegranate Diseases Dataset\` | Alternaria, Anthracnose, Bacterial_Blight, Cercospora, Healthy | 5 × 1,000 imgs |
| 2 | **Growth/Ripeness** | `d:\Deep\Pomegranate Images Dataset\VOC2007\` | bud, flower, early-fruit, mid-growth, mature | 5,857 imgs (VOC XML + YOLO labels) |
| 3 | **Multi-Head Grading** | `d:\Deep\to upload\` | G1-G3 × Q1-Q4 (12 folders) | 12 × 91 = 1,092 imgs |

---

## Project Structure

```
pomegranate_ai/
├── train_disease_classifier.py   # EfficientNet-B0  →  5-class disease
├── train_ripeness_vit.py         # ViT-B/16 fine-tune → 5-class ripeness
├── train_multitask.py            # EfficientNetV2-L dual-head (G×Q)
│
├── ml_service/
│   ├── app.py                   # FastAPI inference microservice
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/
│   ├── server.js                # Express.js entry point
│   ├── models/User.js           # User authentication schema
│   ├── models/Inspection.js     # Mongoose inspection schema
│   ├── routes/inspections.js    # Route declarations
│   ├── controllers/
│   │   ├── authController.js
│   │   └── inspectionController.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── api/                     # Vercel Serverless Function Endpoints
│   │   ├── auth/                # register.js, login.js, me.js
│   │   └── inspections/         # process.js, stats.js, history.js
│   ├── src/
│   │   ├── App.jsx              # Layout + tab routing
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── InspectionContext.jsx
│   │   ├── api/client.js        # Axios API client
│   │   ├── hooks/useInspection.js
│   │   └── components/
│   │       ├── InspectionDashboard.jsx  # Upload + live results
│   │       ├── MetricsPanel.jsx         # Recharts analytics
│   │       ├── HistoryTable.jsx         # Paginated history
│   │       ├── ResultCard.jsx           # Per-image result card
│   │       ├── AuthModal.jsx            # Sign In / Registration modal
│   │       └── UploadZone.jsx           # Drag-and-drop
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── vercel.json              # Vercel deployment configuration
│
├── weights/                     # Place .pth files here after training
├── docker-compose.yml
├── .env.example
├── setup.bat                    # Windows one-click setup
└── setup.sh                     # Linux/macOS setup
```

---

## Quick Start

### Option A — Development Mode (Windows / macOS)

```bash
# 1. Start ML Microservice
uvicorn ml_service.app:app --host 0.0.0.0 --port 8000

# 2. Start Express Backend API
cd backend
node server.js

# 3. Start Vite React Frontend
cd frontend
npm run dev
```

### Option B — Docker Containerized Deployment

```bash
# Copy environment file
cp .env.example .env

# Build and launch all services
docker-compose up --build
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Deep Learning** | PyTorch 2.x, torchvision, EfficientNet-B0/V2-L, ViT-B/16 |
| **Inference Service** | FastAPI, Uvicorn, Pydantic, Python-Multipart |
| **Backend API Gateway** | Node.js, Express.js, JWT, bcryptjs, Mongoose ODM |
| **Database** | MongoDB Atlas / MongoDB 7 |
| **Frontend Framework** | React 18, Vite 5, Tailwind CSS 3, Recharts, Lucide Icons |
| **Cloud Deployment** | Vercel Serverless Functions + Render |

---

*PomegranateAI &mdash; Automated Grading System for Pomegranate Ripeness, Weight Tiering, and Disease Screening.*
