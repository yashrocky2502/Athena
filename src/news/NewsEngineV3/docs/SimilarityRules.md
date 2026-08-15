# ATHENA NEWS ENGINE V3 — SIMILARITY & MATCHING RULES

## Overview

The `SimilarityCalculator` and `DuplicateDetector` modules perform multi-dimensional comparisons between incoming `NormalizedDocument` instances and active `StoryCluster` candidates.

---

## Metric Weights & Scoring Matrix

Composite similarity score (0 to 100) is calculated as:

$$\text{Composite Score} = (H \times 0.35) + (E \times 0.25) + (P \times 0.20) + (D \times 0.10) + (C \times 0.10)$$

Where:
- $H$: Headline Similarity (0 to 100)
- $E$: Entity & Ticker Overlap Score (0 to 100)
- $P$: Structural Paragraph & Hash Similarity (0 to 100)
- $D$: Publication Date Proximity (0 to 100)
- $C$: Event Category Alignment (0 to 100)

---

## Match Classifications

| Match Type | Condition | Action Taken |
| :--- | :--- | :--- |
| **`EXACT`** | Raw hash match OR composite score $\ge 95$ | Direct merge; paragraph hash deduplication |
| **`NEAR_DUPLICATE`** | Composite score $75 - 94$ | Merge into cluster; update canonical headline if newer/longer |
| **`PARTIAL_OVERLAP`** | Composite score $55 - 74$ | Merge into cluster; add timeline entry |
| **`FOLLOW_UP`** | Composite score $55 - 74$ AND $6 - 72$ hours after first seen | Merge as follow-up story with timeline delta |
| **`UPDATE`** | Same publisher, composite score $\ge 75$ | Merge as publisher story revision |
| **`CORRECTION`** | Article headline contains "Correction" / "Clarification" | Flag as story correction in timeline |
| **`BREAKING_NEWS_UPDATE`**| Headline contains "Breaking" / "Live" within 2 hours | Promoted as breaking timeline update |
| **`NO_MATCH`** | Composite score $< 55$ OR Hard Conflict Triggered | Create new `StoryCluster` |

---

## Strict Non-Merge Quality Rules

The engine enforces mandatory non-merge rules to guarantee zero false positives:

1. **Company Ticker Conflict**: Articles with different primary tickers (e.g. `HEROMOTOCO` vs `BAJAJ-AUTO`) are **NEVER** merged.
2. **Quarter Conflict**: Articles referring to different fiscal quarters (e.g. `Q1 FY27` vs `Q2 FY27` or `Q1 FY26`) are **NEVER** merged.
3. **Event Category Conflict**: M&A announcements are never merged with Quarterly Results or Tax Demands.
4. **Time Window Restriction**: Articles published $> 7$ days apart are never merged into the same cluster.
