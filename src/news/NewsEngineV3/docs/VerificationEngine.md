# ATHENA NEWS ENGINE V3 — VERIFICATION ENGINE SPECIFICATION

## Overview

The `VerificationEngine` assigns trust scores and verification levels to `StoryCluster` instances based on source publisher authority, official exchange filings, and multi-publisher cross-confirmation.

---

## Publisher Trust Matrix

Each publisher in the ATHENA V3 pipeline carries a base trust weight (0 to 100):

| Publisher | ID | Category | Base Trust Score |
| :--- | :--- | :--- | :---: |
| **National Stock Exchange** | `NSE` | Official Exchange | **100** |
| **Bombay Stock Exchange** | `BSE` | Official Exchange | **100** |
| **Company Corporate Filing** | `COMPANY_FILING` | Primary Source | **100** |
| **Investor Relations** | `INVESTOR_RELATIONS` | Primary Source | **95** |
| **SEBI** | `SEBI` | Regulator | **95** |
| **Reserve Bank of India** | `RBI` | Central Bank | **95** |
| **Reuters** | `REUTERS` | Global Wire Service | **90** |
| **Economic Times** | `ECONOMIC_TIMES` | Tier-1 Financial Media | **85** |
| **Moneycontrol** | `MONEYCONTROL` | Tier-1 Financial Media | **85** |
| **LiveMint** | `LIVEMINT` | Tier-1 Financial Media | **85** |
| **Business Standard** | `BUSINESS_STANDARD` | Tier-1 Financial Media | **85** |
| **CNBC TV18** | `CNBC_TV18` | Financial Broadcast | **80** |
| **Press Information Bureau** | `PIB` | Government Release | **80** |
| **Google News RSS** | `GOOGLE_NEWS_RSS` | News Aggregator | **60** |
| **Other Publishers** | `OTHER_PUBLISHER` | Generic Outlet | **50** |

---

## Verification Rules & Scoring Formula

1. **Base Score**: Equal to the highest single publisher score in the cluster.
2. **Multi-Source Boost**: +10 points for each additional unique publisher (capped at +30 points).
3. **Official Filing + Wire Rule**:
   - `Reuters` + `NSE Filing` or `BSE Filing` = **100 Confidence (Highest Level)**.
   - Any Tier-1 Media + Official Exchange Filing = **Minimum 98 Score**.

---

## Trust Level Classifications

- **`EXCHANGE_CONFIRMED`**: Cluster contains at least one official exchange filing (`NSE`, `BSE`, `COMPANY_FILING`, `INVESTOR_RELATIONS`).
- **`MULTI_SOURCE_VERIFIED`**: Cluster confirmed by 2 or more distinct publishers including at least one Tier-1 media outlet.
- **`SINGLE_SOURCE`**: Cluster backed by exactly 1 publisher outlet.
- **`UNVERIFIED`**: Single source with trust score below 60.
