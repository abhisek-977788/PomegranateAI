"""
train_disease_classifier.py
Trains EfficientNet-B0 on the Pomegranate Disease Dataset.
Dataset Layout (d:\Deep\Pomegranate Diseases Dataset\):
    Alternaria/   Anthracnose/   Bacterial_Blight/   Cercospora/   Healthy/
    (1000 images each, 5000 total)

Outputs:
    weights/disease_classifier.pth
    weights/disease_label_map.json
"""

import os, json, time, copy, argparse
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, random_split, Subset
from torchvision import datasets, transforms, models
from torchvision.models import EfficientNet_B0_Weights

# -- Config ------------------------------------------------------------------
DATASET_ROOT = Path(r"d:\Deep\Pomegranate Diseases Dataset")
WEIGHTS_DIR  = Path(r"d:\Deep\pomegranate_ai\weights")
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

NUM_CLASSES  = 5
BATCH_SIZE   = 32
NUM_EPOCHS   = 40
LR           = 1e-3
WEIGHT_DECAY = 1e-4
VAL_SPLIT    = 0.15
TEST_SPLIT   = 0.10
IMG_SIZE     = 224
NUM_WORKERS  = 0   # Windows safe

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[device] {DEVICE}")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.05),
    transforms.RandomRotation(30),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize(int(IMG_SIZE * 1.14)),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])


class SubsetWithTransform(torch.utils.data.Dataset):
    """Wraps a Subset and allows overriding transform."""
    def __init__(self, subset, transform):
        self.subset    = subset
        self.transform = transform

    def __len__(self):
        return len(self.subset)

    def __getitem__(self, idx):
        img, label = self.subset.dataset.imgs[self.subset.indices[idx]]
        from PIL import Image
        img = Image.open(img).convert("RGB")
        return self.transform(img), label


def build_loaders():
    full_ds   = datasets.ImageFolder(DATASET_ROOT, transform=train_tf)
    label_map = {v: k for k, v in full_ds.class_to_idx.items()}

    n       = len(full_ds)
    n_val   = int(n * VAL_SPLIT)
    n_test  = int(n * TEST_SPLIT)
    n_train = n - n_val - n_test

    indices        = torch.randperm(n, generator=torch.Generator().manual_seed(42)).tolist()
    train_indices  = indices[:n_train]
    val_indices    = indices[n_train:n_train + n_val]
    test_indices   = indices[n_train + n_val:]

    train_ds = SubsetWithTransform(Subset(full_ds, train_indices), train_tf)
    val_ds   = SubsetWithTransform(Subset(full_ds, val_indices),   val_tf)
    test_ds  = SubsetWithTransform(Subset(full_ds, test_indices),  val_tf)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=NUM_WORKERS)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)

    print(f"[dataset] train={n_train}  val={n_val}  test={n_test}")
    print(f"[classes] {label_map}")
    return train_loader, val_loader, test_loader, label_map


def build_model(num_classes):
    model = models.efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return model.to(DEVICE)


def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    running_loss = correct = total = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        out  = model(imgs)
        loss = criterion(out, labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * imgs.size(0)
        correct      += (out.argmax(1) == labels).sum().item()
        total        += imgs.size(0)
    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    running_loss = correct = total = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        out  = model(imgs)
        loss = criterion(out, labels)
        running_loss += loss.item() * imgs.size(0)
        correct      += (out.argmax(1) == labels).sum().item()
        total        += imgs.size(0)
    return running_loss / total, correct / total


def train():
    train_loader, val_loader, test_loader, label_map = build_loaders()
    model     = build_model(NUM_CLASSES)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS, eta_min=1e-6)

    best_val_acc = 0.0
    best_weights = None

    for epoch in range(1, NUM_EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, criterion, optimizer)
        va_loss, va_acc = evaluate(model, val_loader, criterion)
        scheduler.step()
        elapsed = time.time() - t0
        print(f"Epoch {epoch:03d}/{NUM_EPOCHS} | train {tr_loss:.4f}/{tr_acc:.4f} "
              f"| val {va_loss:.4f}/{va_acc:.4f} | lr={scheduler.get_last_lr()[0]:.2e} | {elapsed:.1f}s")

        if va_acc > best_val_acc:
            best_val_acc = va_acc
            best_weights = copy.deepcopy(model.state_dict())
            torch.save(best_weights, WEIGHTS_DIR / "disease_classifier.pth")
            print(f"  ? best saved (val_acc={best_val_acc:.4f})")

    model.load_state_dict(best_weights)
    te_loss, te_acc = evaluate(model, test_loader, criterion)
    print(f"\n[TEST] loss={te_loss:.4f}  acc={te_acc:.4f}")

    with open(WEIGHTS_DIR / "disease_label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"[done] {WEIGHTS_DIR / 'disease_classifier.pth'}")


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
