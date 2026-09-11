"""
Active target scanner - the second half of python-ml.

Polls the Spring backend for registered MonitorTargets, runs a TCP connect
scan + banner-grab on each, identifies the running services, and asks the
trained ThreatModel to classify every open port it finds. Findings are posted
as ThreatEvents so they show up live in the dashboard.

Designed to be imported and started by detector.py (which shares its loaded
model), but can also be run on its own:  python target_scanner.py
"""

from __future__ import annotations

import logging
import os
import socket
import threading
import time
from dataclasses import dataclass
from typing import List, Optional

import requests

from model import ThreatModel, Prediction

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

API_BASE = os.getenv("PORTDEFENSE_API_BASE", "http://localhost:8080/api")
SCAN_INTERVAL = float(os.getenv("PORTDEFENSE_SCAN_INTERVAL", "30"))
SOCKET_TIMEOUT = float(os.getenv("PORTDEFENSE_SOCKET_TIMEOUT", "0.5"))

log = logging.getLogger("target_scanner")


# ---------------------------------------------------------------------------
# Service fingerprinting
# ---------------------------------------------------------------------------

# Known-port -> service name, for human-readable labels on the dashboard.
PORT_SERVICES: dict[int, str] = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP",
    110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB", 465: "SMTPS",
    587: "SMTP-Submit", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL",
    1521: "OracleDB", 2049: "NFS", 2375: "DockerAPI-unauth",
    2376: "DockerAPI-tls", 3306: "MySQL", 3389: "RDP", 5432: "Postgres",
    5601: "Kibana", 5672: "RabbitMQ", 5900: "VNC", 6379: "Redis",
    8080: "HTTP-alt", 8443: "HTTPS-alt", 9200: "Elasticsearch",
    11211: "Memcached", 27017: "MongoDB", 50070: "Hadoop",
}


def identify_service(port: int, banner: bytes) -> str:
    """Best-effort service name from a port lookup, then the banner."""
    if port in PORT_SERVICES:
        return PORT_SERVICES[port]
    head = banner[:32].decode("latin-1", errors="replace").strip()
    if head.startswith("SSH-"):
        return "SSH"
    if head.lower().startswith(("http/", "<!doctype", "<html")):
        return "HTTP"
    return f"port-{port}"


@dataclass
class Finding:
    target_id: str
    target_name: str
    ip: str
    port: int
    service: str
    banner_len: int


def finding_to_features(f: Finding) -> dict:
    """Translate an open-port finding into CICIDS2017 feature names. As with
    the honeypot, we supply only what we genuinely observed (the port, a
    short connect handshake, and whether the service returned a banner);
    ThreatModel imputes the remaining features."""
    return {
        "Destination Port": f.port,
        "Total Fwd Packets": 2,
        "Total Backward Packets": 1 if f.banner_len > 0 else 0,
        "Total Length of Bwd Packets": f.banner_len,
        "Flow Duration": SOCKET_TIMEOUT * 1_000_000,
        "SYN Flag Count": 1,
        "ACK Flag Count": 1,
    }


# ---------------------------------------------------------------------------
# Port parsing + scanning
# ---------------------------------------------------------------------------


def parse_ports(spec: str) -> List[int]:
    """Accepts '22,80,443' or '1-1024' or mixed '22,80,8000-8010'."""
    out: list[int] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            lo, hi = chunk.split("-", 1)
            try:
                a, b = int(lo), int(hi)
                if a <= b:
                    out.extend(range(a, b + 1))
            except ValueError:
                continue
        else:
            try:
                out.append(int(chunk))
            except ValueError:
                continue
    # Cap to something sane so an accidental 1-65535 doesn't lock us up.
    return sorted(set(out))[:1024]


