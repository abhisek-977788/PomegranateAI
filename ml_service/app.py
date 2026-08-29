# ml_service/app.py  -  Pomegranate AI Inference Microservice
# ============================================================
# Endpoints:
#   GET  /health
#   POST /api/v1/predict        (single or batch multipart upload)
#   GET  /api/v1/models/status  (weight loading status)
#
# Pipeline:
#   Image -> DiseaseClassifier (EfficientNet-B0, 5-class)
#          -> RipenessViT (ViT-B/16, 5-class)
#          -> MultiHeadGrading (EfficientNet-V2-L, 3+4 class)
#          -> Sorting Rule Engine -> JSON response

import os, time, io, json
from pathlib import Path
from typing import List
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent / ".env")

import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import (
    efficientnet_b0, EfficientNet_B0_Weights,
    vit_b_16, ViT_B_16_Weights,
    efficientnet_v2_l, EfficientNet_V2_L_Weights,
)
from PIL import Image

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Paths & device
# ---------------------------------------------------------------------------
WEIGHTS_DIR = Path(os.getenv("WEIGHTS_DIR", r"d:/Deep/pomegranate_ai/weights"))
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[ml_service] device={DEVICE}  weights={WEIGHTS_DIR}")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# ---------------------------------------------------------------------------
# Label maps
# ---------------------------------------------------------------------------
DISEASE_CLASSES  = ["Alternaria", "Anthracnose", "Bacterial_Blight", "Cercospora", "Healthy"]
RIPENESS_CLASSES = ["bud", "flower", "early-fruit", "mid-growth", "mature"]
WEIGHT_CLASSES   = ["G1", "G2", "G3"]
QUALITY_CLASSES  = ["Q1", "Q2", "Q3", "Q4"]

# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
_tf224 = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224),
    transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
_tf480 = transforms.Compose([
    transforms.Resize(512), transforms.CenterCrop(480),
    transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])


def _tensor(img_bytes: bytes, tf) -> torch.Tensor:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return tf(img).unsqueeze(0).to(DEVICE)


# ---------------------------------------------------------------------------
# Model architecture definitions  (must match training scripts exactly)
# ---------------------------------------------------------------------------
def build_disease_classifier(n=5):
    m = efficientnet_b0(weights=None)
    inf = m.classifier[1].in_features
    m.classifier = nn.Sequential(nn.Dropout(0.4, inplace=True), nn.Linear(inf, n))
    return m

def build_ripeness_vit(n=5):
    m = vit_b_16(weights=None)
    inf = m.heads.head.in_features
    m.heads.head = nn.Sequential(nn.Dropout(0.3), nn.Linear(inf, n))
    return m

class MultiHeadEfficientNetV2L(nn.Module):
    def __init__(self, nw=3, nq=4):
        super().__init__()
        base = efficientnet_v2_l(weights=None)
        self.backbone     = base.features
        self.pool         = base.avgpool
        self.dropout      = nn.Dropout(p=0.4)
        inf = base.classifier[1].in_features
        self.head_weight  = nn.Sequential(nn.Linear(inf,256), nn.GELU(), nn.Dropout(0.3), nn.Linear(256,nw))
        self.head_quality = nn.Sequential(nn.Linear(inf,256), nn.GELU(), nn.Dropout(0.3), nn.Linear(256,nq))
    def forward(self, x):
        f = self.backbone(x)
        f = self.pool(f)
        f = torch.flatten(f, 1)
        f = self.dropout(f)
        return self.head_weight(f), self.head_quality(f)


# ---------------------------------------------------------------------------
# Model registry (loaded once at startup)
# ---------------------------------------------------------------------------
class ModelRegistry:
    def __init__(self):
        self.disease = self.ripeness = self.grading = None
        self.status  = {}

    def _load(self, name, model_or_fn, weight_file, **kwargs):
        path = WEIGHTS_DIR / weight_file
        if callable(model_or_fn) and not isinstance(model_or_fn, type):
            model = model_or_fn(**kwargs).to(DEVICE)
        else:
            model = model_or_fn(**kwargs).to(DEVICE)
        if path.exists():
            state = torch.load(path, map_location=DEVICE, weights_only=True)
            model.load_state_dict(state)
            self.status[name] = "loaded"
            print(f"[model] {name} loaded from {path}")
        else:
            self.status[name] = "random_weights_no_training"
            print(f"[model] WARNING {name}: {path} missing, using random weights")
        model.eval()
        return model

    def load_all(self):
        self.disease  = self._load("disease",  build_disease_classifier, "disease_classifier.pth",   n=5)
        self.ripeness = self._load("ripeness", build_ripeness_vit,        "ripeness_vit.pth",         n=5)
        self.grading  = self._load("grading",  MultiHeadEfficientNetV2L,  "multitask_efficientnet.pth",nw=3,nq=4)


registry = ModelRegistry()


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------
@torch.no_grad()
def _run_disease(img_bytes: bytes) -> dict:
    t   = _tensor(img_bytes, _tf224)
    out = registry.disease(t)
    prb = torch.softmax(out, 1)[0].cpu().tolist()
    idx = int(out.argmax(1))
    return {
        "label":       DISEASE_CLASSES[idx],
        "confidence":  round(prb[idx], 4),
        "is_healthy":  DISEASE_CLASSES[idx] == "Healthy",
        "defect_count": 0 if DISEASE_CLASSES[idx] == "Healthy" else 1,
        "bboxes":      [],
        "all_probs":   {c: round(p, 4) for c, p in zip(DISEASE_CLASSES, prb)},
    }


