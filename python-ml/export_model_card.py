"""
export_model_card.py - builds the data the frontend "AI Model" page displays.

It reads the REAL evaluation artifacts that train.py produced:

    artifacts/confusion_matrix.csv   -> per-class precision / recall / F1
    artifacts/model.joblib           -> algorithm metadata + feature importances
    artifacts/confusion_matrix.png   -> copied to the frontend as an image

and writes:

    ../frontend/client/public/model-card.json
    ../frontend/client/public/confusion-matrix.png

The frontend page at /model fetches model-card.json and renders it.

Run this once, after train.py:

    python export_model_card.py

The per-class metrics are computed straight from the confusion matrix, so this
script works even without scikit-learn installed (model.joblib is only used for
the optional "top features" section).
"""
from __future__ import annotations

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS = os.path.join(HERE, "artifacts")
CM_CSV = os.path.join(ARTIFACTS, "confusion_matrix.csv")
CM_PNG = os.path.join(ARTIFACTS, "confusion_matrix.png")
MODEL = os.path.join(ARTIFACTS, "model.joblib")

PUBLIC = os.path.join(HERE, "..", "frontend", "client", "public")
OUT_JSON = os.path.join(PUBLIC, "model-card.json")
OUT_PNG = os.path.join(PUBLIC, "confusion-matrix.png")


def clean_label(s: str) -> str:
    """CICIDS2017 web-attack labels carry a stray encoding byte that survives
    as mojibake in the confusion-matrix CSV. Normalise every variant to '-'."""
    for bad in ("ï¿½", "�", "\x96", "–", "—"):
        s = s.replace(bad, "-")
    return " ".join(s.split())


def per_class_from_confusion(path: str):
    """Compute precision / recall / F1 / support per class straight from the
    confusion matrix CSV. No ML library needed - fully self-consistent."""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        rows = [line.rstrip("\n").split(",") for line in fh if line.strip()]

    classes = [clean_label(c) for c in rows[0][1:]]
    matrix = [[int(float(x)) for x in r[1:]] for r in rows[1:]]
    n = len(classes)

    col_sums = [sum(matrix[i][j] for i in range(n)) for j in range(n)]
    total = sum(sum(r) for r in matrix)
    correct = sum(matrix[i][i] for i in range(n))

    per_class = []
    f1s = []
    for i in range(n):
        tp = matrix[i][i]
        support = sum(matrix[i])
        precision = tp / col_sums[i] if col_sums[i] else 0.0
        recall = tp / support if support else 0.0
        f1 = (2 * precision * recall / (precision + recall)
              if (precision + recall) else 0.0)
        f1s.append(f1)
        per_class.append({
            "name": classes[i],
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": support,
        })

    accuracy = correct / total if total else 0.0
    macro_f1 = sum(f1s) / n if n else 0.0
    return classes, per_class, accuracy, macro_f1, total


def load_model_extras(path: str) -> dict:
    """Optional extras from model.joblib. Never fatal - degrades gracefully."""
    extras = {"trainedAt": None, "topFeatures": []}
    if not os.path.exists(path):
        return extras
    try:
        import joblib
        art = joblib.load(path)
        extras["trainedAt"] = art.get("trained_at")
        pipeline = art.get("pipeline")
        features = art.get("features", [])
        if pipeline is not None and features:
            clf = pipeline.named_steps.get("clf")
            if clf is not None and hasattr(clf, "feature_importances_"):
                pairs = sorted(zip(features, clf.feature_importances_),
                               key=lambda kv: kv[1], reverse=True)
                extras["topFeatures"] = [
                    {"name": str(name), "importance": round(float(imp), 4)}
                    for name, imp in pairs[:10]
                ]
    except Exception as exc:                              # noqa: BLE001
        print(f"  (could not read model.joblib extras: {exc})")
    return extras


def main() -> None:
    if not os.path.exists(CM_CSV):
        sys.exit(f"No confusion matrix at:\n  {CM_CSV}\n"
                 "Run 'python train.py' first to generate the artifacts.")

    classes, per_class, accuracy, macro_f1, total = \
        per_class_from_confusion(CM_CSV)
    extras = load_model_extras(MODEL)

    card = {
        "dataset": "CICIDS2017",
        "algorithm": "Random Forest Classifier",
        "algorithmDetails": (
            "120 decision trees, max depth 30, class_weight="
            "balanced_subsample, inside a scikit-learn Pipeline with median "
            "imputation for missing features."
        ),
        "trainedAt": extras["trainedAt"],
        "accuracy": round(accuracy, 4),
        "macroF1": round(macro_f1, 4),
        "testSamples": total,
        "classCount": len(classes),
        "classes": per_class,
        "topFeatures": extras["topFeatures"],
        "confusionMatrixImage": "/confusion-matrix.png",
    }

    os.makedirs(PUBLIC, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(card, fh, indent=2)
    print(f"  model card  -> {OUT_JSON}")

    if os.path.exists(CM_PNG):
        shutil.copyfile(CM_PNG, OUT_PNG)
        print(f"  confusion image -> {OUT_PNG}")
    else:
        print("  (no confusion_matrix.png found - skipping image copy)")

    print(f"\nDone. accuracy={accuracy:.4f}  macro-F1={macro_f1:.4f}  "
          f"classes={len(classes)}  test-samples={total:,}")


if __name__ == "__main__":
    main()
