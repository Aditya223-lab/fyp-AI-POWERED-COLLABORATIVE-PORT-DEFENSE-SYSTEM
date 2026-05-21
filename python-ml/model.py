"""
model.py - inference wrapper around the CICIDS2017-trained threat model.

Every part of python-ml (the honeypot detector, the active scanner, the replay
tool) loads the model through ThreatModel, so they all classify threats the
same way and the rest of the system never has to know how the model works.

If artifacts/model.joblib does not exist yet, ThreatModel transparently falls
back to a simple port-based heuristic - so the system still runs end to end
even before train.py has been executed.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "artifacts", "model.joblib")

# Each attack family maps to a backend Severity value. These strings are sent
# straight to the Spring API, which expects lowercase severity values.
SEVERITY_BY_TYPE = {
    "BENIGN": "low",
    "PortScan": "medium",
    "BruteForce": "high",
    "WebAttack": "high",
    "DoS": "high",
    "DDoS": "high",
    "Bot": "critical",
    "Infiltration": "critical",
    "Heartbleed": "critical",
}

# Attack families serious enough to flag as a possible zero-day at high
# confidence (stealthy / control-plane compromises rather than noisy scans).
ZERO_DAY_TYPES = {"Bot", "Infiltration", "Heartbleed"}

# Sensitive service ports - used only by the heuristic fallback below.
RISKY_PORTS = {21, 22, 23, 1433, 2375, 3306, 3389, 5432, 6379, 9200, 11211, 27017}


@dataclass
class Prediction:
    attack_type: str
    severity: str
    confidence: float
    is_threat: bool
    probabilities: dict = field(default_factory=dict)

    def is_zero_day(self) -> bool:
        return self.attack_type in ZERO_DAY_TYPES and self.confidence > 0.8


class ThreatModel:
    """Loads the trained pipeline and classifies a feature vector. Callers pass
    whatever features they can observe as a dict; any feature the model was
    trained on but the caller cannot supply is imputed with the training-set
    median, so partial observations (e.g. from the honeypot) still work."""

    def __init__(self, pipeline=None, features=None, classes=None,
                 fallback=False, metrics=None):
        self.pipeline = pipeline
        self.features = features or []
        self.classes = classes or []
        self.fallback = fallback
        self.metrics = metrics or {}

    @classmethod
    def load(cls, path: str = MODEL_PATH) -> "ThreatModel":
        if not os.path.exists(path):
            return cls(fallback=True)
        import joblib
        artifact = joblib.load(path)
        return cls(
            pipeline=artifact["pipeline"],
            features=artifact["features"],
            classes=artifact.get("classes", []),
            metrics=artifact.get("metrics", {}),
        )

    @property
    def description(self) -> str:
        if self.fallback:
            return "heuristic fallback - run train.py to build the real model"
        accuracy = self.metrics.get("accuracy")
        suffix = f", test accuracy {accuracy:.3f}" if accuracy else ""
        return f"CICIDS2017 RandomForest, {len(self.features)} features{suffix}"

    def predict(self, features: dict) -> Prediction:
        if self.fallback or self.pipeline is None:
            return self._heuristic(features)

        import pandas as pd
        row = pd.DataFrame(
            [[features.get(name, np.nan) for name in self.features]],
            columns=self.features,
        )
        probabilities = self.pipeline.predict_proba(row)[0]
        labels = list(self.pipeline.classes_)
        best = int(np.argmax(probabilities))
        attack = str(labels[best])
        confidence = float(probabilities[best])
        return Prediction(
            attack_type=attack,
            severity=self._severity(attack, confidence),
            confidence=round(confidence, 4),
            is_threat=attack != "BENIGN",
            probabilities={
                str(label): round(float(p), 4)
                for label, p in zip(labels, probabilities)
            },
        )

    def _severity(self, attack: str, confidence: float) -> str:
        base = SEVERITY_BY_TYPE.get(attack, "medium")
        # A low-confidence call should not scream 'critical'.
        if confidence < 0.5 and base == "critical":
            return "high"
        if confidence < 0.35 and base == "high":
            return "medium"
        return base

    def _heuristic(self, features: dict) -> Prediction:
        """Used only when no trained model is on disk. Mirrors the project's
        original port-based logic so the pipeline still works pre-training."""
        port = int(features.get("Destination Port", 0) or 0)
        fwd_packets = float(features.get("Total Fwd Packets", 0) or 0)
        if port in RISKY_PORTS:
            attack, confidence = "BruteForce", 0.55
        elif fwd_packets >= 4:
            attack, confidence = "PortScan", 0.60
        else:
            attack, confidence = "BENIGN", 0.50
        return Prediction(
            attack_type=attack,
            severity=self._severity(attack, confidence),
            confidence=confidence,
            is_threat=attack != "BENIGN",
        )