@torch.no_grad()
def _run_ripeness(img_bytes: bytes) -> dict:
    t   = _tensor(img_bytes, _tf224)
    out = registry.ripeness(t)
    prb = torch.softmax(out, 1)[0].cpu().tolist()
    idx = int(out.argmax(1))
    return {
        "stage":      RIPENESS_CLASSES[idx],
        "confidence": round(prb[idx], 4),
        "is_mature":  RIPENESS_CLASSES[idx] == "mature",
        "all_probs":  {c: round(p, 4) for c, p in zip(RIPENESS_CLASSES, prb)},
    }


@torch.no_grad()
def _run_grading(img_bytes: bytes) -> dict:
    t        = _tensor(img_bytes, _tf480)
    w_out, q_out = registry.grading(t)
    wp = torch.softmax(w_out, 1)[0].cpu().tolist()
    qp = torch.softmax(q_out, 1)[0].cpu().tolist()
    wi = int(w_out.argmax(1)); qi = int(q_out.argmax(1))
    return {
        "weight_tier":        WEIGHT_CLASSES[wi],
        "weight_confidence":  round(wp[wi], 4),
        "quality_tier":       QUALITY_CLASSES[qi],
        "quality_confidence": round(qp[qi], 4),
        "weight_probs":       {c: round(p, 4) for c, p in zip(WEIGHT_CLASSES, wp)},
        "quality_probs":      {c: round(p, 4) for c, p in zip(QUALITY_CLASSES, qp)},
    }


def _sort(disease: dict, ripeness: dict, grading: dict) -> dict:
    h = disease["is_healthy"]
    m = ripeness["is_mature"]
    w = grading["weight_tier"]
    q = grading["quality_tier"]

    if not h or q == "Q4":
        return {"action": "REJECT / DISCARD",              "badge_color": "red"}
    if h and m and q == "Q1" and w == "G1":
        return {"action": "ROUTE: PREMIUM EXPORT",         "badge_color": "gold"}
    if h and m and q == "Q2":
        return {"action": "ROUTE: DOMESTIC RETAIL",        "badge_color": "green"}
    if h and q == "Q3":
        return {"action": "ROUTE: JUICE / AGRO-PROCESSING","badge_color": "orange"}
    return {"action": "HOLD / RE-INSPECT",                 "badge_color": "yellow"}


def _validate_pomegranate(img_bytes: bytes) -> tuple:
    """
    Validates whether the main object in the image is specifically a pomegranate.
    Returns (True, "YES") if valid, or (False, "Uploaded image is not a pomegranate.") if invalid.
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=api_key)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            prompt = """Analyze the uploaded image and determine whether the main object is specifically a pomegranate.

Return ONLY one of these two responses:

YES
NO

Rules:
- Return YES only if the main object is clearly a pomegranate.
- Return NO if it is any other fruit, vegetable, object, person, or animal.
- Do not return YES just because it is a fruit.
- If the image is unclear or you are uncertain, return NO.
- Ignore background objects and focus on the main object."""

            resp = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[img, prompt],
                config=types.GenerateContentConfig(temperature=0.0)
            )
            ans = resp.text.strip().upper()
            print(f"[validation] result='{ans}' for image")
            if "YES" in ans and "NO" not in ans:
                return True, "YES"
            else:
                return False, "Uploaded image is not a pomegranate."

        # Fallback check using trained Disease Classifier confidence threshold
        t = _tensor(img_bytes, _tf224)
        out = registry.disease(t)
        prb = torch.softmax(out, 1)[0].cpu().tolist()
        if max(prb) < 0.35:
            return False, "Uploaded image is not a pomegranate."
        return True, "YES"
    except Exception as exc:
        print(f"[validation warning] {exc}")
        return True, "YES"


def _pipeline(img_bytes: bytes, filename: str) -> dict:
    t0 = time.perf_counter()

    # ── Image Validation System ──────────────────────────────────────────────
    is_valid, val_msg = _validate_pomegranate(img_bytes)
    if not is_valid:
        return {
            "filename": filename,
            "error": "Uploaded image is not a pomegranate.",
            "is_pomegranate": False,
            "processing_time_ms": round((time.perf_counter() - t0) * 1000, 2),
        }

    # ── If YES, proceed to test using trained model pipeline ──────────────────
    d  = _run_disease(img_bytes)
    r  = _run_ripeness(img_bytes)
    g  = _run_grading(img_bytes)
    s  = _sort(d, r, g)
    ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "filename": filename,
        "is_pomegranate": True,
        "health": {
            "status": d["label"], "confidence": d["confidence"],
            "is_healthy": d["is_healthy"], "defect_count": d["defect_count"],
            "bboxes": d["bboxes"], "all_probs": d["all_probs"],
        },
        "ripeness": {
            "stage": r["stage"], "confidence": r["confidence"],
            "is_mature": r["is_mature"], "all_probs": r["all_probs"],
        },
        "grading": {
            "weight_tier": g["weight_tier"], "weight_confidence": g["weight_confidence"],
            "quality_tier": g["quality_tier"], "quality_confidence": g["quality_confidence"],
            "weight_probs": g["weight_probs"], "quality_probs": g["quality_probs"],
        },
        "sorting": s,
        "processing_time_ms": ms,
    }


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Pomegranate AI Inference Service",
    version="1.0.0",
    description="Disease screening, ripeness grading, and weight/quality tiering",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    registry.load_all()


@app.get("/health")
def health():
    return {"status": "ok", "device": str(DEVICE), "models": registry.status, "ts": time.time()}


@app.get("/api/v1/models/status")
def model_status():
    return registry.status


@app.post("/api/v1/predict")
async def predict(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(400, "No files provided")
    results = []
    for f in files:
        raw = await f.read()
        try:
            res = _pipeline(raw, f.filename or "unknown")
        except Exception as exc:
            res = {"filename": f.filename, "error": str(exc)}
        results.append(res)
    return {"predictions": results, "batch_size": len(results), "ts": time.time()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
