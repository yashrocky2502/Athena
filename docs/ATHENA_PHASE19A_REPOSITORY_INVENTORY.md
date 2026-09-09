# ATHENA — PHASE 19A.1
# Comprehensive Repository Inventory & Codebase Forensics

**Audit Timestamp:** 2026-08-30
**Engine Status:** Post-Phase 18 Autonomous Surveillance Integration
**Target Systems:** Ingestion, Processing, Intelligence OS, Quant, Portfolio, Execution, Learning, Surveillance, UI, Telemetry, and API Layers

---

## 1. Executive Codebase Summary

| Subsystem / Layer | Directory Path | Core Responsibilities | File Count | Approx LOC | Real vs Mock Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Unified Orchestration & OS (Phase 17)** | `src/news/intelligence/` | `AthenaOrchestrator`, `AthenaEventBus`, `EventStateMachine`, `ConfidencePropagation` | 42 files | ~18,500 | Fully integrated deterministic bus & pipeline graph |
| **Market Surveillance Engine (Phase 18)** | `src/news/surveillance/` | Real-time multi-factor anomaly detection, cross-asset shock, options microstructure, noise filtering | 16 files | ~4,200 | Deterministic mathematical scoring with live bus integration |
| **Event-to-Signal Transmission (Phase 11)** | `src/news/intelligence/` | Entity resolver, reaction confirmation, multi-window measurement, transmission graphs | Shared (Phase 11-17) | ~6,800 | Deterministic scoring; feeds into Phase 12 candidate generation |
| **Quant Strategy Intelligence (Phase 12)** | `src/news/quant/` | Strategy candidates, expected value, historical analogues, robustness, backtest runner | 10 files | ~6,500 | Rule-based template engines; deterministic mathematical models |
| **Portfolio Intelligence (Phase 13)** | `src/news/portfolio/` | Greeks, concentration, exposure, capital allocator, stress engine, regime gate | 14 files | ~7,200 | Mathematical portfolio risk formulas; paper/model portfolio bindings |
| **Execution Intelligence (Phase 14)** | `src/news/execution/` | Order construction, slippage engine, kill switch, pre-trade risk, broker adapters (Paper, Zerodha, Binance) | 18 files | ~8,400 | Paper execution active; live Zerodha/Binance adapters have simulated/mock endpoints |
| **Closed-Loop Learning & Evolution (Phases 15-16)** | `src/news/learning/` | Attribution, feedback, edge decay, regime transitions, strategy evolution, AI hypothesis engine | 24 files | ~9,600 | Closed-loop attribution deterministic; AI hypothesis engine uses Gemini via lazy init |
| **News Core & Ingestion (Phases 1-8)** | `src/newsCoreV2/`, `src/news/NewsEngine/`, `src/news/NewsEngineV3/` | Multi-source scrapers, RSS ingestion, canonical deduplication, AST parser, SEC/SEBI filing extractor | 68 files | ~32,000 | Multi-feed RSS and live scrapers; local file fallback and memory caches |
| **Telegram Notification & Formatter (Phases 8-10)** | `src/news/telegram/`, `src/news/NewsEngine/` | Quality gate, alert eligibility, deterministic trader summaries, channel dispatchers | 8 files | ~4,800 | Telegram bot webhook/dispatch active with dry-run/mock fallback |
| **API & Server Layer** | `server.ts`, `src/news/routes/` | Express REST endpoints (v1-v5), SSE streams, health checks, background schedulers | 8 files | ~5,500 | Monolithic Express server binding port 3000 |
| **Frontend & Visualization** | `src/components/`, `src/components/news/`, `src/components/admin/` | CommandCenter, AthenaDashboard, Quant, Portfolio, Execution, ResearchEvolution, Admin panels | 54 files | ~26,000 | Complete React/Tailwind UI with zero console errors; responsive layout |

---

## 2. Directory-by-Directory Module Breakdown

### 2.1 `src/news/intelligence/` (Phases 11 & 17 Unified OS)
- **`AthenaOrchestrator.ts`** (22.8 KB): Central deterministic pipeline coordinator. Executes sequence: Ingestion → Deduplication → Entity Impact → Reaction Confirmation → Contradiction Filter → Transmission → Quant Candidate → Portfolio Gate → Execution Gate.
- **`AthenaEventBus.ts`** (4.6 KB): High-throughput typed in-memory publish-subscribe broker with Dead Letter Queue (DLQ), retry backoff, and event replay capabilities.
- **`DeterministicMarketReactionEngine.ts`** (10.8 KB): Computes exact multi-window price changes (1M, 5M, 15M, 30M, 1H, SESSION) and alignment scoring (CONFIRMED vs CONTRADICTED).
- **`AthenaContradictionEngine.ts`** (5.7 KB): Detects factual and market-action contradictions between news claims and quantitative price/volume/OI reality.
- **`ConfidencePropagationEngine.ts`** (5.1 KB): Propagates uncertainty penalties across evidence nodes using bayesian-decay trees.
- **`EventTransmissionGraph.ts`** (4.9 KB): Directed acyclic graph (DAG) representing causal lineage from article root to execution order.
- **`MarketIntelligenceFusionEngine.ts`** (33.7 KB): Synthesizes multi-source data (Equities, F&O, Macro, Filings) into actionable market intelligence dossiers.
- **`TraderDecisionEngine.ts`** (51.1 KB): High-density decision matrices calculating trader urgency, actionability, risk/reward, and execution horizons.

