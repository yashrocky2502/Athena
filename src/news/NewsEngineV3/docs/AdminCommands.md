# ATHENA NewsEngineV3 — Admin Command Reference

## Available Commands

| Command | Description | Example |
|---|---|---|
| `/status` | Engine overview & release status | `/status` |
| `/health` | Detailed system diagnostic | `/health` |
| `/queue` | Article queue metrics & pending list | `/queue` |
| `/collectors` | Collector health & circuit breaker state | `/collectors` |
| `/replay` | Replay article by ID or replay failed stories | `/replay RAW_ET_1001` or `/replay failed` |
| `/pause` | Pause specific collector polling | `/pause REUTERS` |
| `/resume` | Resume specific collector polling | `/resume REUTERS` |
| `/restart` | Re-initialize collector instance | `/restart REUTERS` |
| `/cache` | View deduplication cache utilization | `/cache` |
| `/memory` | Heap & RSS memory metrics | `/memory` |
| `/stats` | Real-time throughput & latency metrics | `/stats` |
| `/errors` | Ranked failure analytics report | `/errors` |
| `/logs` | Recent system log tail | `/logs` |
| `/help` | Show command menu | `/help` |
