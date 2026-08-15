# ATHENA NewsEngineV3 — Performance Metrics & Failure Analytics

## Metrics Snapshot Fields
- `articlesPerHour`: Real-time processing throughput.
- `avgPipelineLatencyMs`: End-to-end pipeline latency.
- `avgCollectorLatencyMs`: RSS/HTML HTTP fetch latency.
- `avgQueueWaitTimeMs`: Time spent in `ArticleQueue`.
- `qualityGatePassRatePct`: Percentage of articles passing quality checks.
- `avgParserConfidencePct`: Average confidence of financial extraction.
- `memoryUsageMB`: Heap and RSS memory consumption.

---

## Failure Categories
1. `COLLECTOR_FAILURE`
2. `PARSER_FAILURE`
3. `AI_FAILURE`
4. `QUALITY_GATE_FAILURE`
5. `TELEGRAM_FAILURE`
6. `MEMORY_SYSTEM_FAILURE`
