# PomegranateAI — Automated Grading System

> Production-ready, modular system for **Pomegranate Ripeness Grading**, **Weight Tiering**, and **Defect Detection**.  
> Combines a Python Deep Learning Inference Engine (FastAPI + PyTorch) with a Full-Stack MERN Application.

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
│   ├── models/Inspection.js     # Mongoose schema
│   ├── routes/inspections.js    # Route declarations
│   ├── controllers/
│   │   └── inspectionController.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Layout + tab routing
│   │   ├── api/client.js        # Axios API client
│   │   ├── hooks/useInspection.js
│   │   └── components/
│   │       ├── InspectionDashboard.jsx  # Upload + live results
│   │       ├── MetricsPanel.jsx         # Recharts analytics
│   │       ├── HistoryTable.jsx         # Paginated history
│   │       ├── ResultCard.jsx           # Per-image result card
│   │       ├── BBoxOverlay.jsx          # Canvas bbox renderer
│   │       └── UploadZone.jsx           # Drag-and-drop
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile (Nginx)
│
├── weights/                     # Place .pth files here after training
├── docker-compose.yml
├── .env.example
├── setup.bat                    # Windows one-click setup
└── setup.sh                     # Linux/macOS setup
```

---

## Quick Start

### Option A — Docker (Recommended for Production)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Train models first (see Training section), then:
docker-compose up --build

# Services:
#   Dashboard  →  http://localhost:3000
#   API        →  http://localhost:5000
#   ML Docs    →  http://localhost:8000/docs
#   MongoDB    →  localhost:27017
```

### Option B — Development Mode (Windows)

```bat
# Run the one-click setup
setup.bat

# Activate Python venv
.venv\Scripts\activate

# Start ML service (new terminal)
uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 --reload

# Start backend (new terminal)
cd backend
node server.js

# Start frontend (new terminal)
cd frontend
npm run dev
```

### Option B — Development Mode (Linux/macOS)

```bash
chmod +x setup.sh && ./setup.sh
source .venv/bin/activate
uvicorn ml_service.app:app --host 0.0.0.0 --port 8000 --reload &
cd backend && node server.js &
cd frontend && npm run dev
```

---

## Phase 1 — Training the Models

All three scripts must be run from the `pomegranate_ai/` directory with the virtual environment active.

### 1. Disease / Defect Classifier (EfficientNet-B0)

```bash
python train_disease_classifier.py [--epochs 40] [--batch-size 32] [--lr 1e-3]
```

- **Input:** `d:\Deep\Pomegranate Diseases Dataset\` (5 class folders)
- **Output:** `weights/disease_classifier.pth` + `weights/disease_label_map.json`
- **Architecture:** EfficientNet-B0, frozen backbone, fine-tuned head
- **Augmentation:** RandomResizedCrop, Flip, ColorJitter, Rotation
- **Scheduler:** CosineAnnealing, AdamW, label smoothing=0.1

### 2. Growth / Ripeness Classifier (ViT-B/16)

```bash
python train_ripeness_vit.py [--epochs 30] [--batch-size 32] [--lr 2e-5]
```

- **Input:** `d:\Deep\Pomegranate Images Dataset\VOC2007\` (VOC XML annotations)
- **Output:** `weights/ripeness_vit.pth` + `weights/ripeness_label_map.json`
- **Architecture:** ViT-B/16, last 4 encoder blocks + head unfrozen
- **Labels:** Determined by dominant class in each image's VOC XML annotation
- **Split:** Pre-defined train.txt / val.txt / test.txt (4683 / 587 / 587)

### 3. Multi-Head Grading (EfficientNet-V2-L)

```bash
python train_multitask.py [--epochs 50] [--batch-size 16] [--lr 5e-4]
```

- **Input:** `d:\Deep\to upload\` (12 folders: G1_Q1 … G3_Q4)
- **Output:** `weights/multitask_efficientnet.pth` + `weights/grading_label_map.json`
- **Architecture:** EfficientNet-V2-L shared backbone + two FC heads
- **Loss:** `L_total = 0.4 × CE(Weight) + 0.6 × CE(Quality)`
- **Head A — Weight Tier:** G1 (300–400 g), G2 (200–300 g), G3 (100–200 g)
- **Head B — Quality Tier:** Q1 (Export), Q2 (Retail), Q3 (Juice), Q4 (Reject)

> **GPU strongly recommended for training.** CPU training is supported but will be slow (especially ViT and EfficientNet-V2-L).

---

## Phase 2 — ML Microservice (FastAPI)

Starts on `http://localhost:8000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Device, model load status, timestamp |
| `/api/v1/models/status` | GET | Per-model weight status |
| `/api/v1/predict` | POST | Multipart upload, returns full prediction JSON |
| `/docs` | GET | Swagger UI |

