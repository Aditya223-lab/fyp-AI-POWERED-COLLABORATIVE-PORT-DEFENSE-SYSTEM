# AI-Powered Collaborative Port Defense System

A final-year project: a system where multiple organisations share one live
threat dashboard, and a machine-learning model automatically classifies the
network attacks that come in.

## What it does

A Python service watches network ports. When it detects an attack, a
**Random Forest model** — trained on the real **CICIDS2017** intrusion-detection
dataset — classifies it (port scan, DoS, DDoS, brute-force, …). The result is
sent to a Spring Boot backend, stored in a database, and streamed live to a
Next.js web dashboard that shows it on a world map within a second.

## The three parts

```
python-ml/   →  Detects & classifies attacks with a RandomForest model   (Python)
backend/     →  REST API + H2 database + live SSE/WebSocket streaming     (Java / Spring Boot 4)
frontend/    →  The web dashboard — map, charts, 3D scene, live feed      (Next.js 14 / React)
```

Data flow: **Python classifies an attack → `POST /api/threats/ingest` → backend
saves it & broadcasts over SSE → frontend updates the dashboard live.**

## Tech stack

| Part | Language | Key tech |
|---|---|---|
| `python-ml` | Python 3 | scikit-learn (RandomForest), pandas, sockets |
| `backend` | Java 17 | Spring Boot 4, JPA / Hibernate, H2 database |
| `frontend` | TypeScript | Next.js 14, React 18, Tailwind, Three.js, Leaflet, NextAuth |

## Running it (three terminals)

**1 — Backend** (start first; runs on `:8080`)
```
cd backend
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
```

**2 — Frontend** (runs on `:3000`)
```
cd frontend/client
npm install                   # first time only
npm run dev
```

**3 — The AI** (streams real attacks through the model into the dashboard)
```
cd python-ml
pip install -r requirements.txt   # first time only
python replay.py --rate 2
```

Demo logins: `admin@demo.com / admin123`, `pro@demo.com / pro123`,
`user@demo.com / user123`.

## The machine-learning model

- Trained by `python-ml/train.py` on the CICIDS2017 dataset (download the
  "MachineLearningCSV" archive into `python-ml/data/cicids2017/`).
- A `RandomForestClassifier` (120 trees) inside a scikit-learn `Pipeline` with
  median imputation; 99.9% accuracy and 0.986 macro-F1 over 9 classes on a held-out test set of 190,660 flows.
- `python-ml/export_model_card.py` turns the training artifacts into the data
  shown on the dashboard's **`/model`** page.

## Repository layout

`backend/`, `python-ml/` and `frontend/` all live in this one repository (the
frontend used to be a separate git repo; it was merged in so a single GitHub
link holds the whole project).

## Looking inside the database

The backend uses a file-based H2 database in `backend/data/`. To query it:

```powershell
cd backend
.iew-db.ps1 -Sql "SELECT NAME, OWNER_EMAIL, IP_ADDRESSES FROM ORGANIZATIONS"
.iew-db.ps1 -Sql "SELECT NAME, TYPE, IP_ADDRESS, RESOLVED_IPS, STATUS FROM MONITOR_TARGETS"
```