def scan_port(ip: str, port: int) -> Optional[bytes]:
    """TCP connect + best-effort banner grab. Returns banner bytes (possibly
    empty) on open, None on closed/filtered."""
    try:
        with socket.create_connection((ip, port), timeout=SOCKET_TIMEOUT) as s:
            s.settimeout(SOCKET_TIMEOUT)
            try:
                data = s.recv(128)
            except (socket.timeout, OSError):
                data = b""
            return data
    except (socket.timeout, ConnectionRefusedError, OSError):
        return None


def scan_target(target: dict) -> List[Finding]:
    ports = parse_ports(target.get("ports", ""))
    ip = target.get("ipAddress") or ""
    if not ip:
        # A hostname target the backend has not resolved yet.
        return []
    findings: list[Finding] = []
    for p in ports:
        banner = scan_port(ip, p)
        if banner is None:
            continue
        findings.append(Finding(
            target_id=target["id"],
            target_name=target["name"],
            ip=ip,
            port=p,
            service=identify_service(p, banner),
            banner_len=len(banner),
        ))
    return findings


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def post_finding(f: Finding, prediction: Prediction) -> None:
    payload = {
        "sourceIP": f.ip,
        "targetPort": f.port,
        "targetIp": f.ip,
        "targetService": f.service,
        "severity": prediction.severity,
        "scanType": "connect",
        "attackType": prediction.attack_type,
        "anomalyScore": prediction.confidence,
        "isZeroDay": prediction.is_zero_day(),
        "confidence": prediction.confidence,
        "responseTime": int(SOCKET_TIMEOUT * 1000),
        "organizationId": None,
    }
    try:
        r = requests.post(f"{API_BASE}/threats/ingest", json=payload, timeout=3)
        if not r.ok:
            log.warning("ingest rejected %d: %s", r.status_code, r.text[:200])
    except requests.RequestException as e:
        log.error("could not POST finding: %s", e)


def mark_scanned(target_id: str, findings_count: int) -> None:
    try:
        requests.patch(
            f"{API_BASE}/targets/{target_id}/scanned",
            json={"findingsCount": findings_count},
            timeout=3,
        )
    except requests.RequestException as e:
        log.debug("could not patch /scanned for %s: %s", target_id, e)


# ---------------------------------------------------------------------------
# Main scanner loop
# ---------------------------------------------------------------------------


def fetch_targets() -> list[dict]:
    try:
        r = requests.get(f"{API_BASE}/targets", timeout=3)
        if r.ok:
            return r.json()
    except requests.RequestException:
        pass
    return []


def run_loop(model: Optional[ThreatModel] = None) -> None:
    model = model or ThreatModel.load()
    log.info("target scanner started; model: %s; polling every %.0fs",
             model.description, SCAN_INTERVAL)
    while True:
        targets = fetch_targets()
        if not targets:
            log.debug("no targets registered")
        for target in targets:
            # Websites registered for monitoring are checked over HTTP by the
            # backend's AssetMonitorService. Port-scanning a public site is a
            # different act entirely, so the scanner leaves them alone.
            if str(target.get("type", "HOST")).upper() == "WEBSITE":
                continue
            findings = scan_target(target)
            log.info(
                "scanned %s (%s) — %d ports listening",
                target.get("name"),
                target.get("ipAddress"),
                len(findings),
            )
            for f in findings:
                prediction = model.predict(finding_to_features(f))
                log.info(
                    "  -> %s:%d %s — AI says %s / %s (%.2f)",
                    f.ip, f.port, f.service,
                    prediction.attack_type, prediction.severity.upper(),
                    prediction.confidence,
                )
                post_finding(f, prediction)
            mark_scanned(target["id"], len(findings))
        time.sleep(SCAN_INTERVAL)


def start_in_background(model: Optional[ThreatModel] = None) -> threading.Thread:
    t = threading.Thread(
        target=run_loop, args=(model,), daemon=True, name="target-scanner"
    )
    t.start()
    return t


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s %(message)s",
        datefmt="%H:%M:%S",
    )
    run_loop()
