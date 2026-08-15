# ATHENA NewsEngineV3 — Foundation Module Responsibilities

| Module | Location | Primary Responsibility |
|---|---|---|
| **Universal Types** | `types/V3Types.ts` | Defines all system contracts: `V3RawArticle`, `V3NormalizedArticle`, `V3StructuredData`, `V3AIIntelligence`, `V3Story`, `V3PipelineEvent`, etc. |
| **Config Manager** | `config/V3Config.ts` | Centralizes timeouts, retries, collector rules, feature flags, and API keys. |
| **Structured Logger** | `logging/V3Logger.ts` | Handles JSON logging with correlation IDs, subscriber hooks, and log levels (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`). |
| **Telemetry Tracker** | `telemetry/V3Telemetry.ts` | Records CPU, heap memory usage, latency histograms, publish rates, and queue counts. |
| **Async Event Bus** | `events/V3EventBus.ts` | Priority-aware event emitter supporting retry policies, priority queues, and event history buffers. |
| **Storage Repositories** | `storage/V3StorageInterfaces.ts` | Defines repository interfaces and `InMemoryV3StorageAdapter` for complete storage layer decoupling. |
| **Cache Client** | `cache/V3CacheInterfaces.ts` | Interface contracts and `InMemoryV3Cache` implementation for key-value caching and TTL management. |
| **Health Monitor** | `monitoring/V3HealthMonitor.ts` | Aggregates operational state reports for every module into a system health report. |
| **Utilities** | `utils/V3Utils.ts` | Provides non-cryptographic content hashing, UUID generation, text sanitization, and exponential backoff calculations. |
| **Master Orchestrator**| `core/NewsEngineV3.ts` | Lifecycle management, dependency injection, startup, shutdown, and event registration. |
| **Unit Test Suite** | `tests/V3Foundation.test.ts` | Unit tests for all Phase 1 components. |
