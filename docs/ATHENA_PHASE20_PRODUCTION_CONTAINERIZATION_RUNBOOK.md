# ATHENA — PHASE 20B: PRODUCTION CONTAINERIZATION & ENVIRONMENT PROVISIONING RUNBOOK

**Repository**: `yashrocky2502/Athena`  
**Frozen Baseline Commit**: `0c9e226`  
**Position Alert Subsystem Status**: `FROZEN / CONTROLLED-READY`  
**Live Activation**: `NOT ACTIVATED`  
**Production Safety State**: `ATHENA_POSITION_ALERTS_ENABLED=false`, `ATHENA_POSITION_ALERTS_KILL_SWITCH=true`, `ATHENA_POSITION_ALERTS_LIVE_CONFIRMED=false`  

---

## 1. EXECUTIVE OVERVIEW & INFRASTRUCTURE BOUNDARY

Phase 20B establishes the official production containerization specification and environment provisioning runbook for Athena.

### Key Infrastructure Requirements Solved
1. **Multi-Stage Production Docker Build**: Deterministic Node 22 Alpine multi-stage Docker build producing a minimal runtime image.
2. **Persistent `./data` Storage Volume**: Explicit persistent volume mount (`/app/data`) preserving all 7 protected production datasets across container restarts.
3. **Fail-Closed Environment Provisioning**: Standardized `.env.production.example` template enforcing zero Position Alert live activation by default.
4. **Non-Root Execution Context**: Non-root system user (`athena`) with non-privileged filesystem permissions.
5. **Native Container Healthcheck**: Wget-based healthcheck polling `/api/health` without triggering news ingestion, Telegram notifications, or data mutations.

---

## 2. PRODUCTION STARTUP CONTRACT

```bash
# 1. Build Production Container Image
docker build -t athena:latest .

# 2. Run Production Container with Persistent Volume Mount
docker run -d \
  --name athena-production \
  -p 3000:3000 \
  -v athena_data:/app/data \
  --env-file .env.production \
  athena:latest
```

### Execution Invariants
- **Port**: Listens on port `3000` (configurable via `PORT`).
- **Static Assets**: Express static middleware serves production bundle from `dist/`.
- **Background Tasks**: Hydration and news sync start asynchronously; HTTP health endpoint binds immediately.
- **Position Alerts**: Remain `DISABLED` (`ATHENA_POSITION_ALERTS_ENABLED=false`, `ATHENA_POSITION_ALERTS_KILL_SWITCH=true`).
- **Trading Isolation**: Zero trading or order placement execution methods exist.

---

## 3. PERSISTENT DATA VOLUME SPECIFICATION

The `./data` directory contains 7 critical persistent datasets:
1. `data/news_core_v2.json`: Persistent historical news article store.
2. `data/news_intelligence_v2.json`: Entity classification & FNO intelligence store.
3. `data/telegram_outbox.json`: Global news Telegram dispatch outbox.
4. `data/portfolio_store.json`: Reconciled user portfolio holdings store.
5. `data/market_intelligence_outcomes.json`: Analytical signal outcomes store.
6. `data/news_signal_lifecycle.json`: Active market signal lifecycle tracker.
7. `data/news_signal_historical_ledger.json`: Historical signal emissions ledger.

### Volume Mounting Guarantee
In production container environments (Docker, Kubernetes, Cloud Run with GCS FUSE), the host filesystem volume **MUST** be mounted to `/app/data`. If `/app/data` is unmounted on a stateless container instance, container restarts will reset file state.

---

## 4. HUMAN OPERATOR PROVISIONING RUNBOOK

> **OPERATOR INSTRUCTIONS**: Copy `.env.production.example` to `.env.production` in your secure deployment environment and inject real API credentials.

```bash
# Production environment setup
cp .env.production.example .env.production

# Edit secrets in .env.production (GEMINI_API_KEY, TELEGRAM_BOT_TOKEN)
# DO NOT MODIFY ATHENA_POSITION_ALERTS_ENABLED or ATHENA_POSITION_ALERTS_KILL_SWITCH
```

### Required Secrets
- `GEMINI_API_KEY`: Required for AI summarization & entity extraction.
- `TELEGRAM_BOT_TOKEN`: Optional for global news channel broadcasts.

### Frozen Controls (DO NOT ALTER)
- `ATHENA_POSITION_ALERTS_ENABLED=false`
- `ATHENA_POSITION_ALERTS_KILL_SWITCH=true`
- `ATHENA_POSITION_ALERTS_LIVE_CONFIRMED=false`
