# ATHENA — PHASE 19A.3
# Event-Bus & Event-Flow Forensic Architecture Map

**Audit Timestamp:** 2026-08-30
**Core Engine:** `AthenaEventBus` (`src/news/intelligence/AthenaEventBus.ts`) & `AthenaOrchestrator` (`src/news/intelligence/AthenaOrchestrator.ts`)

---

## 1. Complete Event Flow Topology

```
[External News RSS / Scraper / Survelliance]
                  │
                  ▼
         NEWS_INGESTED (Event)
                  │
                  ▼
       [AthenaOrchestrator]
                  │
                  ├──────────────────────────────┐
                  ▼                              ▼
        [EntityImpactResolver]        [ContradictionEngine]
                  │                              │
                  ▼                              ▼
        ENTITY_IMPACT_RESOLVED        CONTRADICTION_DETECTED
                  │                              │
                  ▼                              ▼
     [DeterministicMarketReaction]   [MarketConfirmationEngine]
                  │
                  ▼
         MARKET_REACTION_CONFIRMED / MARKET_REACTION_CONTRADICTED
                  │
                  ▼
      [EventToSignalTransmissionEngine]
                  │
                  ▼
         SIGNAL_GENERATED (Event)
                  │
                  ▼
     [QuantStrategyIntelligenceEngine]
                  │
                  ▼
      STRATEGY_CANDIDATE_CREATED (Event)
                  │
                  ▼
       [StrategyRiskGate (EV > 0, Robustness > 0.6)]
                  │
                  ▼
        STRATEGY_APPROVED (Event)
                  │
                  ▼
       [PortfolioDecisionEngine]
                  │
                  ▼
        [PortfolioRiskGate (VaR, Greeks, Concentration)]
                  │
                  ▼
        PORTFOLIO_ORDER_INTENT (Event)
                  │
                  ▼
      [OrderConstructionEngine & ExecutionRiskGate]
                  │
                  ▼
         ORDER_SUBMITTED (Event)
                  │
                  ▼
         [ExecutionAdapter (Paper / Zerodha / Binance)]
                  │
                  ▼
         ORDER_FILLED / ORDER_REJECTED (Event)
                  │
                  ▼
     [ClosedLoopIntelligenceEngine & Attribution]
                  │
                  ▼
         LEARNING_UPDATE_COMMITTED (Event)
```

---

## 2. Event Registry & Subscriber Mapping

| Event Name | Source Publisher | Primary Subscribers | Action Taken | Error Handling / Dead Letter Queue |
| :--- | :--- | :--- | :--- | :--- |
| `NEWS_INGESTED` | `FeedService`, `V3Phase2Collector` | `AthenaOrchestrator` | Resolves entities, measures reaction, checks contradictions | Retried up to 3 times, then pushed to DLQ |
| `SURVEILLANCE_ANOMALY_DETECTED` | `SurveillanceEventPublisher` | `AthenaOrchestrator` | Ingests market anomaly as high-priority intelligence event | Retried up to 3 times, then pushed to DLQ |
| `ENTITY_IMPACT_RESOLVED` | `AthenaOrchestrator` | `EventTransmissionGraph` | Appends entity node and sector linkages | In-memory synchronous log |
| `SIGNAL_GENERATED` | `EventToSignalTransmissionEngine` | `QuantStrategyIntelligenceEngine`, `TelegramPipeline` | Generates quantitative strategy candidates; formats Telegram preview | Validated by `SignalLifecycleEngine` |
| `STRATEGY_CANDIDATE_CREATED` | `QuantStrategyIntelligenceEngine` | `StrategyRiskGate` | Evaluates EV, win rate, and Monte Carlo robustness | Discarded if EV <= 0 |
| `STRATEGY_APPROVED` | `StrategyRiskGate` | `PortfolioDecisionEngine` | Slices strategy against portfolio capital, Greeks, and correlation | Dropped if portfolio exposure exceeded |
| `PORTFOLIO_ORDER_INTENT` | `PortfolioDecisionEngine` | `ExecutionEngine` | Constructs bracket order execution plan | Guarded by `ExecutionKillSwitch` |
| `ORDER_SUBMITTED` | `ExecutionEngine` | `ExecutionAdapter`, `ExecutionAuditTrail` | Dispatches order to broker adapter | Emits `ORDER_REJECTED` on validation failure |
| `ORDER_FILLED` | `ExecutionAdapter` | `TradeLifecycleEngine`, `PositionReconciliationEngine` | Updates active position portfolio and records fill price | Triggers reconciliation alert if out of sync |
| `POSITION_CLOSED` | `TradeLifecycleEngine` | `ClosedLoopIntelligenceEngine` | Computes realized PnL, slippage, and signal attribution | Emits `LEARNING_UPDATE_COMMITTED` |
| `LEARNING_UPDATE_COMMITTED` | `ClosedLoopIntelligenceEngine` | `StrategyEvolutionEngine`, `MarketMemoryEngine` | Updates strategy win rates, decays alpha weights | Persisted in memory and learning version store |

---

## 3. Forensic Health of the Event Bus

1. **Dead Letter Queue (DLQ):**
   - Tested and verified in `Phase17_UnifiedIntelligenceOS.test.ts`. Any subscriber throwing an unhandled exception is retried with exponential backoff (up to `maxRetries = 3`) before routing to the DLQ.
2. **Deterministic Replay:**
   - The bus logs all events in memory with an immutable event sequence ID and timestamp. `AthenaOrchestrator.replayPipeline(eventId)` allows exact step-by-step reconstruction of any historical event path.
3. **Missing Listeners Audit:**
   - All 18 registered canonical event types have at least one active subscriber. No events are emitted into a void.
