"""
demo_all.py - one command that lights up the whole system for a demo.

attack_targets.py attacks the assets you registered. This script goes wider: it
builds an inventory of *every IP the system knows about* - registered monitor
targets, the IPs each website resolved to, and every organization's IP list -
and then, for each of those IPs:

  1. INBOUND   an external attacker hits it. A real, labelled CICIDS2017 flow is
               drawn from artifacts/holdout.csv, re-pointed at that IP and port,
               classified by the trained RandomForest, and posted as a Threat
               (POST /api/threats/ingest) with targetIp set - so the dashboard
               shows which asset was hit.
  2. OUTGOING  the same IP is treated as compromised and attacks back out:
               beaconing, lateral movement to another asset in the inventory, or
               scanning the internet. Same model, same ingest, but this time the
               system's own IP is the sourceIP - which is what makes every IP in
               the federation show outgoing attacks too.
  3. LOGS      matching SIEM events are shipped to POST /api/logs/ingest (SSH
               brute-force, web attacks, firewall denies both inbound and
               outbound) so the correlation engine raises rule-based alerts
               alongside the ML ones.

Everything posted is a simulation built from real labelled data. No packets are
sent to any of these IPs - the only component that touches the network for real
is the backend's asset monitor (and target_scanner.py, for hosts you own).

    python demo_all.py                     # one full pass over every IP
    python demo_all.py --rounds 5          # five passes
    python demo_all.py --forever           # keep going until Ctrl-C
    python demo_all.py --rate 6            # 6 events/sec
    python demo_all.py --no-outgoing       # inbound attacks only
    python demo_all.py --no-logs           # skip SIEM log shipment
    python demo_all.py --only DDoS         # replay one attack family

Needs a trained model (python train.py) and the backend on localhost:8080.
"""
from __future__ import annotations

import argparse
import random
import sys
import time

import requests

from attack_targets import (
    API_BASE,
    ObservationWriter,
    canonical_label,
    fake_source_ip,
    load_attack_pool,
    post_threat,
    service_for,
)
from model import ThreatModel
from target_scanner import parse_ports

TARGETS_URL = f"{API_BASE}/targets"
ORGS_URL = f"{API_BASE}/organizations"
LOG_INGEST_URL = f"{API_BASE}/logs/ingest"

# Ports an attacker typically reaches for when moving laterally or scanning out.
LATERAL_PORTS = [22, 23, 135, 139, 445, 1433, 3306, 3389, 5432, 6379, 27017]
# Where a compromised host "phones home" to.
C2_PORTS = [443, 8443, 8080, 4444, 8888]

USERNAMES = ["root", "admin", "ubuntu", "postgres", "oracle", "git", "test", "deploy"]
WEB_ATTACK_PATHS = [
    "/index.php?id=1' OR 1=1--",
    "/wp-login.php",
    "/admin/config.php",
    "/../../etc/passwd",
    "/search?q=<script>alert(1)</script>",
    "/.env",
    "/phpmyadmin/index.php",
]


class Asset:
    """One IP the system knows about, and how to describe it."""

    def __init__(self, ip: str, label: str, ports: list[int],
                 org_id: str | None, kind: str):
        self.ip = ip
        self.label = label
        self.ports = ports or [80, 443, 22]
        self.org_id = org_id
        self.kind = kind          # "target" | "website" | "org"

    def __repr__(self) -> str:
        return f"<Asset {self.ip} {self.label} ({self.kind})>"


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------


def _get(url: str) -> list[dict]:
    try:
        r = requests.get(url, timeout=4)
        if r.ok:
            return r.json()
        print(f"  GET {url} returned {r.status_code}")
    except requests.RequestException as exc:
        sys.exit(f"Backend unreachable at {url}: {exc}\n"
                 "Start the Spring backend first (cd backend; .\\mvnw.cmd spring-boot:run).")
    return []


