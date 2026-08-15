# ATHENA NewsEngineV3 — Collector Health Specification

## Health Metrics Schema

Every collector exports a `V3CollectorHealthMetrics` payload:

| Metric Field | Type | Description |
| :--- | :--- | :--- |
| `collectorId` | `V3PublisherId` | Unique publisher identifier (e.g. `REUTERS`) |
| `name` | `string` | Human-readable collector title |
| `state` | `V3CollectorState` | `STARTING` \| `RUNNING` \| `RETRYING` \| `PAUSED` \| `FAILED` \| `OFFLINE` |
| `lastFetchAt` | `string (ISO)` | Timestamp of last successful or attempted fetch |
| `totalArticlesFetched` | `number` | Cumulative valid articles collected |
| `totalFetchAttempts` | `number` | Cumulative fetch executions |
| `consecutiveFailures` | `number` | Current streak of unhandled fetch failures |
| `circuitBreakerOpen` | `boolean` | `true` if circuit breaker is tripped |
| `avgLatencyMs` | `number` | Rolling average latency over last 50 fetches |
| `healthPercentage` | `number` | Calculated health score (0% to 100%) |
| `lastError` | `string?` | Error message from most recent failure |

---

## Health Percentage Formula
$$\text{Health\%} = \begin{cases} 0 & \text{if Circuit Breaker is OPEN} \\ \max\left(0, \min\left(100, \left\lfloor \frac{\text{Total Attempts} - \text{Consecutive Failures}}{\text{Total Attempts}} \times 100 \right\rfloor\right)\right) & \text{otherwise} \end{cases}$$
