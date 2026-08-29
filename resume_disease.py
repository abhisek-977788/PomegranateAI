import os, json, time, copy, sys
from pathlib import Path
import torch, torch.nn as nn, torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models
from torchvision.models import EfficientNet_B0_Weights

DATASET_ROOT = Path(r"d:\Deep\Pomegranate Diseases Dataset")
WEIGHTS_DIR  = Path(r"d:\Deep\pomegranate_ai\weights")
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

NUM_CLASSES  = 5
BATCH_SIZE   = 32
NUM_EPOCHS   = 40
LR           = 1e-3
WEIGHT_DECAY = 1e-4
IMG_SIZE     = 224
NUM_WORKERS  = 0
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.7,1.0)),
    transforms.RandomHorizontalFlip(), transforms.RandomVerticalFlip(),
    transforms.ColorJitter(0.3,0.3,0.3,0.05), transforms.RandomRotation(30),
    transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])
val_tf = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

def build_loaders():
    full_ds = datasets.ImageFolder(DATASET_ROOT, transform=train_tf)
    n = len(full_ds)
    n_test = int(n*0.10); n_val = int(n*0.15); n_train = n - n_val - n_test
    train_ds, val_ds, test_ds = random_split(full_ds,[n_train,n_val,n_test],
        generator=torch.Generator().manual_seed(42))
    val_ds.dataset  = datasets.ImageFolder(DATASET_ROOT, transform=val_tf)
    test_ds.dataset = datasets.ImageFolder(DATASET_ROOT, transform=val_tf)
    label_map = {str(v):k for k,v in full_ds.class_to_idx.items()}
    print(f"[device] {DEVICE}")
    print(f"[dataset] train={n_train}  val={n_val}  test={n_test}")
    return (DataLoader(train_ds,BATCH_SIZE,shuffle=True,num_workers=NUM_WORKERS),
            DataLoader(val_ds,BATCH_SIZE,shuffle=False,num_workers=NUM_WORKERS),
            DataLoader(test_ds,BATCH_SIZE,shuffle=False,num_workers=NUM_WORKERS),
            label_map)

def build_model():
    m = models.efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)
    m.classifier = nn.Sequential(nn.Dropout(0.4,True), nn.Linear(m.classifier[1].in_features, NUM_CLASSES))
    return m.to(DEVICE)

def train_one_epoch(model,loader,criterion,optimizer):
    model.train(); loss_sum=correct=total=0
    for imgs,labels in loader:
        imgs,labels=imgs.to(DEVICE),labels.to(DEVICE)
        optimizer.zero_grad(); out=model(imgs); loss=criterion(out,labels)
        loss.backward(); optimizer.step()
        loss_sum+=loss.item()*imgs.size(0); correct+=(out.argmax(1)==labels).sum().item(); total+=imgs.size(0)
    return loss_sum/total, correct/total

@torch.no_grad()
def evaluate(model,loader,criterion):
    model.eval(); loss_sum=correct=total=0
    for imgs,labels in loader:
        imgs,labels=imgs.to(DEVICE),labels.to(DEVICE)
        out=model(imgs); loss=criterion(out,labels)
        loss_sum+=loss.item()*imgs.size(0); correct+=(out.argmax(1)==labels).sum().item(); total+=imgs.size(0)
    return loss_sum/total, correct/total

def train():
    train_loader,val_loader,test_loader,label_map = build_loaders()
    model     = build_model()
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS, eta_min=1e-6)

    # ── Resume from saved checkpoint ──────────────────────────────────────
    ckpt_path   = WEIGHTS_DIR / "disease_classifier.pth"
    start_epoch = 1
    best_val_acc= 0.9947   # achieved at epoch 16
    best_weights= None

    if ckpt_path.exists():
        print(f"[resume] Loading checkpoint: {ckpt_path}")
        state = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(state)
        best_weights = copy.deepcopy(model.state_dict())
        # Fast-forward scheduler to epoch 30 (where we left off)
        start_epoch = 31
        for _ in range(30): scheduler.step()
        print(f"[resume] Resuming from epoch {start_epoch}/40  (best_val_acc={best_val_acc:.4f})")
    else:
        print("[resume] No checkpoint found, starting fresh")
        best_val_acc = 0.0

    for epoch in range(start_epoch, NUM_EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, criterion, optimizer)
        va_loss, va_acc = evaluate(model, val_loader, criterion)
        scheduler.step()
        elapsed = time.time() - t0
        print(f"Epoch {epoch:03d}/{NUM_EPOCHS} | train {tr_loss:.4f}/{tr_acc:.4f} "
              f"| val {va_loss:.4f}/{va_acc:.4f} | lr={scheduler.get_last_lr()[0]:.2e} | {elapsed:.1f}s", flush=True)

        if va_acc > best_val_acc:
            best_val_acc = va_acc
            best_weights = copy.deepcopy(model.state_dict())
            torch.save(best_weights, ckpt_path)
            print(f"  >>> best saved (val_acc={best_val_acc:.4f})", flush=True)

    # Final test evaluation
    model.load_state_dict(best_weights)
    te_loss, te_acc = evaluate(model, test_loader, criterion)
    print(f"\n[TEST] loss={te_loss:.4f}  acc={te_acc:.4f}", flush=True)
    with open(WEIGHTS_DIR/"disease_label_map.json","w") as f:
        json.dump(label_map, f, indent=2)
    print(f"[DONE] disease_classifier.pth  best_val={best_val_acc:.4f}", flush=True)

import copy
train()
