# python-ml — real-time port-scan detector

A Python service that catches port-scan patterns in real time and pushes
detected threats into the Spring backend, which broadcasts them on the SSE
channel so the Next.js frontend lights up live.

## Architecture

```
[attacker, e.g. nmap]
        │ TCP SYN/connect to multiple ports
        ▼
[python-ml detector]  ──────────────────────────────────────────┐
  honeypot listeners on ports 2201–2210                         │
  sliding-window scan detector                                  │
  CICIDS2017-trained RandomForest classifies each scan          │
        │ POST http://localhost:8080/api/threats/ingest          │
        ▼                                                       │
[Spring backend]                                                │
  saves Threat row                                              │
  EventsController.broadcast(dto)                               │
        │ text/event-stream                                     │
        ▼                                                       │
[Next.js frontend] ◄─────── useThreatStream() ──────────────────┘
  ThreatList, AttackMap, severity bars update instantly
```

## Setup (Windows / macOS / Linux)

From the project root:

```powershell
cd python-ml
python -m venv .venv
.venv\Scripts\Activate.ps1     # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
```

## Train the AI model (do this once)

The detector classifies threats with a model trained on **CICIDS2017**, a real
intrusion-detection dataset of labelled network flows (port scans, DoS/DDoS,
brute-force, web attacks, botnet traffic).

1. Download the CICIDS2017 **MachineLearningCSV** archive from the Canadian
   Institute for Cybersecurity:
   <https://www.unb.ca/cic/datasets/ids-2017.html>

2. Unzip the 8 CSV files into:

   ```
   python-ml/data/cicids2017/
   ```

3. Train:

   ```powershell
   python train.py
   ```

   This prints an accuracy / per-class report and writes to `artifacts/`:

   | File | Purpose |
   |---|---|
   | `model.joblib` | the trained pipeline used by every other script |
   | `holdout.csv` | real, unseen attack records for the replay demo |
   | `confusion_matrix.csv` / `.png` | evaluation output for your report |

   Laptop low on RAM? `python train.py --max-benign 100000`.

If you skip training, the detector still runs — it falls back to a simple
port-based heuristic and tells you so.

## Run

Make sure the Spring backend is up on `http://localhost:8080`, then:

```powershell
python detector.py
```

You should see:

```
ready. Try:  nmap -p 2201-2210 localhost
```

## Demo end-to-end

1. Spring backend running on `:8080`
2. Next.js frontend on `:3000` (open `/admin` or `/attacks` in your browser)
3. `python detector.py` in another terminal
4. From a fourth terminal, run a port scan:

   ```powershell
   nmap -p 2201-2210 localhost
   ```

   No nmap? Plain Windows works too:

   ```powershell
   foreach ($p in 2201..2210) { Test-NetConnection -ComputerName localhost -Port $p -InformationLevel Quiet | Out-Null }
   ```

5. Within 1-2 seconds the detector prints:

   ```
   ALERT  MEDIUM PortScan from 127.0.0.1 -> 10 ports in 0.34s (confidence 0.88) -> backend
   ```

   And the frontend dashboard shows a new threat event at the top of the
   list, in the attack stream, on the world map, and in the live counter.

## Scanning a Docker container

