import os, json, time, copy, argparse, re
from pathlib import Path
from typing import Tuple

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, Dataset, random_split
from torchvision import transforms
from torchvision.models import efficientnet_v2_l, EfficientNet_V2_L_Weights
from PIL import Image

DATASET_ROOT = Path(r'd:\Deep\to upload')
WEIGHTS_DIR  = Path(r'd:\Deep\pomegranate_ai\weights')
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

WEIGHT_CLASSES  = ['G1', 'G2', 'G3']
QUALITY_CLASSES = ['Q1', 'Q2', 'Q3', 'Q4']
N_WEIGHT  = len(WEIGHT_CLASSES)
N_QUALITY = len(QUALITY_CLASSES)

ALPHA = 0.4
BETA  = 0.6

BATCH_SIZE   = 8
NUM_EPOCHS   = 50
LR           = 5e-4
WEIGHT_DECAY = 1e-4
VAL_SPLIT    = 0.15
TEST_SPLIT   = 0.10
IMG_SIZE     = 300
NUM_WORKERS  = 0

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'[device] {DEVICE}', flush=True)

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

train_tf = transforms.Compose([
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.75, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.05),
    transforms.RandomRotation(25),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

val_tf = transforms.Compose([
    transforms.Resize(320),
    transforms.CenterCrop(IMG_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
])

FOLDER_RE = re.compile(r'^(G[123])_(Q[1234])$', re.IGNORECASE)

class PomegranateGradingDataset(Dataset):
    def __init__(self, transform):
        self.transform = transform
        self.samples   = []
        for folder in sorted(DATASET_ROOT.iterdir()):
            if not folder.is_dir():
                continue
            m = FOLDER_RE.match(folder.name)
            if not m:
                continue
            w_label = m.group(1).upper()
            q_label = m.group(2).upper()
            w_idx = WEIGHT_CLASSES.index(w_label)
            q_idx = QUALITY_CLASSES.index(q_label)
            for img_path in sorted(folder.glob('*')):
                if img_path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
                    self.samples.append((img_path, w_idx, q_idx))
        print(f'[dataset] total={len(self.samples)} samples across {N_WEIGHT}x{N_QUALITY} classes', flush=True)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, w_idx, q_idx = self.samples[idx]
        img = Image.open(path).convert('RGB')
        return self.transform(img), w_idx, q_idx


def build_loaders():
    ds = PomegranateGradingDataset(train_tf)
    n      = len(ds)
    n_val  = int(n * VAL_SPLIT)
    n_test = int(n * TEST_SPLIT)
    n_tr   = n - n_val - n_test
    tr_ds, va_ds, te_ds = random_split(
        ds, [n_tr, n_val, n_test],
        generator=torch.Generator().manual_seed(42)
    )
    class _Wrap(Dataset):
        def __init__(self, subset, tf):
            self.s, self.tf = subset, tf
        def __len__(self): return len(self.s)
        def __getitem__(self, i):
            path, w, q = self.s.dataset.samples[self.s.indices[i]]
            img = Image.open(path).convert('RGB')
            return self.tf(img), w, q
    va_ds = _Wrap(va_ds, val_tf)
    te_ds = _Wrap(te_ds, val_tf)
    tr_loader = DataLoader(tr_ds, BATCH_SIZE, True,  num_workers=NUM_WORKERS)
    va_loader = DataLoader(va_ds, BATCH_SIZE, False, num_workers=NUM_WORKERS)
    te_loader = DataLoader(te_ds, BATCH_SIZE, False, num_workers=NUM_WORKERS)
    print(f'  train={n_tr}  val={n_val}  test={n_test}', flush=True)
    return tr_loader, va_loader, te_loader


class MultiHeadEfficientNetV2L(nn.Module):
    def __init__(self, n_weight: int, n_quality: int):
        super().__init__()
        base = efficientnet_v2_l(weights=EfficientNet_V2_L_Weights.IMAGENET1K_V1)
        self.backbone     = base.features
        self.pool         = base.avgpool
        self.dropout      = nn.Dropout(p=0.4)
        in_features = base.classifier[1].in_features
        self.head_weight = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, n_weight),
        )
        self.head_quality = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, n_quality),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        feat = self.backbone(x)
        feat = self.pool(feat)
        feat = torch.flatten(feat, 1)
        feat = self.dropout(feat)
        return self.head_weight(feat), self.head_quality(feat)


def build_model():
    return MultiHeadEfficientNetV2L(N_WEIGHT, N_QUALITY).to(DEVICE)


