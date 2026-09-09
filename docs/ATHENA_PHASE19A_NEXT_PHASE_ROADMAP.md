# ATHENA — PHASE 19A.20
# Next-Phase Architectural Roadmap & Remediation Plan

**Audit Timestamp:** 2026-08-30
**Target Horizons:** Phase 19B (Architectural Hardening & Test Modernization), Phase 20 (Multi-Broker Production Order Routing), and Phase 21 (Institutional Alpha Research Lab).

---

## 1. Prioritized Remediation Roadmap

```
┌────────────────────────────────────────────────────────┐
│                      PHASE 19B                         │
│  Architectural Hardening & Test Harness Modernization   │
│  - Wrap Phase 11-13 tests in native Vitest runners     │
│  - Deprecate legacy SummaryService in favor of V2/V3   │
│  - Enhance OrderConstructionEngine spread assertions   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      PHASE 20                          │
│     Multi-Broker Production Routing & Smart DMA        │
│  - Live Zerodha KiteConnect / Binance API key vault    │
│  - Direct Market Access (DMA) Smart Order Routing      │
│  - Real-time exchange WebSocket tick parser            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                      PHASE 21                          │
│     Institutional Alpha & Macro Regime Research Lab    │
│  - Deep Historical Backtest Dataset Replay             │
│  - Cross-Asset Macro Contagion Clustering              │
│  - Autonomous Strategy Gene Pool Evolution             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Phase Action Items

### Phase 19B: Immediate Codebase Cleanliness & Test Modernization
1. **Vitest Harness Standardization:**
   - Convert `runPhase11Tests()`, `runPhase12Tests()`, and `runPhase13Tests()` into standard Vitest `describe()` and `it()` suites.
2. **Order Construction Spread Leg Synchronization:**
   - Synchronize unit test assertions in `Phase14_ExecutionIntelligence.test.ts` for option spreads to match the 2-leg structure.
3. **Dead Code Pruning:**
   - Safely prune obsolete legacy scrapers and summary files without breaking backward compatibility.

### Phase 20: Production Broker Routing & Smart Direct Market Access (DMA)
1. **Interactive Key Vault:**
   - Allow institutional users to securely enter their broker API keys and TOTP tokens in settings with client-side encrypted storage.
2. **Smart Order Routing (SOR):**
   - Route orders across exchanges (NSE vs BSE for equities) based on best bid/offer and liquidity depth.
3. **Automated Trade Reconciliation:**
   - Continuous real-time reconciliation loop comparing broker account order book with Athena internal state.

### Phase 21: Autonomous Alpha Gene Pool & Regime Lab
1. **Strategy Gene Splicing:**
   - Evolve new strategy templates by combining parameter genes (e.g. Trend Filter + Volatility Squeeze + Trailing ATR Exit).
2. **Macro Contagion Matrix:**
   - Deep correlation mapping between global bond yields, currency pairs (USD/INR, DXY), commodities (Crude, Gold), and Indian equity sectors.
