# ATHENA NewsEngineV3 — Operations Architecture

## Overview
Phase 2.5 establishes the Production Operations, Monitoring, Replay, and Human Quality Control layer for ATHENA NewsEngineV3.

---

## Core Operations Components

1. **Notification Hub (`NotificationHub.ts`)**:
   - Centralized, single-entry notification dispatch.
   - Decoupled from core pipeline components.
   - Configurable rules table routing alerts to independent Telegram channels.

2. **Multi-Channel Telegram Router (`TelegramMultiChannelRouter.ts`)**:
   - `DEVELOPERS` (Channel A): Debug logs, parser metrics, AST details, AI prompts.
   - `OPERATIONS` (Channel B): Infrastructural failures, circuit breakers, memory & queue alerts.
   - `NEWS` (Channel C): Production verified news stories and market impact ratings.
   - `DAILY_REPORT` (Channel D): Automated end-of-day performance summaries.

3. **Replay Engine (`ReplayEngine.ts`)**:
   - Deterministic re-execution across the 10-stage pipeline:
     `RAW` → `NORMALIZED` → `DEDUP` → `CLASSIFIER` → `PARSER` → `VALIDATION` → `AI` → `QUALITY` → `STORAGE`.

4. **Human Review Queue (`HumanReviewQueue.ts`)**:
   - Captures low-confidence parses, quality gate warnings, or number conflicts.
   - Supports human reviewer actions: `APPROVE`, `REJECT`, `CORRECT`, `REPLAY`.

5. **Metrics & Failure Analytics (`MetricsEngine.ts`, `FailureAnalytics.ts`)**:
   - High-frequency throughput and latency metric tracking.
   - Ranked failure analytics categorization and root-cause aggregation.

6. **Release Readiness Dashboard (`ReleaseDashboardEngine.ts`)**:
   - Real-time scoring determining overall Release Status: `GREEN`, `YELLOW`, `RED`.
