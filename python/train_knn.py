#!/usr/bin/env python3
"""
Train a k‑NN hand‑gesture recogniser from landmark .npy files
and export it as JSON so the browser can run inference with no TF.js.
"""

import os, json, random, numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import accuracy_score

# ---------- configuration ----------
DATA_DIR   = "./data"        # where collect_data.py saves .npy
OUT_DIR    = "./models"
K          = 5               # neighbours
MAX_PER_G  = 2000            # keep model <~15 MB
SEED       = 42
NORMALISE  = True            # wrist‑centred & scale‑invariant
# -----------------------------------

rng = np.random.default_rng(SEED)
os.makedirs(OUT_DIR, exist_ok=True)

# def normalise(batch):
#     """centre on wrist (landmark 0) and divide by hand length (LM 0→9)."""
#     pts   = batch.reshape(len(batch), 21, 3)
#     wrist = pts[:, 0:1, :]
#     pts   = pts - wrist                      # translation
#     span  = np.linalg.norm(pts[:, 9, :] , axis=1, keepdims=True)
#     pts   = pts / np.clip(span, 1e-5, None)  # scale
#     return pts.reshape(len(batch), -1)
def normalise(arr: np.ndarray) -> np.ndarray:
    """
    Accepts either (N, 63) flattened or (N, 21, 3) landmarks.
    Returns flattened (N, 63) centred on lm‑0 and scaled by wrist→middle_MCP.
    """
    if arr.ndim == 2 and arr.shape[1] == 63:
        pts = arr.reshape(-1, 21, 3)
    elif arr.ndim == 3 and arr.shape[1:] == (21, 3):
        pts = arr
    else:
        raise ValueError(f"unexpected shape {arr.shape}")

    # translation: lm‑0 to origin
    pts = pts - pts[:, 0:1, :]

    # scale: distance between wrist (0) and middle finger MCP (9)
    span = np.linalg.norm(pts[:, 9, :], axis=1, keepdims=True)  # (N,1)
    pts  = pts / np.clip(span[:, None], 1e-5, None)             # broadcast

    return pts.reshape(len(pts), -1).astype(np.float32)          # (N, 63)

X, y, label_names = [], [], []
for idx, fname in enumerate(sorted(os.listdir(DATA_DIR))):
    if not fname.endswith(".npy"):
        continue
    label = fname.split(".")[0]
    data  = np.load(os.path.join(DATA_DIR, fname))

    if NORMALISE:
        data = normalise(data)

    # down‑sample huge classes to keep file size reasonable
    if len(data) > MAX_PER_G:
        data = data[rng.choice(len(data), MAX_PER_G, replace=False)]

    X.append(data)
    y.append(np.full(len(data), idx))
    label_names.append(label)

X = np.concatenate(X) .astype(np.float32)
y = np.concatenate(y)

# quick sanity‑check accuracy
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=SEED
)
clf = KNeighborsClassifier(n_neighbors=K)
clf.fit(X_tr, y_tr)
print(f"hold‑out accuracy : {accuracy_score(y_te, clf.predict(X_te))*100:.1f}%")

# dump for the browser
model_js = {
    "k":       K,
    "labels":  label_names,           # ['camera_toggle', …]
    "X":       X.tolist(),            # nested Python -> JSON arrays
    "y":       y.tolist()
}
out_path = os.path.join(OUT_DIR, "knn_model.json")
with open(out_path, "w") as f:
    json.dump(model_js, f)
print("exported", out_path)