def build_inventory() -> list[Asset]:
    """Every IP in the system: monitor targets, their resolved IPs, org IPs."""
    assets: dict[str, Asset] = {}

    for t in _get(TARGETS_URL):
        ports = parse_ports(t.get("ports", "")) or []
        name = t.get("name", t.get("id", "asset"))
        kind = "website" if str(t.get("type", "HOST")).upper() == "WEBSITE" else "target"
        # The address the monitor is probing, plus every A record DNS returned -
        # a site behind a CDN legitimately has several.
        ips = [t.get("ipAddress")] + str(t.get("resolvedIps") or "").split(",")
        for ip in ips:
            ip = (ip or "").strip()
            if not ip or ip in assets:
                continue
            assets[ip] = Asset(ip, name, ports, t.get("organizationId"), kind)

    for o in _get(ORGS_URL):
        for ip in o.get("ipAddresses") or []:
            ip = (ip or "").strip()
            if not ip or ip in assets:
                continue
            assets[ip] = Asset(ip, o.get("name", "org"),
                               [22, 80, 443, 3306, 8080], o.get("id"), "org")

    return list(assets.values())


# ---------------------------------------------------------------------------
# Log shipment
# ---------------------------------------------------------------------------


def ship_logs(events: list[dict]) -> int:
    if not events:
        return 0
    try:
        r = requests.post(LOG_INGEST_URL, json=events, timeout=5)
        if r.ok:
            return r.json().get("ingested", len(events))
        print(f"  log ingest rejected {r.status_code}: {r.text[:160]}")
    except requests.RequestException as exc:
        print(f"  log ingest unreachable: {exc}")
    return 0


def inbound_logs(asset: Asset, attacker_ip: str, port: int, org_id: str | None) -> list[dict]:
    """What the victim's own logs would look like while it is being attacked."""
    events: list[dict] = []
    user = random.choice(USERNAMES)
    # An SSH brute-force burst: enough failures to trip the correlation rule.
    for _ in range(random.randint(6, 12)):
        events.append({
            "source": "ssh",
            "eventType": "auth_failure",
            "sourceIP": attacker_ip,
            "username": user,
            "targetPort": 22,
            "message": f"Failed password for {user} from {attacker_ip} on {asset.ip}",
            "rawLine": f"sshd[{random.randint(1000, 9999)}]: Failed password for "
                       f"{user} from {attacker_ip} port {random.randint(30000, 60000)} ssh2",
            "organizationId": org_id,
        })
    # A web attack against the same asset.
    path = random.choice(WEB_ATTACK_PATHS)
    events.append({
        "source": "web",
        "eventType": "http_attack",
        "sourceIP": attacker_ip,
        "targetPort": 80,
        "statusCode": random.choice([200, 403, 404, 500]),
        "message": f"GET {path} -> {asset.ip}",
        "rawLine": f'{attacker_ip} - - "GET {path} HTTP/1.1" 403',
        "organizationId": org_id,
    })
    # The firewall dropping the rest of the scan.
    for p in random.sample(LATERAL_PORTS, k=min(5, len(LATERAL_PORTS))):
        events.append({
            "source": "firewall",
            "eventType": "connection_denied",
            "sourceIP": attacker_ip,
            "targetPort": p,
            "message": f"DENY IN {attacker_ip} -> {asset.ip}:{p}",
            "rawLine": f"DENY TCP {attacker_ip}:{random.randint(1024, 65535)} "
                       f"-> {asset.ip}:{p}",
            "organizationId": org_id,
        })
    return events


