"""
train.py - trains the PortDefense AI threat-detection model on CICIDS2017.

Why this exists
---------------
The old detector trained an IsolationForest on *randomly generated* "normal"
traffic, and the scanner trained a RandomForest on rows derived from its own
lookup table - neither model ever saw a real attack. This script replaces that
with a model trained on the CICIDS2017 intrusion-detection dataset, so it
actually learns the statistical fingerprints of real port scans, DoS/DDoS,
brute-force, web attacks and botnet traffic.

What it produces (in python-ml/artifacts/)
-------------------------------------------
  model.joblib            the trained scikit-learn pipeline + feature list
  holdout.csv             a small stratified sample of *real* held-out attack
                          records, replayed later by replay.py for the demo
  confusion_matrix.csv    per-class evaluation table for your report
  confusion_matrix.png    the same as a figure (needs matplotlib)

Get the data
------------
Download the CICIDS2017 "MachineLearningCSV" archive from the Canadian
Institute for Cybersecurity:

    https://www.unb.ca/cic/datasets/ids-2017.html

Unzip the 8 CSV files into:

    python-ml/data/cicids2017/

Then run:

    python train.py

Useful flags:
    python train.py --max-benign 150000 --trees 150
"""
from __future__ import annotations

import argparse
import glob
import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.getenv("CICIDS_DIR", os.path.join(HERE, "data", "cicids2017"))
ARTIFACT_DIR = os.path.join(HERE, "artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.joblib")
HOLDOUT_PATH = os.path.join(ARTIFACT_DIR, "holdout.csv")
CONFUSION_CSV = os.path.join(ARTIFACT_DIR, "confusion_matrix.csv")
CONFUSION_PNG = os.path.join(ARTIFACT_DIR, "confusion_matrix.png")

# Columns that merely identify a flow - no predictive signal, and not
# observable by the live detector. Present only in the "full" CICIDS2017
# export; the lighter MachineLearningCSV export omits most of them.
IDENTITY_COLUMNS = {
    "Flow ID", "Source IP", "Src IP", "Source Port", "Src Port",
    "Destination IP", "Dst IP", "Timestamp", "External IP",
}

# CICIDS2017 ships 15 raw labels. Collapse them into compact attack families
# so the classes are balanced enough to learn and easy to defend in a viva.
LABEL_GROUPS = {
    "BENIGN": "BENIGN",
    "FTP-Patator": "BruteForce",
    "SSH-Patator": "BruteForce",
    "DoS Hulk": "DoS",
    "DoS GoldenEye": "DoS",
    "DoS slowloris": "DoS",
    "DoS Slowhttptest": "DoS",
    "Heartbleed": "Heartbleed",
    "Web Attack - Brute Force": "WebAttack",
    "Web Attack - XSS": "WebAttack",
    "Web Attack - Sql Injection": "WebAttack",
    "Infiltration": "Infiltration",
    "Bot": "Bot",
    "PortScan": "PortScan",
    "DDoS": "DDoS",
}


def normalise_label(raw: object) -> str:
    """CICIDS2017 web-attack labels embed a Windows-1252 en-dash byte (0x96).
    Normalise every dash variant + whitespace, then map to an attack family."""
    s = str(raw).strip()
    for dash in ("\x96", "–", "—"):
        s = s.replace(dash, "-")
    s = " ".join(s.split())
    return LABEL_GROUPS.get(s, s)


def find_label_column(columns) -> str:
    for c in columns:
        if str(c).strip().lower() == "label":
            return c
    sys.exit("Could not find a 'Label' column in the CSV files.")


