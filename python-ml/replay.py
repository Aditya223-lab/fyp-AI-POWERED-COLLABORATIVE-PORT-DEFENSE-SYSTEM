"""
replay.py - streams real, held-out CICIDS2017 attack records through the
trained model and into the Spring backend.

This is the honest demo of "detecting real threats": every record replayed
here is a genuine labelled network flow from CICIDS2017 that the model never
saw during training (train.py set it aside in artifacts/holdout.csv). The
model classifies each flow and the result appears live on the dashboard.

    python replay.py                 # stream the held-out attacks, ~2/sec
    python replay.py --rate 5        # faster
    python replay.py --only DDoS     # replay only one attack family
    python replay.py --count 100     # stop after 100 events
    python replay.py --include-benign

The console also prints the model's accuracy on this unseen data as it goes.
"""
from __future__ import annotations

import argparse
import os
import random
import sys
import time

import pandas as pd
import requests

from model import ThreatModel

HERE = os.path.dirname(os.path.abspath(__file__))
HOLDOUT_PATH = os.path.join(HERE, "artifacts", "holdout.csv")
INGEST_URL = os.getenv(
    "PORTDEFENSE_API", "http://localhost:8080/api/threats/ingest"
)

COMMON_SERVICES = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP",
    110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB", 1433: "MSSQL",
    3306: "MySQL", 3389: "RDP", 5432: "Postgres", 6379: "Redis",
    8080: "HTTP-alt", 8443: "HTTPS-alt", 9200: "Elasticsearch",
    27017: "MongoDB",
}


def fake_source_ip() -> str:
    """A plausible external attacker IP (avoids reserved/private ranges)."""
    return ".".join(str(random.randint(11, 223)) for _ in range(4))


def service_for(port: int) -> str:
    return COMMON_SERVICES.get(port, f"port-{port}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replay real CICIDS2017 attacks through the trained model"
    )
    parser.add_argument("--rate", type=float, default=2.0,
                        help="events per second")
    parser.add_argument("--count", type=int, default=0,
                        help="stop after N events (0 = replay everything)")
    parser.add_argument("--only", default=None,
                        help="replay only this attack family, e.g. DDoS")
    parser.add_argument("--include-benign", action="store_true",
                        help="also replay BENIGN flows (off by default)")
    args = parser.parse_args()

    if not os.path.exists(HOLDOUT_PATH):
        sys.exit(f"No holdout data at:\n  {HOLDOUT_PATH}\n"
                 "Run 'python train.py' first to generate it.")

    model = ThreatModel.load()
    if model.fallback:
        print("WARNING: no trained model found - predictions use the heuristic "
              "fallback.\n         Run 'python train.py' for the real "
              "CICIDS2017 model.\n")
    else:
        print(f"model: {model.description}\n")

    df = pd.read_csv(HOLDOUT_PATH, encoding="latin-1", low_memory=False)
    df.columns = [str(c).strip() for c in df.columns]
    has_labels = "Label" in df.columns

    if has_labels and not args.include_benign:
        df = df[df["Label"] != "BENIGN"]
    if has_labels and args.only:
        df = df[df["Label"].astype(str).str.lower() == args.only.lower()]
    if df.empty:
        sys.exit("No rows left to replay after filtering.")
    df = df.sample(frac=1.0).reset_index(drop=True)

    feature_cols = [c for c in df.columns if c != "Label"]
    delay = 1.0 / max(args.rate, 0.1)
    sent = correct = 0

    print(f"replaying {len(df)} real held-out records -> {INGEST_URL}\n")
    for _, row in df.iterrows():
        features = {c: row[c] for c in feature_cols}
        truth = str(row["Label"]) if has_labels else "?"
        prediction = model.predict(features)

        raw_port = row.get("Destination Port")
        port = int(raw_port) if pd.notna(raw_port) else 0
        payload = {
            "sourceIP": fake_source_ip(),
            "targetPort": port,
            "targetService": service_for(port),
            "severity": prediction.severity,
            "scanType": "connect",
            "attackType": prediction.attack_type,
            "anomalyScore": prediction.confidence,
            "confidence": prediction.confidence,
            "isZeroDay": prediction.is_zero_day(),
            "responseTime": 0,
            "organizationId": None,
        }
        try:
            response = requests.post(INGEST_URL, json=payload, timeout=3)
            delivered = response.ok
        except requests.RequestException as exc:
            print(f"  backend unreachable at {INGEST_URL}: {exc}")
            delivered = False

        sent += 1
        if has_labels and prediction.attack_type == truth:
            correct += 1
        mark = "OK  " if prediction.attack_type == truth else "MISS"
        print(f"  [{mark}] real={truth:<13} model={prediction.attack_type:<13} "
              f"{prediction.severity:<8} conf={prediction.confidence:.2f} "
              f"{'-> backend' if delivered else '(not delivered)'}")

        if args.count and sent >= args.count:
            break
        time.sleep(delay)

    if has_labels and sent:
        print(f"\ndone - {sent} replayed, "
              f"live accuracy on unseen data: {correct / sent:.1%}")
    else:
        print(f"\ndone - {sent} replayed")


if __name__ == "__main__":
    main()
