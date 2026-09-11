"""
attack_targets.py - simulate real attacks against the IPs the user registered.

This is the piece that ties the database to the model. It:

  1. reads the MonitorTargets the user added   (GET /api/targets)
  2. for each target port, draws a *real* labelled CICIDS2017 attack flow from
     artifacts/holdout.csv and re-points it at that port (so the attack is
     aimed at the user's own asset, not a random one like replay.py)
  3. asks the trained ThreatModel to classify it
  4. posts the result as a Threat            (POST /api/threats/ingest)
  5. logs the flow + its true label to data/collected/observed.csv so the model
     can be *improved accordingly* - train.py folds this file back in, with the
     model's mistakes (hard examples) upweighted.

Because every replayed flow carries its real CICIDS2017 label, we also print a
live accuracy and highlight every misclassification - those are exactly the
rows retraining benefits from most.

    python attack_targets.py                    # one attack pass over all targets
    python attack_targets.py --rounds 5         # five passes
    python attack_targets.py --per-target 4     # up to 4 ports attacked per target
    python attack_targets.py --only DDoS        # only replay DDoS flows
    python attack_targets.py --rate 5           # 5 attacks/sec
    python attack_targets.py --no-collect       # don't append to observed.csv

Requires a trained model + holdout data (run train.py first) and the backend
running on http://localhost:8080.
"""
from __future__ import annotations

import argparse
import csv
import os
import random
import sys
import time

import pandas as pd
import requests

from model import ThreatModel
from target_scanner import PORT_SERVICES, parse_ports

HERE = os.path.dirname(os.path.abspath(__file__))
HOLDOUT_PATH = os.path.join(HERE, "artifacts", "holdout.csv")
COLLECTED_DIR = os.path.join(HERE, "data", "collected")
OBSERVED_PATH = os.path.join(COLLECTED_DIR, "observed.csv")

API_BASE = os.getenv("PORTDEFENSE_API_BASE", "http://localhost:8080/api")
TARGETS_URL = f"{API_BASE}/targets"
INGEST_URL = os.getenv("PORTDEFENSE_API", f"{API_BASE}/threats/ingest")


def canonical_label(raw: str) -> str:
    """Collapse a label to the attack family the model/training use.

    CICIDS2017's web-attack labels carry a Windows-1252 en-dash byte (0x96)
    that gets further mangled through the holdout -> CSV round-trip. Rather
    than depend on that byte surviving, any 'Web Attack ...' variant is folded
    to 'WebAttack' (matching train.py's LABEL_GROUPS) so observed.csv stores a
    clean label and hit/miss comparisons are fair. Every other family is
    already canonical and passes through unchanged."""
    s = str(raw).strip()
    if s.lower().startswith("web attack"):
        return "WebAttack"
    return s


def fake_source_ip() -> str:
    """A plausible external attacker IP (avoids reserved/private ranges)."""
    return ".".join(str(random.randint(11, 223)) for _ in range(4))


def service_for(port: int) -> str:
    return PORT_SERVICES.get(port, f"port-{port}")


def fetch_targets() -> list[dict]:
    try:
        r = requests.get(TARGETS_URL, timeout=3)
        if r.ok:
            # A website target has no usable IP until the backend's monitor has
            # resolved its DNS name; skip those until it has.
            return [t for t in r.json() if t.get("ipAddress")]
        sys.exit(f"GET {TARGETS_URL} returned {r.status_code}: {r.text[:200]}")
    except requests.RequestException as exc:
        sys.exit(f"Backend unreachable at {TARGETS_URL}: {exc}\n"
                 "Start the Spring backend first.")


def load_attack_pool(only: str | None) -> tuple[pd.DataFrame, list[str]]:
    """Real, held-out attack flows grouped so we can draw one on demand."""
    if not os.path.exists(HOLDOUT_PATH):
        sys.exit(f"No holdout data at:\n  {HOLDOUT_PATH}\n"
                 "Run 'python train.py' first to generate it.")
    df = pd.read_csv(HOLDOUT_PATH, encoding="latin-1", low_memory=False)
    df.columns = [str(c).strip() for c in df.columns]
    if "Label" not in df.columns:
        sys.exit("holdout.csv has no 'Label' column - regenerate it with train.py.")
    # We are *attacking*, so never draw benign flows.
    df = df[df["Label"].astype(str).str.upper() != "BENIGN"]
    if only:
        df = df[df["Label"].astype(str).str.lower() == only.lower()]
    if df.empty:
        sys.exit("No attack rows available after filtering.")
    feature_cols = [c for c in df.columns if c != "Label"]
    return df.reset_index(drop=True), feature_cols


