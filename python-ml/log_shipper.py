"""
log_shipper.py - the SIEM log collectors.

A real SIEM ingests logs from many sources. This script is the collector side:
it reads a log file (SSH auth log, web access log, or firewall log), parses each
line into a normalized security event, and POSTs batches to the backend at
POST /api/logs/ingest. The backend's correlation engine then runs rules over
those events and raises alerts (e.g. "SSH brute-force", "port scan").

Bundled sample logs (in data/sample_logs/) contain deliberate attack bursts so
the correlation rules fire during a demo.

    python log_shipper.py --source ssh                 # ship the sample SSH log
    python log_shipper.py --source web                 # ship the sample web log
    python log_shipper.py --source firewall            # ship the sample firewall log
    python log_shipper.py --all                         # ship all three sources
    python log_shipper.py --source ssh --file /var/log/auth.log   # a real file
    python log_shipper.py --all --loop 3               # replay 3 times (more volume)

Events are stamped server-side with the current time, so a replayed burst lands
inside the correlation window and triggers the rules live.
"""
from __future__ import annotations

import argparse
import os
import re
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(HERE, "data", "sample_logs")
API_BASE = os.getenv("PORTDEFENSE_API_BASE", "http://localhost:8080/api")
INGEST_URL = f"{API_BASE}/logs/ingest"

SAMPLE_FILES = {
    "ssh": os.path.join(SAMPLE_DIR, "auth.log"),
    "web": os.path.join(SAMPLE_DIR, "access.log"),
    "firewall": os.path.join(SAMPLE_DIR, "firewall.log"),
}

# Signatures that make a web request "suspicious" -> eventType http_attack.
WEB_ATTACK_SIGNATURES = re.compile(
    r"(union\s+select|\.\./|<script|/etc/passwd|wp-login|wp-admin|phpmyadmin|"
    r"\bor\s+1=1\b|sqlmap|nikto|/\.env|/admin|base64_decode|cmd=|exec\()",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Parsers: each turns one raw line into a normalized event dict (or None).
# ---------------------------------------------------------------------------

_SSH_FAIL = re.compile(
    r"Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>\d+\.\d+\.\d+\.\d+) port (?P<port>\d+)")
_SSH_OK = re.compile(
    r"Accepted password for (?P<user>\S+) from (?P<ip>\d+\.\d+\.\d+\.\d+) port (?P<port>\d+)")


def parse_ssh(line: str) -> dict | None:
    m = _SSH_FAIL.search(line)
    if m:
        return _event("ssh", "auth_failure", m.group("ip"),
                      username=m.group("user"), target_port=22, raw=line)
    m = _SSH_OK.search(line)
    if m:
        return _event("ssh", "auth_success", m.group("ip"),
                      username=m.group("user"), target_port=22, raw=line)
    return None


_WEB = re.compile(
    r'(?P<ip>\d+\.\d+\.\d+\.\d+).*?"(?P<method>[A-Z]+)\s+(?P<path>\S+)[^"]*"\s+(?P<status>\d{3})')


def parse_web(line: str) -> dict | None:
    m = _WEB.search(line)
    if not m:
        return None
    status = int(m.group("status"))
    path = m.group("path")
    suspicious = bool(WEB_ATTACK_SIGNATURES.search(line)) or status in (401, 403)
    etype = "http_attack" if suspicious else "http_request"
    return _event("web", etype, m.group("ip"), target_port=80, status_code=status,
                  message=f"{m.group('method')} {path} -> {status}", raw=line)


_FW = re.compile(
    r"(?P<action>DENY|DROP|BLOCK|ACCEPT|ALLOW)\s+\w+\s+"
    r"(?P<src>\d+\.\d+\.\d+\.\d+):\d+\s*(?:->|=>)\s*"
    r"(?P<dst>\d+\.\d+\.\d+\.\d+):(?P<dport>\d+)", re.IGNORECASE)


def parse_firewall(line: str) -> dict | None:
    m = _FW.search(line)
    if not m:
        return None
    action = m.group("action").upper()
    denied = action in ("DENY", "DROP", "BLOCK")
    etype = "connection_denied" if denied else "port_connect"
    return _event("firewall", etype, m.group("src"),
                  target_port=int(m.group("dport")),
                  message=f"{action} {m.group('src')} -> {m.group('dst')}:{m.group('dport')}",
                  raw=line)


PARSERS = {"ssh": parse_ssh, "web": parse_web, "firewall": parse_firewall}


def _event(source, event_type, ip, username=None, target_port=None,
           status_code=None, message=None, raw=None) -> dict:
    # timestamp omitted on purpose -> backend stamps "now" so a replayed burst
    # lands inside the correlation window and triggers the rules.
    return {
        "source": source,
        "eventType": event_type,
        "sourceIP": ip,
        "username": username,
        "targetPort": target_port,
        "statusCode": status_code,
        "message": message or (raw.strip() if raw else None),
        "rawLine": raw.strip() if raw else None,
    }


# ---------------------------------------------------------------------------
# Shipping
# ---------------------------------------------------------------------------


def ship(events: list[dict], batch: int = 50) -> int:
    sent = 0
    for i in range(0, len(events), batch):
        chunk = events[i:i + batch]
        try:
            r = requests.post(INGEST_URL, json=chunk, timeout=5)
            if r.ok:
                sent += r.json().get("ingested", len(chunk))
            else:
                print(f"  ingest rejected {r.status_code}: {r.text[:160]}")
        except requests.RequestException as e:
            print(f"  backend unreachable at {INGEST_URL}: {e}")
            break
    return sent


def parse_file(source: str, path: str) -> list[dict]:
    parser = PARSERS[source]
    events = []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not line.strip():
                continue
            ev = parser(line)
            if ev:
                events.append(ev)
    return events


def main() -> None:
    p = argparse.ArgumentParser(description="Ship security logs to the SIEM backend")
    p.add_argument("--source", choices=list(PARSERS), help="which log format to parse")
    p.add_argument("--all", action="store_true", help="ship all three bundled sample logs")
    p.add_argument("--file", help="path to a real log file (defaults to the bundled sample)")
    p.add_argument("--loop", type=int, default=1, help="replay the file(s) N times")
    p.add_argument("--rate", type=float, default=0.0,
                   help="events/sec (0 = ship as fast as possible in batches)")
    args = p.parse_args()

    if not args.source and not args.all:
        p.error("choose --source ssh|web|firewall or --all")

    sources = list(PARSERS) if args.all else [args.source]
    total = 0
    for rnd in range(1, args.loop + 1):
        for source in sources:
            path = args.file if (args.file and not args.all) else SAMPLE_FILES[source]
            if not os.path.exists(path):
                print(f"[{source}] no log file at {path} — skipping")
                continue
            events = parse_file(source, path)
            if not events:
                print(f"[{source}] parsed 0 events from {os.path.basename(path)}")
                continue

            if args.rate > 0:
                delay = 1.0 / args.rate
                sent = 0
                for ev in events:
                    sent += ship([ev], batch=1)
                    time.sleep(delay)
            else:
                sent = ship(events)

            total += sent
            tag = f" (round {rnd})" if args.loop > 1 else ""
            print(f"[{source}]{tag} shipped {sent} events from "
                  f"{os.path.basename(path)}")

    print(f"\ndone - {total} log events shipped to {INGEST_URL}\n"
          "The correlation engine evaluates every 20s; watch the Alerts tab or\n"
          "GET /api/alerts for rule-based alerts (SSH brute-force, port scan, ...).")


if __name__ == "__main__":
    main()