def outgoing_logs(asset: Asset, victim_ip: str, port: int, org_id: str | None) -> list[dict]:
    """What a compromised asset's own traffic looks like on the way out."""
    return [
        {
            "source": "firewall",
            "eventType": "connection_denied",
            "sourceIP": asset.ip,
            "targetPort": port,
            "message": f"DENY OUT {asset.ip} -> {victim_ip}:{port} (egress policy)",
            "rawLine": f"DENY TCP {asset.ip}:{random.randint(1024, 65535)} "
                       f"-> {victim_ip}:{port}",
            "organizationId": org_id,
        },
        {
            "source": "firewall",
            "eventType": "port_connect",
            "sourceIP": asset.ip,
            "targetPort": random.choice(C2_PORTS),
            "message": f"ACCEPT OUT {asset.ip} -> {victim_ip} (possible C2 beacon)",
            "rawLine": f"ACCEPT TCP {asset.ip}:{random.randint(1024, 65535)} "
                       f"-> {victim_ip}:443",
            "organizationId": org_id,
        },
        {
            "source": "system",
            "eventType": "outbound_anomaly",
            "sourceIP": asset.ip,
            "targetPort": port,
            "message": f"{asset.label}: unusual outbound volume to {victim_ip}:{port}",
            "rawLine": f"[netflow] {asset.ip} -> {victim_ip}:{port} "
                       f"{random.randint(40, 900)}MB in 60s",
            "organizationId": org_id,
        },
    ]


# ---------------------------------------------------------------------------
# Attacks
# ---------------------------------------------------------------------------


class Replayer:
    """Draws real labelled flows and runs them through the real model."""

    def __init__(self, model: ThreatModel, pool, feature_cols: list[str],
                 observer: ObservationWriter):
        self.model = model
        self.pool = pool
        self.feature_cols = feature_cols
        self.observer = observer
        self.sent = 0
        self.correct = 0
        self.delivered = 0
        self.misses: list[str] = []

    def fire(self, source_ip: str, target_ip: str, port: int,
             org_id: str | None, direction: str) -> tuple[str, str, bool]:
        flow = self.pool.sample(n=1).iloc[0]
        truth = canonical_label(flow["Label"])
        features = {c: flow[c] for c in self.feature_cols}
        features["Destination Port"] = port

        prediction = self.model.predict(features)
        predicted = canonical_label(prediction.attack_type)
        hit = predicted == truth

        self.sent += 1
        self.correct += 1 if hit else 0
        if not hit:
            self.misses.append(f"{truth}->{predicted} on {target_ip}:{port}")
        self.observer.write(features, truth)

        ok = post_threat({
            "sourceIP": source_ip,
            "targetPort": port,
            "targetIp": target_ip,
            "targetService": service_for(port),
            "severity": prediction.severity,
            "scanType": "connect",
            # Tag the direction so an analyst can tell "we were attacked" from
            # "our own host is attacking someone". The prefix goes on the
            # collapsed family name (WebAttack, not "Web Attack - Brute
            # Force") so it stays inside the backend's 32-char column.
            "attackType": f"Outbound-{predicted}" if direction == "out" else prediction.attack_type,
            "anomalyScore": prediction.confidence,
            "confidence": prediction.confidence,
            "isZeroDay": prediction.is_zero_day(),
            "responseTime": 0,
            "organizationId": org_id,
        })
        self.delivered += 1 if ok else 0
        return truth, predicted, hit