class ObservationWriter:
    """Appends replayed flows (features + true label) to observed.csv so
    train.py can learn from attacks aimed at the user's real targets."""

    def __init__(self, columns: list[str], enabled: bool):
        self.enabled = enabled
        self.columns = list(columns) + ["Label"]
        self._fh = None
        self._writer = None
        if not enabled:
            return
        os.makedirs(COLLECTED_DIR, exist_ok=True)
        new_file = not os.path.exists(OBSERVED_PATH) or os.path.getsize(OBSERVED_PATH) == 0
        self._fh = open(OBSERVED_PATH, "a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._fh, fieldnames=self.columns)
        if new_file:
            self._writer.writeheader()

    def write(self, features: dict, label: str) -> None:
        if not self.enabled:
            return
        row = {c: features.get(c, "") for c in self.columns}
        row["Label"] = label
        self._writer.writerow(row)

    def close(self) -> None:
        if self._fh:
            self._fh.flush()
            self._fh.close()


def post_threat(payload: dict) -> bool:
    try:
        r = requests.post(INGEST_URL, json=payload, timeout=3)
        if not r.ok:
            print(f"    ingest rejected {r.status_code}: {r.text[:160]}")
        return r.ok
    except requests.RequestException as exc:
        print(f"    backend unreachable at {INGEST_URL}: {exc}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulate real attacks against the user's registered target IPs"
    )
    parser.add_argument("--rounds", type=int, default=1,
                        help="how many attack passes over all targets")
    parser.add_argument("--per-target", type=int, default=3,
                        help="max ports to attack per target per round")
    parser.add_argument("--rate", type=float, default=2.0,
                        help="attacks per second")
    parser.add_argument("--only", default=None,
                        help="only replay this attack family, e.g. DDoS")
    parser.add_argument("--no-ingest", action="store_true",
                        help="classify + log only; do not POST to the backend")
    parser.add_argument("--no-collect", action="store_true",
                        help="do not append observations to observed.csv")
    args = parser.parse_args()

    targets = fetch_targets()
    if not targets:
        sys.exit("No targets registered. Add one in the app (or POST /api/targets) "
                 "with an ipAddress + ports, then re-run.")

    model = ThreatModel.load()
    if model.fallback:
        print("WARNING: no trained model found - using heuristic fallback. "
              "Run 'python train.py' for the real model.\n")
    else:
        print(f"model: {model.description}\n")

    pool, feature_cols = load_attack_pool(args.only)
    observer = ObservationWriter(feature_cols, enabled=not args.no_collect)

    delay = 1.0 / max(args.rate, 0.1)
    sent = correct = delivered = 0
    misses: list[str] = []

    print(f"attacking {len(targets)} target(s) x {args.rounds} round(s) "
          f"-> {INGEST_URL if not args.no_ingest else '(local only)'}\n")
    try:
        for rnd in range(1, args.rounds + 1):
            for target in targets:
                ip = target.get("ipAddress", "?")
                name = target.get("name", target.get("id", "?"))
                ports = parse_ports(target.get("ports", "")) or [0]
                chosen = random.sample(ports, k=min(args.per_target, len(ports)))
                print(f"[round {rnd}] {name} ({ip}) ports={chosen}")

                for port in chosen:
                    flow = pool.sample(n=1).iloc[0]
                    truth = canonical_label(flow["Label"])
                    features = {c: flow[c] for c in feature_cols}
                    # Re-point this real attack flow at the user's actual port.
                    features["Destination Port"] = port

                    prediction = model.predict(features)
                    # Compare families, not raw sub-labels, so a WebAttack call
                    # isn't unfairly marked wrong against 'Web Attack - XSS'.
                    hit = canonical_label(prediction.attack_type) == truth
                    predicted = canonical_label(prediction.attack_type)
                    sent += 1
                    correct += 1 if hit else 0
                    if not hit:
                        misses.append(f"{truth}->{predicted} on {ip}:{port}")

                    observer.write(features, truth)

                    ok = False
                    if not args.no_ingest:
                        ok = post_threat({
                            "sourceIP": fake_source_ip(),   # external attacker
                            "targetPort": port,             # the user's target port
                            "targetIp": ip,                 # the asset that was hit
                            "targetService": service_for(port),
                            "severity": prediction.severity,
                            # ScanType is a strict backend enum
                            # (udp/syn/ack/connect/fin/xmas); "connect" is the
                            # honest label for a replayed TCP attack flow.
                            "scanType": "connect",
                            "attackType": prediction.attack_type,
                            "anomalyScore": prediction.confidence,
                            "confidence": prediction.confidence,
                            "isZeroDay": prediction.is_zero_day(),
                            "responseTime": 0,
                            # Tie the attack to the same org as the target it hit.
                            "organizationId": target.get("organizationId"),
                        })
                        delivered += 1 if ok else 0

                    mark = "OK  " if hit else "MISS"
                    tail = "" if args.no_ingest else (" -> backend" if ok else " (not delivered)")
                    print(f"    [{mark}] real={truth:<12} model={predicted:<12}"
                          f" {prediction.severity:<8} conf={prediction.confidence:.2f}{tail}")
                    time.sleep(delay)
    finally:
        observer.close()

    print(f"\ndone - {sent} attacks simulated"
          + (f", {delivered} delivered to backend" if not args.no_ingest else "")
          + (f", live accuracy {correct/sent:.1%}" if sent else ""))
    if misses:
        print(f"\n{len(misses)} misclassification(s) captured for retraining:")
        for m in misses[:15]:
            print(f"    {m}")
        if len(misses) > 15:
            print(f"    ... and {len(misses) - 15} more")
    if not args.no_collect and sent:
        print(f"\nobservations appended -> {OBSERVED_PATH}\n"
              "Retrain with:  python train.py   (it folds observed.csv back in)")


if __name__ == "__main__":
    main()
