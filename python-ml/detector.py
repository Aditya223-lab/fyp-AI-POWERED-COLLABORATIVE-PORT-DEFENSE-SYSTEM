"""
Real-time port-scan detector for the AI-Powered Collaborative Port Defense System.

How it works:
  * Binds honeypot listeners on a configurable set of ports.
  * Every incoming TCP connection is logged with (source_ip, port, timestamp).
  * A sliding-window analyzer per source IP detects port-scan patterns:
        - many distinct ports touched
        - in a short time window
        - by the same source IP
  * Each suspected scan is turned into a CICIDS2017-style feature vector and
    classified by the trained ThreatModel (see model.py / train.py). The model
    returns the attack type, a severity, and a confidence.
  * Detected threats are POSTed to the Spring backend's /api/threats/ingest
    endpoint, which broadcasts them on the SSE channel so the Next.js
    frontend lights up in real time.
)
"""

from __future__ import annotations

import logging
import os
import socket
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict

import requests

import target_scanner
from model import ThreatModel, Prediction

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

INGEST_URL = os.getenv(
    "PORTDEFENSE_API", "http://localhost:8080/api/threats/ingest"
)
HONEYPOT_PORTS = [
    int(p)
    for p in os.getenv(
        "PORTDEFENSE_PORTS",
        "2201,2202,2203,2204,2205,2206,2207,2208,2209,2210",
    ).split(",")
    if p.strip()
]
WINDOW_SECONDS = float(os.getenv("PORTDEFENSE_WINDOW_SECONDS", "5"))
MIN_DISTINCT_PORTS = int(os.getenv("PORTDEFENSE_MIN_PORTS", "4"))
COOLDOWN_SECONDS = float(os.getenv("PORTDEFENSE_COOLDOWN", "10"))
BIND_HOST = os.getenv("PORTDEFENSE_BIND", "0.0.0.0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("detector")


# ---------------------------------------------------------------------------
# Sliding-window scan detector
# ---------------------------------------------------------------------------


@dataclass
class Hit:
    ts: float
    port: int


class ScanDetector:
    """Per-source-IP sliding window of (timestamp, port). Emits one event per
    detected scan, then sits in a cooldown so we don't spam alerts."""

    def __init__(self) -> None:
        self.hits: Dict[str, Deque[Hit]] = defaultdict(deque)
        self.last_alert: Dict[str, float] = {}
        self.lock = threading.Lock()

    def record(self, source_ip: str, port: int) -> dict | None:
        now = time.time()
        with self.lock:
            q = self.hits[source_ip]
            q.append(Hit(now, port))
            # Drop everything outside the window.
            while q and now - q[0].ts > WINDOW_SECONDS:
                q.popleft()

            distinct_ports = {h.port for h in q}
            if len(distinct_ports) < MIN_DISTINCT_PORTS:
                return None

            # Cooldown so a single scan doesn't fire 10x.
            if now - self.last_alert.get(source_ip, 0) < COOLDOWN_SECONDS:
                return None
            self.last_alert[source_ip] = now

            return {
                "source_ip": source_ip,
                "distinct_ports": sorted(distinct_ports),
                "total_attempts": len(q),
                "window_seconds": max((q[-1].ts - q[0].ts), 0.01),
            }


# ---------------------------------------------------------------------------
# Feature extraction -- map an observed scan into the model's feature space
# ---------------------------------------------------------------------------


def scan_to_features(scan: dict) -> dict:
    """Translate an observed honeypot scan into CICIDS2017 feature names.

    We only genuinely observe a handful of values; ThreatModel imputes the
    rest with training-set medians. A honeypot scan maps naturally to the
    dataset's 'PortScan' class -- very short flows, tiny packet counts, all
    SYN, and no payload, because the honeypot closes each connection at once.
    """
    duration_s = max(scan["window_seconds"], 0.001)
    attempts = scan["total_attempts"]
    return {
        "Destination Port": scan["distinct_ports"][0],
        "Flow Duration": duration_s * 1_000_000,  # CICFlowMeter uses microseconds
        "Total Fwd Packets": attempts,
        "Total Backward Packets": 0,
        "Flow Packets/s": attempts / duration_s,
        "Fwd Packets/s": attempts / duration_s,
        "SYN Flag Count": attempts,
        "ACK Flag Count": 0,
        "Total Length of Fwd Packets": 0,
        "Total Length of Bwd Packets": 0,
    }


# ---------------------------------------------------------------------------
# Threat publisher
# ---------------------------------------------------------------------------


def post_threat(scan: dict, prediction: Prediction) -> None:
    # We touched many ports -- report on the first one for the dashboard row.
    target_port = scan["distinct_ports"][0]
    payload = {
        "sourceIP": scan["source_ip"],
        "targetPort": target_port,
        "targetService": "honeypot",
        "severity": prediction.severity,
        "scanType": "connect",
        "attackType": prediction.attack_type,
        "anomalyScore": prediction.confidence,
        "isZeroDay": prediction.is_zero_day(),
        "confidence": prediction.confidence,
        "responseTime": int(scan["window_seconds"] * 1000),
        "organizationId": None,  # backend falls back to a default org
    }
    try:
        r = requests.post(INGEST_URL, json=payload, timeout=3)
        if r.ok:
            log.info(
                "ALERT  %s %s from %s -> %d ports in %.2fs (confidence %.2f) -> backend",
                prediction.severity.upper(),
                prediction.attack_type,
                scan["source_ip"],
                len(scan["distinct_ports"]),
                scan["window_seconds"],
                prediction.confidence,
            )
        else:
            log.warning("backend rejected ingest: HTTP %s — %s", r.status_code, r.text[:200])
    except requests.RequestException as e:
        log.error("could not reach backend at %s: %s", INGEST_URL, e)


# ---------------------------------------------------------------------------
# Honeypot listeners
# ---------------------------------------------------------------------------


def serve_port(port: int, detector: ScanDetector, model: ThreatModel) -> None:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind((BIND_HOST, port))
    except OSError as e:
        log.error("could not bind port %d: %s", port, e)
        return
    s.listen(50)
    log.info("listening on %s:%d", BIND_HOST, port)

    while True:
        try:
            conn, addr = s.accept()
        except OSError:
            break
        source_ip = addr[0]
        # Immediately close — we're a honeypot, not a service.
        try:
            conn.close()
        except OSError:
            pass

        scan = detector.record(source_ip, port)
        if scan is not None:
            prediction = model.predict(scan_to_features(scan))
            post_threat(scan, prediction)


def main() -> None:
    log.info("PortDefense Python detector")
    log.info("  ingest URL : %s", INGEST_URL)
    log.info("  ports      : %s", HONEYPOT_PORTS)
    log.info("  window     : %.1fs (>= %d distinct ports = scan)", WINDOW_SECONDS, MIN_DISTINCT_PORTS)

    detector = ScanDetector()
    model = ThreatModel.load()
    log.info("  AI model   : %s", model.description)

    threads = []
    for port in HONEYPOT_PORTS:
        t = threading.Thread(
            target=serve_port,
            args=(port, detector, model),
            daemon=True,
            name=f"honey-{port}",
        )
        t.start()
        threads.append(t)

    # Start the active target scanner too — it polls /api/targets and
    # classifies every open port it finds with the same trained model.
    target_scanner.start_in_background(model)
    log.info("target scanner thread started (polls every %.0fs)",
             target_scanner.SCAN_INTERVAL)

    log.info("ready. Try:  nmap -p %d-%d %s",
             min(HONEYPOT_PORTS), max(HONEYPOT_PORTS),
             "localhost" if BIND_HOST in ("0.0.0.0", "127.0.0.1") else BIND_HOST)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("shutting down")


if __name__ == "__main__":
    main()
