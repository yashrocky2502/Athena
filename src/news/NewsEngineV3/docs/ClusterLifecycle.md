# ATHENA NEWS ENGINE V3 — CLUSTER LIFECYCLE MANAGEMENT

## Overview

A `StoryCluster` represents an evolving financial event over time. This document describes the lifecycle stages, event notifications, state transitions, and Telegram alert broadcasts.

---

## Lifecycle Stages

```
[ New Article Received ]
           │
           ▼
 [ Match Detection ]
     ├─── Match Found ─────► [ StoryMerger ] ─────► [ Timeline Append ] ──► [ STORY_UPDATED ]
     │                                                                           │
     └─── No Match ────────► [ New Cluster ] ─────► [ Initial State ] ───► [ CLUSTER_CREATED ]
                                                                                 │
                                                                                 ▼
                                                                     [ Verification Re-Check ]
                                                                                 │
                                                                     (If Score >= 90 & Tier 1)
                                                                                 │
                                                                                 ▼
                                                                     [ NEW_SOURCE_VERIFIED ]
```

---

## State Transition Definitions

1. **`CLUSTER_CREATED`**:
   - Triggered when an incoming `NormalizedDocument` does not match any existing candidate cluster.
   - Initial timeline entry created with `entryType: 'ORIGINAL'`.
   - Indexed in `ClusterRepository` by company tickers and document ID.

2. **`STORY_UPDATED`**:
   - Triggered when a subsequent article from the same or different publisher matches an existing cluster.
   - Financial metrics merged and deduplicated.
   - New `TimelineEntry` appended (`UPDATE`, `CORRECTION`, `BREAKING`, or `LATEST_VERSION`).

3. **`NEW_SOURCE_VERIFIED`**:
   - Triggered when a new publisher joins an existing cluster, elevating its verification score to $\ge 90/100$ or confirming via an official exchange filing (`NSE`/`BSE`).

4. **`MERGE_FAILED`**:
   - Triggered if an attempted merge fails `ClusterValidator` checks (e.g. primary company mismatch or score bounds violation).
   - Alert sent directly to Operations channel.

---

## Notification & Telegram Subscriptions

| Event Type | Channel Target | Message Content |
| :--- | :--- | :--- |
| **`CLUSTER_CREATED`** | `DEVELOPERS` | Cluster ID, canonical headline, event type, tickers, verification score, processing latency |
| **`STORY_UPDATED`** | `DEVELOPERS` | Cluster ID, updated headline, match type, similarity score, current supporting publishers |
| **`NEW_SOURCE_VERIFIED`**| `OPERATIONS` | Verified cluster ID, verified sources list, trust level (`EXCHANGE_CONFIRMED`) |
| **`MERGE_FAILED`** | `OPERATIONS` | Article ID, cluster ID, validation error details |