def train_one_epoch(model, loader, ce_w, ce_q, optimizer, scaler):
    model.train()
    tot_loss = w_cor = q_cor = total = 0
    use_amp = (DEVICE.type == 'cuda')
    for imgs, w_lbl, q_lbl in loader:
        imgs  = imgs.to(DEVICE)
        w_lbl = w_lbl.to(DEVICE)
        q_lbl = q_lbl.to(DEVICE)
        optimizer.zero_grad()
        if use_amp:
            with torch.amp.autocast('cuda'):
                w_out, q_out = model(imgs)
                loss_w = ce_w(w_out, w_lbl)
                loss_q = ce_q(q_out, q_lbl)
                loss   = ALPHA * loss_w + BETA * loss_q
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            w_out, q_out = model(imgs)
            loss_w = ce_w(w_out, w_lbl)
            loss_q = ce_q(q_out, q_lbl)
            loss   = ALPHA * loss_w + BETA * loss_q
            loss.backward()
            optimizer.step()
        n = imgs.size(0)
        tot_loss += loss.item() * n
        w_cor    += (w_out.argmax(1) == w_lbl).sum().item()
        q_cor    += (q_out.argmax(1) == q_lbl).sum().item()
        total    += n
    return tot_loss/total, w_cor/total, q_cor/total


@torch.no_grad()
def evaluate(model, loader, ce_w, ce_q):
    model.eval()
    tot_loss = w_cor = q_cor = total = 0
    use_amp = (DEVICE.type == 'cuda')
    for imgs, w_lbl, q_lbl in loader:
        imgs  = imgs.to(DEVICE)
        w_lbl = w_lbl.to(DEVICE)
        q_lbl = q_lbl.to(DEVICE)
        if use_amp:
            with torch.amp.autocast('cuda'):
                w_out, q_out = model(imgs)
                loss = ALPHA * ce_w(w_out, w_lbl) + BETA * ce_q(q_out, q_lbl)
        else:
            w_out, q_out = model(imgs)
            loss = ALPHA * ce_w(w_out, w_lbl) + BETA * ce_q(q_out, q_lbl)
        n = imgs.size(0)
        tot_loss += loss.item() * n
        w_cor    += (w_out.argmax(1) == w_lbl).sum().item()
        q_cor    += (q_out.argmax(1) == q_lbl).sum().item()
        total    += n
    return tot_loss/total, w_cor/total, q_cor/total


def train():
    if DEVICE.type == 'cuda':
        torch.cuda.empty_cache()
    tr_loader, va_loader, te_loader = build_loaders()
    model = build_model()
    ce_weight  = nn.CrossEntropyLoss(label_smoothing=0.1)
    ce_quality = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer  = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler  = CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS, eta_min=1e-6)
    scaler     = torch.amp.GradScaler('cuda', enabled=(DEVICE.type == 'cuda'))

    ckpt_path = WEIGHTS_DIR / 'multitask_efficientnet.pth'
    start_epoch = 1
    best_score = 0.8148
    best_state = None

    if ckpt_path.exists():
        print(f'[resume] Loading existing checkpoint: {ckpt_path}', flush=True)
        state = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(state)
        best_state = copy.deepcopy(model.state_dict())
        start_epoch = 23
        for _ in range(22): scheduler.step()
        val_l, val_wa, val_qa = evaluate(model, va_loader, ce_weight, ce_quality)
        best_score = max(best_score, (val_wa + val_qa) / 2)
        print(f'[resume] Loaded checkpoint (best_score={best_score:.4f}, start_epoch={start_epoch}/50)', flush=True)

    for epoch in range(start_epoch, NUM_EPOCHS + 1):
        t0 = time.time()
        tr_l, tr_wa, tr_qa = train_one_epoch(model, tr_loader, ce_weight, ce_quality, optimizer, scaler)
        va_l, va_wa, va_qa = evaluate(model, va_loader, ce_weight, ce_quality)
        scheduler.step()
        elapsed = time.time() - t0
        score = (va_wa + va_qa) / 2
        print(f'Epoch {epoch:03d}/{NUM_EPOCHS} | '
              f'loss={tr_l:.4f} w-acc={tr_wa:.3f} q-acc={tr_qa:.3f} | '
              f'val loss={va_l:.4f} w-acc={va_wa:.3f} q-acc={va_qa:.3f} | '
              f'score={score:.4f} | {elapsed:.1f}s', flush=True)
        if score > best_score:
            best_score = score
            best_state = copy.deepcopy(model.state_dict())
            torch.save(best_state, ckpt_path)
            print(f'  + saved best (score={best_score:.4f})', flush=True)

    model.load_state_dict(best_state)
    te_l, te_wa, te_qa = evaluate(model, te_loader, ce_weight, ce_quality)
    print(f'\n[TEST] loss={te_l:.4f}  weight-acc={te_wa:.4f}  quality-acc={te_qa:.4f}', flush=True)

    label_map = {
        'weight':  {str(i): c for i, c in enumerate(WEIGHT_CLASSES)},
        'quality': {str(i): c for i, c in enumerate(QUALITY_CLASSES)},
    }
    with open(WEIGHTS_DIR / 'grading_label_map.json', 'w') as f:
        json.dump(label_map, f, indent=2)
    print(f'[done] {ckpt_path}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs',     type=int,   default=NUM_EPOCHS)
    parser.add_argument('--batch-size', type=int,   default=BATCH_SIZE)
    parser.add_argument('--lr',         type=float, default=LR)
    args = parser.parse_args()
    NUM_EPOCHS = args.epochs
    BATCH_SIZE = args.batch_size
    LR         = args.lr
    train()
