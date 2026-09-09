# ATHENA — PHASE 19A.4
# Canonical Schema & Interface Forensic Audit

**Audit Timestamp:** 2026-08-30
**Scope:** Type safety, schema evolution across V1–V5 API contracts, and entity definitions in `src/types.ts`, `src/news/quant/types.ts`, `src/news/portfolio/types.ts`, `src/news/execution/types.ts`, `src/news/learning/types.ts`, and `src/news/surveillance/types.ts`.

---

## 1. Schema Hierarchy & Interface Integrity

```
NewsArticle (Raw / Normalized)
    │
    ▼
EventIntelligence (Phase 11)
    ├── entityImpact: EntityImpactAnalysis
    ├── marketReaction: MultiWindowReaction
    ├── contradiction: ContradictionState
    └── transmissionScore: number (0–100)
    │
    ▼
StrategyCandidate (Phase 12)
    ├── templateId: StrategyTemplateType
    ├── legs: StrategyLeg[]
    ├── expectedValue: number
    ├── winRate: number
    └── robustnessScore: number (0–1)
    │
    ▼
PortfolioOrderIntent (Phase 13)
    ├── strategyCandidateId: string
    ├── allocatedCapital: number
    ├── portfolioImpact: PortfolioGreeksDelta
    └── riskGateApproved: boolean
    │
    ▼
ExecutionPlan & Order (Phase 14)
    ├── orderId: string
    ├── symbol: string
    ├── orderType: 'MARKET' | 'LIMIT' | 'SL-M'
    ├── legs: OrderLeg[]
    ├── status: OrderLifecycleState
    └── filledPrice?: number
    │
    ▼
TradeOutcome & Attribution (Phase 15-16)
    ├── tradeId: string
    ├── realizedPnL: number
    ├── attributionScore: number
    └── learnedEdgeDelta: number
```

---

## 2. API Version Compatibility & Migration Matrix

| API Route Group | Target Engine | Input Schema | Output Schema | Breaking Changes / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/market-data`** | Legacy Home Aggregator | None | `MarketDataResponse` | Backward compatible for Home page widgets. |
| **`/api/v3/news/*`** | NewsEngineV3 Core | `{ category, limit, page }` | `{ success: boolean, articles: NewsArticle[] }` | Replaced legacy v1/v2 unpaginated feeds. |
| **`/api/v4/news/*`** | Streaming & Realtime | None / Query | Server-Sent Events + JSON metrics | Feeds live connection status to header. |
| **`/api/v5/news/*`** | Trader Intelligence | `{ symbol, eventType }` | `TraderDossierResponse` | High-density financial metrics & reaction alignment. |
| **`/api/v5/market-intelligence/*`** | Quant & Portfolio OS | Signal IDs, Strategy IDs | Canonical Signals, Lifecycle, Outcomes | Pure deterministic JSON payloads with zero AI latency. |
| **`/api/v5/surveillance/*`** | Autonomous Surveillance | `{ timeframe, sector }` | `SurveillanceReportResponse` | Real-time multi-factor anomaly signals and shocks. |

---

## 3. Findings on Type Inconsistencies & Resolutions

1. **`NewsArticle` vs `CanonicalArticle`:**
   - In earlier phases (Phases 1-4), articles were typed with generic optional fields (`title`, `content`). In Phases 8-18, the canonical schema strictly mandates `headline`, `body`, `source`, `publishedAt`, `url`, `symbols`, `category`, and `confidence`.
   - `NewsNormalizer.ts` ensures all incoming raw inputs are transformed into the canonical type before crossing the pipeline boundary.
2. **Strategy Leg vs Execution Leg:**
   - `StrategyLeg` specifies mathematical instruments (`CALL`, `PUT`, `FUTURE`, `EQUITY`), strike price, expiry, and side (`BUY`/`SELL`).
   - `OrderLeg` translates this into broker-specific parameters (`tradingsymbol`, `exchange`, `product_type`, `validity`, `trigger_price`).
   - `OrderConstructionEngine` enforces rigorous 1-to-1 or 1-to-many translation without data loss.
3. **Execution Plan Option Spread Count:**
   - In multi-leg option spreads (e.g. Bull Call Spread), the construction engine builds 2 discrete legs (Long Lower Strike Call + Short Higher Strike Call). A unit test expectation in Phase 14 needed synchronization with the multi-leg payload parser.