def main() -> None:
    p = argparse.ArgumentParser(
        description="Attack every IP in the system, in both directions, with logs")
    p.add_argument("--rounds", type=int, default=1, help="passes over the inventory")
    p.add_argument("--forever", action="store_true", help="loop until Ctrl-C")
    p.add_argument("--rate", type=float, default=4.0, help="events per second")
    p.add_argument("--per-asset", type=int, default=2,
                   help="attacks per asset per direction per round")
    p.add_argument("--only", default=None, help="replay one family only, e.g. DDoS")
    p.add_argument("--no-outgoing", action="store_true",
                   help="skip the compromised-host outgoing attacks")
    p.add_argument("--no-logs", action="store_true", help="skip SIEM log shipment")
    p.add_argument("--no-collect", action="store_true",
                   help="do not append observations to observed.csv")
    args = p.parse_args()

    print("building inventory of every IP in the system...")
    inventory = build_inventory()
    if not inventory:
        sys.exit("No IPs found. Register an asset in the app (Admin -> Assets, or "
                 "Monitor -> Assets) or seed organizations, then re-run.")

    by_kind: dict[str, int] = {}
    for a in inventory:
        by_kind[a.kind] = by_kind.get(a.kind, 0) + 1
    print(f"  {len(inventory)} IP(s): "
          + ", ".join(f"{n} {k}" for k, n in sorted(by_kind.items())))

    model = ThreatModel.load()
    if model.fallback:
        print("WARNING: no trained model found - using the heuristic fallback. "
              "Run 'python train.py' for the real model.")
    else:
        print(f"model: {model.description}")

    pool, feature_cols = load_attack_pool(args.only)
    observer = ObservationWriter(feature_cols, enabled=not args.no_collect)
    replay = Replayer(model, pool, feature_cols, observer)

    delay = 1.0 / max(args.rate, 0.1)
    logs_shipped = 0
    rnd = 0

    print(f"\nattacking {len(inventory)} IP(s) - inbound"
          + ("" if args.no_outgoing else " + outgoing")
          + ("" if args.no_logs else " + SIEM logs")
          + f" -> {API_BASE}\nCtrl-C to stop.\n")

    try:
        while args.forever or rnd < args.rounds:
            rnd += 1
            for asset in inventory:
                ports = asset.ports or [80]
                chosen = random.sample(ports, k=min(args.per_asset, len(ports)))
                print(f"[round {rnd}] {asset.label} ({asset.ip}) "
                      f"{asset.kind} ports={chosen}")

                # 1. Inbound: someone on the internet attacks this asset.
                for port in chosen:
                    attacker = fake_source_ip()
                    truth, predicted, hit = replay.fire(
                        attacker, asset.ip, port, asset.org_id, "in")
                    print(f"    IN   [{'OK  ' if hit else 'MISS'}] {attacker} -> "
                          f"{asset.ip}:{port}  real={truth:<12} model={predicted}")
                    if not args.no_logs:
                        logs_shipped += ship_logs(
                            inbound_logs(asset, attacker, port, asset.org_id))
                    time.sleep(delay)

                # 2. Outgoing: treat this asset as compromised and let it attack
                #    another asset in the inventory (or the wider internet).
                if args.no_outgoing:
                    continue
                others = [x for x in inventory if x.ip != asset.ip]
                for _ in range(args.per_asset):
                    if others and random.random() < 0.7:
                        victim = random.choice(others)
                        victim_ip = victim.ip
                        victim_org = victim.org_id
                        port = random.choice(victim.ports or LATERAL_PORTS)
                    else:
                        victim_ip = fake_source_ip()
                        victim_org = asset.org_id
                        port = random.choice(LATERAL_PORTS + C2_PORTS)

                    truth, predicted, hit = replay.fire(
                        asset.ip, victim_ip, port, victim_org, "out")
                    print(f"    OUT  [{'OK  ' if hit else 'MISS'}] {asset.ip} -> "
                          f"{victim_ip}:{port}  real={truth:<12} model={predicted}")
                    if not args.no_logs:
                        logs_shipped += ship_logs(
                            outgoing_logs(asset, victim_ip, port, asset.org_id))
                    time.sleep(delay)
    except KeyboardInterrupt:
        print("\nstopped.")
    finally:
        observer.close()

    print(f"\ndone - {replay.sent} attacks simulated across {len(inventory)} IP(s), "
          f"{replay.delivered} delivered to the backend"
          + (f", {logs_shipped} log events shipped" if not args.no_logs else ""))
    if replay.sent:
        print(f"live model accuracy on replayed flows: {replay.correct / replay.sent:.1%}")
    if replay.misses:
        print(f"\n{len(replay.misses)} misclassification(s) captured for retraining:")
        for m in replay.misses[:15]:
            print(f"    {m}")
        if len(replay.misses) > 15:
            print(f"    ... and {len(replay.misses) - 15} more")
    if not args.no_collect and replay.sent:
        print("\nRetrain with:  python train.py   (it folds observed.csv back in)")
    if not args.no_logs:
        print("The correlation engine runs every 20s - watch the Alerts tab.")


if __name__ == "__main__":
    main()
