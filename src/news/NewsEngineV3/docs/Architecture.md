# ATHENA NewsEngineV3 — System Architecture & Design Philosophy

## System Design Guiding Principles

1. **Strict Decoupling**: Each module in the processing pipeline communicates exclusively via standard event payloads or strongly typed interface signatures.
2. **Deterministic Extraction Before AI**: Raw articles pass through specialized parsers to extract hard metrics (numbers, tables, executive names) before being handed to LLM intelligence models.
3. **Zero Legacy Dependencies**: NewsEngineV3 does not import or share code with legacy engines.
4. **Resilience & Self-Healing**: Every network request, collector cycle, and event subscriber includes exponential backoff retries, circuit breakers, and backpressure telemetry.

---

## High-Level Data Pipeline Flow

```
[ Module 1: Collectors ] ──> (Raw Article)
                                 │
                                 ▼
[ Module 2: Normalization ] ──> (Clean Body & Content Hash)
                                 │
                                 ▼
[ Module 3: Deduplication ] ──> (Story Cluster Verification)
                                 │
                                 ▼
[ Module 4: Classifier ] ───> (Category & Type Routing)
                                 │
                                 ▼
[ Module 5: Specialized Parsers ] ──> (Quarterly, IPO, Macro, M&A)
                                 │
                                 ▼
[ Module 6: Structured Data ] ───> (JSON Financial Metrics & Quotes)
                                 │
                                 ▼
[ Module 7: AI Intelligence ] ───> (Institutional Summary & Impact)
                                 │
                                 ▼
[ Module 8: Quality Gate ] ─────> (Strict Rejection Rules)
                                 │
                                 ▼
[ Module 9: Storage Persistence ]
                                 │
                                 ▼
[ Module 10: Telegram Alerts ] ──> (Final Publisher Stage)
```

---

## Foundation Layer Architecture

### Event-Driven Backbone
All pipeline steps emit `V3PipelineEvent` records through `V3EventBus`. Handlers are processed asynchronously in priority order (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`).

### Storage & Caching Layer
Data storage is abstracted into 5 distinct repositories:
- `RawArticleRepository`
- `NormalizedRepository`
- `StructuredRepository`
- `IntelligenceRepository`
- `AuditRepository`

In Phase 1, the `InMemoryV3StorageAdapter` and `InMemoryV3Cache` act as the primary zero-dependency references for local execution and unit tests.

### Health & Telemetry
Every operation reports execution duration to `V3Telemetry`. Component health is aggregated into `V3HealthMonitor` to expose real-time diagnostic reports.