1. Start your container with port forwarding so the detector can see scans
   directed at it (or run the detector inside the container's network):

   ```powershell
   docker run -d -p 2201-2210:2201-2210 --name my-app my-image
   ```

2. Or run the detector inside Docker on the same network and point your
   scanner at the container IP. Either way, the flow is identical — a scan
   produces a real-time alert.

## Config

All via environment variables:

| Variable | Default | What it does |
|---|---|---|
| `PORTDEFENSE_API` | `http://localhost:8080/api/threats/ingest` | Where to push detected threats |
| `PORTDEFENSE_PORTS` | `2201,2202,…,2210` | Comma-separated honeypot ports |
| `PORTDEFENSE_WINDOW_SECONDS` | `5` | Sliding window size |
| `PORTDEFENSE_MIN_PORTS` | `4` | Distinct ports in the window before we call it a scan |
| `PORTDEFENSE_COOLDOWN` | `10` | Seconds before the same source IP can trigger another alert |
| `PORTDEFENSE_BIND` | `0.0.0.0` | Bind interface (use `127.0.0.1` for localhost-only) |

## Replay real attacks (demo)

The honeypot only ever produces *port-scan* traffic. To show the model
detecting **every** attack class — DoS, DDoS, botnet, brute-force, web
attacks — replay the real held-out records that `train.py` set aside:

```powershell
python replay.py                 # stream the held-out attacks, ~2/sec
python replay.py --rate 5        # faster
python replay.py --only DDoS     # one attack family only
```

Every record replayed is a genuine CICIDS2017 flow the model never saw during
training. The console prints `real=` vs `model=` for each one, plus a running
accuracy, and each classified threat appears live on the dashboard.

## Attack every IP in the system (`demo_all.py`)

`replay.py` streams held-out attacks at random ports; `attack_targets.py` aims
them at the assets you registered. `demo_all.py` goes wider still — it builds an
inventory of **every IP the system knows about** (monitor targets, the IPs each
monitored website currently resolves to, and every organization's IP list) and
then, for each one:

1. **inbound** — an external attacker hits it with a real labelled CICIDS2017
   flow, classified by the model and posted with `targetIp` set, so the
   dashboard shows which asset was hit;
2. **outgoing** — the same IP is treated as compromised and attacks back out
   (lateral movement to another asset, or a beacon to the internet), posted with
   the system's own IP as `sourceIP` and the family prefixed `Outbound-`;
3. **logs** — matching SIEM events (SSH brute-force burst, web attack, firewall
   denies, egress deny, netflow anomaly) are shipped to `/api/logs/ingest` so the
   correlation engine raises rule-based alerts too.

```powershell
python demo_all.py                 # one pass over every IP
python demo_all.py --forever       # keep going until Ctrl-C
python demo_all.py --rate 6        # 6 events/sec
python demo_all.py --per-asset 3   # more attacks per IP per round
python demo_all.py --no-outgoing   # inbound only
python demo_all.py --no-logs       # skip the SIEM log shipment
python demo_all.py --only DDoS     # one attack family
```

Every flow carries its true label, so the script prints `OK`/`MISS` per attack,
a live accuracy at the end, and appends observations to
`data/collected/observed.csv` for retraining.

**This sends no packets to any of those IPs.** It posts simulated events built
from real labelled data. The only parts of the project that make real network
connections are `target_scanner.py` (hosts you own) and the backend's asset
monitor. `target_scanner.py` skips `WEBSITE` targets for exactly that reason —
checking that a site loads is not the same act as port-scanning it.

## How the AI works

`train.py` trains a scikit-learn pipeline on CICIDS2017:

1. **Load + clean** — reads the CSV files, strips the leading spaces CICFlowMeter
   leaves in column names, converts the `Infinity` values in the rate columns
   to missing data, and drops empty/constant columns.
2. **Label grouping** — CICIDS2017's 15 raw labels are collapsed into compact
   attack families: `BENIGN, PortScan, DoS, DDoS, BruteForce, WebAttack, Bot,
   Infiltration, Heartbleed`.
3. **Balance** — BENIGN is ~80% of the data, so it is capped (`--max-benign`)
   and the classifier uses `class_weight="balanced_subsample"` so rare attacks
   are not drowned out.
4. **Train + evaluate** — a `RandomForestClassifier` inside a `Pipeline` with a
   median `SimpleImputer`, evaluated on a stratified 25% hold-out with an
   accuracy / per-class report and a confusion matrix.

At inference time (`model.py` → `ThreatModel`):

- The caller passes whatever features it can observe as a dict. The honeypot
  only sees a few (destination port, packet counts, timing); the imputer fills
  the rest with training-set medians, so partial observations still classify.
- The model returns an **attack type**, a **confidence**, and a **severity**
  (`PortScan`→medium, `DoS`/`DDoS`/`BruteForce`/`WebAttack`→high,
  `Bot`/`Infiltration`/`Heartbleed`→critical, lowered if confidence is weak).
- `Bot` / `Infiltration` / `Heartbleed` at >0.8 confidence are flagged as
  possible zero-days.

Every script — `detector.py`, `target_scanner.py`, `replay.py` — classifies
through the same `ThreatModel`, so behaviour stays consistent across the system.
