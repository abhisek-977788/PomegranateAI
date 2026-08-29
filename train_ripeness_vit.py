"""
train_ripeness_vit.py
─────────────────────────────────────────────────────────────────────────────
Fine-tunes ViT-B/16 on the Pomegranate Growth Stage dataset (VOC2007 format).
Dataset:  d:\Deep\Pomegranate Images Dataset\VOC2007\
  JPEGImages/   - 5857 JPEG images (480x640)
  ImageSets/Main/train.txt, val.txt, test.txt  - pre-split IDs
  Annotations/  - VOC XML with bnd-box + class label (bud/flower/early-fruit/mid-growth/mature)

Outputs:
    weights/ripeness_vit.pth
    weights/ripeness_label_map.json
"""

import os, json, time, copy, argparse
from pathlib import Path
import xml.etree.ElementTree as ET

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.models import vit_b_16, ViT_B_16_Weights
from PIL import Image

# ── Config ──────────────────────────────────────────────────────────────────────────
DATA_ROOT    = Path(r"d:\Deep\Pomegranate Images Dataset\VOC2007")
JPEG_DIR     = DATA_ROOT / "JPEGImages"
ANNO_DIR     = DATA_ROOT / "Annotations"
SETS_DIR     = DATA_ROOT / "ImageSets" / "Main"
WEIGHTS_DIR  = Path(r"d:\Deep\pomegranate_ai\weights")
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

CLASS_NAMES  = ["bud", "flower", "early-fruit", "mid-growth", "mature"]
NUM_CLASSES  = len(CLASS_NAMES)
CLS2IDX      = {c: i for i, c in enumerate(CLASS_NAMES)}

BATCH_SIZE   = 32
NUM_EPOCHS   = 30
LR           = 2e-5
WEIGHT_DECAY = 1e-4
IMG_SIZE     = 224
NUM_WORKERS  = 0

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[device] {DEVICE}")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25),
    transforms.RandomRotation(20),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])


# ── Dataset ───────────────────────────────────────────────────────────────────────────
def get_dominant_class(xml_path: Path) -> int:
    """Parse VOC XML and return the majority class index in the annotation."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    class_counts = {}
    for obj in root.findall("object"):
        name = obj.find("name").text.strip().lower()
        # Normalise synonyms
        if name == "mature":
            name = "mature"
        class_counts[name] = class_counts.get(name, 0) + 1
    if not class_counts:
        return 0
    dominant = max(class_counts, key=class_counts.get)
    return CLS2IDX.get(dominant, 0)


class PomegranateRipenessDataset(Dataset):
    def __init__(self, split: str, transform):
        assert split in ("train", "val", "test")
        ids_file = SETS_DIR / f"{split}.txt"
        self.ids = [line.strip() for line in ids_file.read_text().splitlines() if line.strip()]
        self.transform = transform
        # Pre-compute labels
        self.samples = []
        for img_id in self.ids:
            jpg_path = JPEG_DIR / f"{img_id}.jpg"
            xml_path = ANNO_DIR / f"{img_id}.xml"
            if jpg_path.exists() and xml_path.exists():
                label = get_dominant_class(xml_path)
                self.samples.append((jpg_path, label))
        print(f"[{split}] {len(self.samples)} samples")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        return self.transform(img), label


def build_loaders():
    train_ds = PomegranateRipenessDataset("train", train_tf)
    val_ds   = PomegranateRipenessDataset("val",   val_tf)
    test_ds  = PomegranateRipenessDataset("test",  val_tf)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=NUM_WORKERS)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    return train_loader, val_loader, test_loader


# ── Model ────────────────────────────────────────────────────────────────────────────
def build_model(num_classes):
    model = vit_b_16(weights=ViT_B_16_Weights.IMAGENET1K_V1)
    # Replace classification head
    in_features = model.heads.head.in_features
    model.heads.head = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(in_features, num_classes)
    )
    # Unfreeze last 4 encoder blocks + head
    for name, param in model.named_parameters():
        param.requires_grad = False
    for name, param in model.named_parameters():
        if any(k in name for k in ["encoder.layers.encoder_layer_1", "heads",
                                    "encoder.layers.encoder_layer_9",
                                    "encoder.layers.encoder_layer_10",
                                    "encoder.layers.encoder_layer_11"]):
            param.requires_grad = True
    return model.to(DEVICE)


# ── Train / Eval ────────────────────────────────────────────────────────────────────────
def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    total_loss = correct = total = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        out  = model(imgs)
        loss = criterion(out, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * imgs.size(0)
        correct    += (out.argmax(1) == labels).sum().item()
        total      += imgs.size(0)
    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total_loss = correct = total = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        out  = model(imgs)
        loss = criterion(out, labels)
        total_loss += loss.item() * imgs.size(0)
        correct    += (out.argmax(1) == labels).sum().item()
        total      += imgs.size(0)
    return total_loss / total, correct / total


def train():
    train_loader, val_loader, test_loader = build_loaders()
    model     = build_model(NUM_CLASSES)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=WEIGHT_DECAY
    )
    scheduler = CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS, eta_min=1e-7)

    # ── Checkpoint / Resume ──────────────────────────────────────────────────
    ckpt_path = WEIGHTS_DIR / "ripeness_vit.pth"
    start_epoch = 1
    best_val_acc = 0.0
    best_weights = None

    if ckpt_path.exists():
        print(f"[resume] Loading existing checkpoint: {ckpt_path}", flush=True)
        state = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(state)
        best_weights = copy.deepcopy(model.state_dict())
        # Evaluate current checkpoint to get exact val acc
        val_loss, best_val_acc = evaluate(model, val_loader, criterion)
        print(f"[resume] Checkpoint loaded (val_acc={best_val_acc:.4f})", flush=True)

    for epoch in range(start_epoch, NUM_EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, criterion, optimizer)
        va_loss, va_acc = evaluate(model, val_loader, criterion)
        scheduler.step()
        elapsed = time.time() - t0
        print(f"Epoch {epoch:03d}/{NUM_EPOCHS} | "
              f"train {tr_loss:.4f}/{tr_acc:.4f} | "
              f"val {va_loss:.4f}/{va_acc:.4f} | "
              f"lr={scheduler.get_last_lr()[0]:.2e} | {elapsed:.1f}s", flush=True)
        if va_acc > best_val_acc:
            best_val_acc = va_acc
            best_weights = copy.deepcopy(model.state_dict())
            torch.save(best_weights, ckpt_path)
            print(f"  >>> saved best (val_acc={best_val_acc:.4f})", flush=True)

    model.load_state_dict(best_weights)
    te_loss, te_acc = evaluate(model, test_loader, criterion)
    print(f"\n[TEST] loss={te_loss:.4f}  acc={te_acc:.4f}")

    label_map = {str(i): c for i, c in enumerate(CLASS_NAMES)}
    with open(WEIGHTS_DIR / "ripeness_label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"[done] {WEIGHTS_DIR / 'ripeness_vit.pth'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",     type=int,   default=NUM_EPOCHS)
    parser.add_argument("--batch-size", type=int,   default=BATCH_SIZE)
    parser.add_argument("--lr",         type=float, default=LR)
    args = parser.parse_args()
    NUM_EPOCHS = args.epochs
    BATCH_SIZE = args.batch_size
    LR         = args.lr
    train()