### 2.2 `src/news/surveillance/` (Phase 18 Autonomous Surveillance)
- **`MarketSurveillanceEngine.ts`** (8.5 KB): Primary coordinator for continuous real-time market surveillance.
- **`MultiFactorAnomalyEngine.ts`** (3.8 KB): Combines z-score deviations across Price (35%), Volume (25%), Open Interest (20%), and Implied Volatility (20%).
- **`CrossAssetShockEngine.ts`** (2.8 KB): Evaluates systemic cross-asset contagion (USDKRW/USDINR, Crude Oil, 10Y Yields, India VIX).
- **`OptionsMicrostructureEngine.ts`** (2.7 KB): Pinpoints abnormal put-call shifts, gamma flips, and IV skew inversions.
- **`NewsMarketMismatchEngine.ts`** (3.3 KB): Discovers divergence between bullish headlines and sharp sell-offs (or vice-versa).
- **`SurveillanceEventPublisher.ts`** (2.4 KB): Dispatches validated surveillance events directly into `AthenaEventBus` on `SURVEILLANCE_ANOMALY_DETECTED`.

### 2.3 `src/news/quant/` (Phase 12 Quant Strategy Intelligence)
- **`QuantStrategyIntelligenceEngine.ts`** (11.4 KB): Generates deterministic strategy candidates for validated events.
- **`StrategyTemplateSystem.ts`** (17.9 KB): Contains 12 canonical quantitative templates (Long Gamma Breakout, Volatility Crush Iron Condor, Mean Reversion Fade, Earnings Straddle, Momentum Trend Follow, etc.).
- **`StrategyBacktestEngine.ts`** (5.5 KB): Calculates historical win rates, profit factors, Sharpe ratios, and max drawdown curves using synthetic and historical market regimes.
- **`StrategyRobustnessEngine.ts`** (3.9 KB): Performs Monte Carlo slippage and parameter perturbation tests.
- **`StrategyRiskGate.ts`** (4.6 KB): Hard mathematical gate verifying EV > 0, Max Risk < Limit, and Slippage Buffer before promoting candidates.

### 2.4 `src/news/portfolio/` (Phase 13 Portfolio Intelligence)
- **`PortfolioDecisionEngine.ts`** (11.1 KB): Evaluates active candidate strategies against aggregate portfolio health.
- **`PortfolioGreeksEngine.ts`** (8.9 KB): Real-time portfolio-level Delta, Gamma, Theta, and Vega aggregation.
- **`PortfolioConcentrationEngine.ts`** (6.4 KB): Enforces single-symbol, sector, and asset class concentration boundaries.
- **`PortfolioStressEngine.ts`** (6.3 KB): Simulates historical stress scenarios (Covid March 2020, Lehman 2008, 2024 Election Vol Day).
- **`PortfolioRiskGate.ts`** (4.7 KB): Deterministic gate blocking trades that breach Drawdown limits, VaR limits, or Margin thresholds.

### 2.5 `src/news/execution/` (Phase 14 Execution Intelligence)
- **`ExecutionEngine.ts`** (8.9 KB): Manages life-cycle transitions of approved portfolio orders.
- **`OrderConstructionEngine.ts`** (6.7 KB): Constructs multi-leg execution plans with limit offsets, bracket orders, and slippage guards.
- **`ExecutionRiskGate.ts`** (4.3 KB): Final pre-trade check on kill-switch status, active trading hours, and capital availability.
- **`ExecutionKillSwitch.ts`** (2.6 KB): Global circuit breaker providing immediate system-wide execution freeze.
- **`PaperExecutionAdapter.ts`** (6.4 KB): High-fidelity simulated execution engine tracking filled quantity, realized slippage, and fees.
- **`ZerodhaExecutionAdapter.ts`** (2.9 KB) & **`BinanceExecutionAdapter.ts`** (2.3 KB): Production broker interface contracts with sandbox mock capabilities.

### 2.6 `src/news/learning/` (Phases 15-16 Learning & Evolution)
- **`ClosedLoopIntelligenceEngine.ts`** (6.5 KB): Post-trade attribution linking outcomes back to transmission scores and event catalysts.
- **`StrategyEvolutionEngine.ts`** (4.9 KB): Adapts strategy parameters, optimizes stop-loss multipliers, and decays unvalidated alpha edges.
- **`MarketRegimeDiscoveryEngine.ts`** (9.2 KB): Classifies macroeconomic regimes (BULL_TRENDING, BEAR_VOLATILE, RANGE_BOUND_COMPRESSION).
- **`ResearchHypothesisEngine.ts`** (7.9 KB): Utilizes Gemini 2.5/Flash for research hypothesis generation, strictly isolated behind `LearningSafetyGate`.

---

## 3. Key Findings on Missing, Duplicate, or Dead Code

1. **Test Runner Mismatch (Phases 11-13):**
   - Files `Phase11_EventToSignalTransmission.test.ts`, `Phase12_QuantStrategyIntelligence.test.ts`, and `Phase13_PortfolioIntelligence.test.ts` were written with standalone `runPhaseXXTests()` functions rather than standard vitest `describe() / it()` blocks. They run fine when called directly from the CLI or integration suites, but Vitest marks them as "No test suite found".
2. **Duplicate Summary Services:**
   - Both `src/news/NewsEngine/SummaryService.ts` (67 KB) and `src/newsCoreV2/summary/CanonicalNewsSummaryEngine.ts` exist. V3/V5 routes now correctly point to CanonicalNewsSummaryEngine, but the legacy SummaryService remains in the tree as a fallback.
3. **Execution Adapter Live Bindings:**
   - `ZerodhaExecutionAdapter` and `BinanceExecutionAdapter` have complete API schemas and mock handlers, but lack production OAuth exchange secrets (which is correct and expected for security).
