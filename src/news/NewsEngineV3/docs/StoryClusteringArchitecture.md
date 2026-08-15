# ATHENA NEWS ENGINE V3 — PHASE 4: STORY CLUSTERING ARCHITECTURE

## Executive Overview

The Phase 4 Cross-Publisher Deduplication & Story Clustering Engine transforms single-source normalized financial documents (`NormalizedDocument`) into deterministic, multi-source event representations (`StoryCluster`). The engine's core objective is **EVENT UNDERSTANDING**, ensuring that articles from multiple publishers describing the exact same underlying event (earnings releases, corporate actions, regulatory fines, M&A, IPOs) are unified into a single canonical story cluster without losing financial metrics, executive quotes, or publisher timelines.

---

## Core Pipeline Architecture

```
                                  [ Incoming NormalizedDocument ]
                                                 │
                                                 ▼
                                     [ Candidate Cluster Lookup ]
                                     (By Ticker & 7-Day Window)
                                                 │
                                                 ▼
                                     [ DuplicateDetector Engine ]
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
                (Match Found)                                     (No Match Found)
                        │                                                 │
                        ▼                                                 ▼
               [ StoryMerger Engine ]                          [ Create New StoryCluster ]
        • Merge Companies & Tickers                     • Extract Cluster Type
        • Preserve Financial Metrics                    • Initial Timeline Entry
        • Hash-Deduplicate Paragraphs                   • Calculate Verification Score
        • Append Timeline Entry                         • Index in ClusterRepository
        • Recalculate Verification Score                          │
                        │                                         │
                        └────────────────────────┬────────────────┘
                                                 │
                                                 ▼
                                     [ ClusterValidator Check ]
                                 (Enforce Non-Merge Constraints)
                                                 │
                                                 ▼
                                    [ Notification & Telemetry ]
                                • V3EventBus (CLUSTER_CREATED / STORY_UPDATED)
                                • Telegram Channels (Developers / Operations)
```

---

## Core Component Responsibilities

| Module | File | Responsibility |
| :--- | :--- | :--- |
| **Orchestrator** | `StoryClusterEngine.ts` | Main pipeline coordinator. Receives `NormalizedDocument`, performs candidate lookup, coordinates matching/merging, validates clusters, and publishes notifications. |
| **Detector** | `DuplicateDetector.ts` | Evaluates candidate clusters against incoming articles and classifies match types (`EXACT`, `NEAR_DUPLICATE`, `PARTIAL_OVERLAP`, `FOLLOW_UP`, `UPDATE`, `CORRECTION`, `BREAKING_NEWS_UPDATE`, `NO_MATCH`). Enforces strict non-merge constraints. |
| **Similarity** | `SimilarityCalculator.ts` | Calculates composite similarity score (0 to 100) using headline overlap, entity/ticker alignment, paragraph structure, date proximity, and document hashes. |
| **Entity Matcher** | `EntityMatcher.ts` | Measures company ticker overlap, primary company alignment, sector match, and financial currency metric overlap. |
| **Headline Similarity** | `HeadlineSimilarity.ts` | Calculates n-gram token overlap, Jaccard token index, financial metric overlap (e.g. Q1, 30%), and Levenshtein edit distance ratio. |
| **Paragraph Similarity**| `ParagraphSimilarity.ts` | Computes structural paragraph similarity using exact paragraph hashes, sentence hash intersections, and token overlap. |
| **Merger** | `StoryMerger.ts` | Executes deterministic document merging into `StoryCluster`, updating canonical headline, timeline entries, supporting publishers, merged paragraph hashes, and currency metrics. |
| **Verification** | `VerificationEngine.ts` | Computes publisher trust scores and multi-source verification weights. Official exchange filings (NSE/BSE/Company Filings) provide highest trust. |
| **Repository** | `ClusterRepository.ts` | High-speed in-memory repository providing indexed lookup by ticker, document ID, event type, and date range. |
| **Validator** | `ClusterValidator.ts` | Validates cluster integrity and guarantees that no merged cluster violates non-merge constraints. |

---

## Data Schema & Output Structures

The engine outputs `StoryCluster` instances containing:
- **Cluster ID**: Unique deterministic identifier (e.g., `CLUST_STORY_1001`)
- **Canonical Headline**: Cleanest, most informative headline (preferring official exchange filings or Tier-1 media)
- **Companies & Tickers**: Full list of extracted companies and stock tickers
- **Event Type**: Categorized event type (`QUARTERLY_RESULTS`, `BROKER_REPORT`, `CORPORATE_ACTION`, `IPO`, `GOVERNMENT`, `RBI`, `SEBI`, `M_AND_A`, `MACRO`, `COMMODITY`, `FOREX`, `CRYPTO`, `GENERAL`)
- **Verification Score**: Multi-source score (0-100) with trust level (`EXCHANGE_CONFIRMED`, `MULTI_SOURCE_VERIFIED`, `SINGLE_SOURCE`, `UNVERIFIED`)
- **Merged Timeline**: Chronological entries tracking original publications, updates, corrections, and breaking releases
- **Merged Paragraphs & Currencies**: Deduplicated paragraph text and complete financial currency metrics