def load_dataset(data_dir: str) -> pd.DataFrame:
    csv_paths = sorted(glob.glob(os.path.join(data_dir, "*.csv")))
    if not csv_paths:
        sys.exit(
            f"\nNo CSV files found in:\n  {data_dir}\n\n"
            "Download the CICIDS2017 'MachineLearningCSV' archive from\n"
            "  https://www.unb.ca/cic/datasets/ids-2017.html\n"
            "and unzip the 8 CSV files into that folder, then re-run train.py.\n"
        )
    frames = []
    for path in csv_paths:
        print(f"  reading {os.path.basename(path)} ...", flush=True)
        df = pd.read_csv(path, encoding="latin-1", low_memory=False)
        df.columns = [str(c).strip() for c in df.columns]
        frames.append(df)
    data = pd.concat(frames, ignore_index=True)
    print(f"  loaded {len(data):,} rows x {data.shape[1]} columns "
          f"from {len(csv_paths)} files")
    return data


def clean(data: pd.DataFrame):
    """Returns (X, y, feature_names) ready for training."""
    label_col = find_label_column(data.columns)
    data = data.drop(columns=[c for c in IDENTITY_COLUMNS if c in data.columns])

    y = data[label_col].map(normalise_label)
    X = data.drop(columns=[label_col])

    # Coerce every feature to numeric. CICFlowMeter occasionally emits the
    # string "Infinity" or stray text, which would otherwise poison the dtype.
    for col in X.columns:
        if X[col].dtype == object:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    # CICIDS2017 has genuine +/-inf in the rate columns (Flow Bytes/s,
    # Flow Packets/s) wherever a flow lasted ~0 seconds. Treat them as missing.
    X = X.replace([np.inf, -np.inf], np.nan)

    # Keep only columns that carry signal: not all-empty, not constant.
    feature_names = [
        c for c in X.columns
        if X[c].notna().any() and X[c].nunique(dropna=True) > 1
    ]
    X = X[feature_names].astype("float32")

    # Drop rows whose label did not resolve to anything usable.
    valid = y.notna() & (y.astype(str).str.len() > 0)
    return X[valid].reset_index(drop=True), y[valid].reset_index(drop=True), feature_names


def balance_benign(X: pd.DataFrame, y: pd.Series, max_benign: int):
    """BENIGN is ~80% of CICIDS2017. Cap it so the model does not simply learn
    to answer 'benign', and so training fits in a laptop's RAM."""
    if max_benign <= 0:
        return X, y
    benign_idx = y.index[y == "BENIGN"]
    if len(benign_idx) <= max_benign:
        return X, y
    drop = benign_idx.to_series().sample(
        n=len(benign_idx) - max_benign, random_state=42
    ).index
    keep = X.index.difference(drop)
    return X.loc[keep].reset_index(drop=True), y.loc[keep].reset_index(drop=True)


