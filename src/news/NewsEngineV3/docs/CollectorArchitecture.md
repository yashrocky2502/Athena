# ATHENA NewsEngineV3 — Collector Architecture

## Overview
Phase 2 introduces a production-grade collector infrastructure designed for reliability, rate limiting, circuit breaker protection, deduplication, and real-time health monitoring across major Indian financial news publishers.

---

## Collector Inheritance & Interface Hierarchy

```
                   ┌───────────────────────┐
                   │      ICollector       │
                   └──────────┬────────────┘
                              │
                              ▼
                   ┌───────────────────────┐
                   │    BaseCollectorV3    │
                   └──────────┬────────────┘
                              │
      ┌───────────────────────┼───────────────────────┬───────────────────────┐
      │                       │                       │                       │
      ▼                       ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│EconomicTimes │       │   Reuters    │       │ Moneycontrol │       │   LiveMint   │
│  Collector   │       │  Collector   │       │  Collector   │       │  Collector   │
└──────────────┘       └──────────────┘       └──────────────┘       └──────────────┘
```

---

## Key Collector Capabilities

1. **State Machine**:
   - `STARTING`: Initial setup and connection testing.
   - `RUNNING`: Normal polling active.
   - `RETRYING`: Exponential backoff in progress following an error.
   - `PAUSED`: Temporarily suspended via command or configuration.
   - `FAILED`: Circuit breaker open due to 5+ consecutive failures.
   - `OFFLINE`: Completely shut down or uninitialized.

2. **Circuit Breaker Pattern**:
   - Automatically trips after 5 consecutive fetch failures.
   - Enforces a 30-second cooldown period before attempting half-open recovery.
   - Emits `COLLECTOR_FAILED` event to alert Telegram monitor.

3. **In-Memory URL Deduplication**:
   - Maintains a bounded cache of seen source URLs per collector (up to 5,000 entries).
   - Prevents duplicate raw articles from re-entering the pipeline queue.

4. **Collector Registry**:
   - Central registration hub supporting `initializeAll()`, `pollSingle()`, `pollAll()`, `startPolling()`, `enable()`, `disable()`, and `health()`.