### Prediction Response Schema

```json
{
  "predictions": [{
    "filename": "img.jpg",
    "health": {
      "status": "Healthy",
      "confidence": 0.9821,
      "is_healthy": true,
      "defect_count": 0,
      "bboxes": [],
      "all_probs": { "Healthy": 0.9821, "Alternaria": 0.005, ... }
    },
    "ripeness": {
      "stage": "mature",
      "confidence": 0.9341,
      "is_mature": true,
      "all_probs": { "mature": 0.9341, "mid-growth": 0.045, ... }
    },
    "grading": {
      "weight_tier": "G1",
      "weight_confidence": 0.8712,
      "quality_tier": "Q1",
      "quality_confidence": 0.7943
    },
    "sorting": {
      "action": "ROUTE: PREMIUM EXPORT",
      "badge_color": "gold"
    },
    "processing_time_ms": 312.4
  }],
  "batch_size": 1
}
```

### Sorting Rule Engine

| Condition | Action |
|-----------|--------|
| Infected OR Q4 | `REJECT / DISCARD` 🔴 |
| Healthy + Mature + Q1 + G1 | `ROUTE: PREMIUM EXPORT` 🥇 |
| Healthy + Mature + Q2 | `ROUTE: DOMESTIC RETAIL` 🟢 |
| Healthy + Q3 | `ROUTE: JUICE / AGRO-PROCESSING` 🟠 |
| Otherwise | `HOLD / RE-INSPECT` 🟡 |

---

## Phase 3 — Express.js Backend API

Starts on `http://localhost:5000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server + MongoDB status |
| `/api/inspections/process` | POST | Upload images → ML → store → return |
| `/api/inspections/batches` | GET | Batch-level aggregated metrics |
| `/api/inspections/history` | GET | Paginated history (filterable) |
| `/api/inspections/stats` | GET | Global stats for dashboard |

**History query params:** `page`, `limit`, `qualityTier`, `healthStatus`, `batchNumber`, `from`, `to`

---

## Phase 4 — React Dashboard

Three-tab layout at `http://localhost:3000`:

| Tab | Description |
|-----|-------------|
| **Live Inspection** | Drag-and-drop upload, real-time bounding box overlay canvas, per-image result cards with health/ripeness/weight/quality status |
| **Analytics** | Recharts bar + donut charts — Maturity Distribution, Quality Distribution, Health Breakdown; summary metric cards |
| **History** | Paginated table, filterable by quality tier and health status, shows routing action badge |

---

## Environment Variables

Copy `.env.example` → `.env` and adjust:

```env
# MongoDB
MONGO_URI=mongodb://mongodb:27017/pomegranate_db

# Express backend
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=production

# ML service
ML_SERVICE_URL=http://ml-service:8000
WEIGHTS_DIR=./weights

# Frontend (Vite build-time)
VITE_API_URL=http://localhost:5000/api
```

---

## GPU Support (Docker)

Uncomment the `deploy.resources` block in `docker-compose.yml` for NVIDIA GPU:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

Requires `nvidia-container-toolkit` installed on the host.

---

## Model Weight Files (after training)

| File | Size (est.) | Model |
|------|------------|-------|
| `weights/disease_classifier.pth` | ~20 MB | EfficientNet-B0 |
| `weights/ripeness_vit.pth` | ~340 MB | ViT-B/16 |
| `weights/multitask_efficientnet.pth` | ~480 MB | EfficientNet-V2-L |

> The ML service runs with **random weights** if `.pth` files are missing — predictions will be meaningless but the pipeline architecture is fully functional for testing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| DL Training | PyTorch 2.x, torchvision, EfficientNet-B0/V2-L, ViT-B/16 |
| Inference Service | FastAPI, Uvicorn, Pydantic |
| Database | MongoDB 7 + Mongoose ODM |
| Backend API | Express.js 4, Multer, Axios, Morgan |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts, Lucide Icons, react-dropzone |
| Containerization | Docker Compose (multi-service), Nginx |

---

*Built for automated conveyor-line pomegranate sorting — disease screening, ripeness grading, weight tiering, and quality routing in a unified pipeline.*