def save_confusion_png(cm: np.ndarray, classes: list[str]) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("  (matplotlib not installed - skipping confusion-matrix figure)")
        return
    # Row-normalise so rare classes stay readable next to huge ones.
    norm = cm / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
    fig, ax = plt.subplots(figsize=(8.5, 7))
    im = ax.imshow(norm, cmap="magma", vmin=0, vmax=1)
    ax.set_xticks(range(len(classes)), classes, rotation=45, ha="right")
    ax.set_yticks(range(len(classes)), classes)
    ax.set_xlabel("predicted")
    ax.set_ylabel("actual")
    ax.set_title("CICIDS2017 - normalised confusion matrix")
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(j, i, f"{norm[i, j]:.2f}", ha="center", va="center",
                    color="white" if norm[i, j] < 0.6 else "black", fontsize=7)
    fig.colorbar(im, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(CONFUSION_PNG, dpi=130)
    plt.close(fig)
    print(f"  confusion-matrix figure -> {CONFUSION_PNG}")


def save_holdout(X_test: pd.DataFrame, y_test: pd.Series, target_rows: int) -> None:
    """Persist a small stratified slice of the *real* test data so replay.py
    can stream genuine, unseen attacks through the system during a demo."""
    if target_rows <= 0:
        return
    per_class = max(1, target_rows // max(y_test.nunique(), 1))
    parts = []
    frame = X_test.copy()
    frame["Label"] = y_test.values
    for _, group in frame.groupby("Label"):
        parts.append(group.sample(n=min(len(group), per_class), random_state=42))
    pd.concat(parts).sample(frac=1.0, random_state=42).to_csv(
        HOLDOUT_PATH, index=False
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train the PortDefense threat-detection model on CICIDS2017"
    )
    parser.add_argument("--data-dir", default=DATA_DIR,
                        help="folder containing the CICIDS2017 CSV files")
    parser.add_argument("--max-benign", type=int, default=200_000,
                        help="cap BENIGN rows to fight class imbalance (0 = keep all)")
    parser.add_argument("--trees", type=int, default=120,
                        help="number of trees in the RandomForest")
    parser.add_argument("--max-depth", type=int, default=30,
                        help="max tree depth (bounds RAM use)")
    parser.add_argument("--test-size", type=float, default=0.25,
                        help="fraction of data held out for evaluation")
    parser.add_argument("--holdout", type=int, default=3000,
                        help="rows of real held-out data to save for replay.py")
    args = parser.parse_args()

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    t0 = time.time()

    print("[1/5] loading CICIDS2017 ...")
    raw = load_dataset(args.data_dir)

    print("[2/5] cleaning ...")
    X, y, features = clean(raw)
    del raw
    X, y = balance_benign(X, y, args.max_benign)
    print(f"  {len(X):,} rows x {len(features)} features after cleaning")
    print("  class distribution:")
    for cls, n in y.value_counts().items():
        print(f"    {cls:<14} {n:,}")

    print("[3/5] splitting + training ...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=42
    )
    pipeline = Pipeline([
        # Inf values became NaN during cleaning; impute with the column median.
        ("impute", SimpleImputer(strategy="median")),
        ("clf", RandomForestClassifier(
            n_estimators=args.trees,
            max_depth=args.max_depth,
            min_samples_leaf=2,
            # Up-weight the rare attack classes so they are not drowned out.
            class_weight="balanced_subsample",
            n_jobs=-1,
            random_state=42,
        )),
    ])
    pipeline.fit(X_train, y_train)

    print("[4/5] evaluating on held-out test data ...")
    predicted = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, predicted)
    macro_f1 = f1_score(y_test, predicted, average="macro")
    print(f"\n  accuracy : {accuracy:.4f}")
    print(f"  macro-F1 : {macro_f1:.4f}   (macro = every class counts equally)\n")
    print(classification_report(y_test, predicted, zero_division=0))

    classes = sorted(y.unique())
    cm = confusion_matrix(y_test, predicted, labels=classes)
    pd.DataFrame(cm, index=classes, columns=classes).to_csv(CONFUSION_CSV)
    print(f"  confusion matrix -> {CONFUSION_CSV}")
    save_confusion_png(cm, classes)

    clf = pipeline.named_steps["clf"]
    importances = sorted(
        zip(features, clf.feature_importances_),
        key=lambda kv: kv[1], reverse=True,
    )
    print("\n  top 12 most informative features:")
    for name, imp in importances[:12]:
        print(f"    {imp:.4f}  {name}")

    print("\n[5/5] saving artifacts ...")
    joblib.dump({
        "pipeline": pipeline,
        "features": features,
        "classes": list(clf.classes_),
        "dataset": "CICIDS2017",
        "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": {"accuracy": float(accuracy), "macro_f1": float(macro_f1)},
    }, MODEL_PATH)
    print(f"  model -> {MODEL_PATH}")

    save_holdout(X_test, y_test, args.holdout)
    if os.path.exists(HOLDOUT_PATH):
        print(f"  holdout -> {HOLDOUT_PATH}")

    print(f"\nDone in {time.time() - t0:.0f}s. "
          f"Next: run 'python detector.py' or 'python replay.py'.")


if __name__ == "__main__":
    main()
