# ATHENA NewsEngineV3 — Notification Hub & Telegram Routing

## Overview
The `NotificationHub` acts as the single central message dispatcher in NewsEngineV3. No pipeline module communicates directly with Telegram or external webhooks.

---

## Routing Rules Table

| Notification Type | Min Priority | Channels |
|---|---|---|
| `PIPELINE` | LOW | DEVELOPERS |
| `COLLECTOR` | NORMAL | DEVELOPERS, OPERATIONS |
| `QUALITY` | NORMAL | OPERATIONS, DEVELOPERS |
| `SYSTEM` | NORMAL | OPERATIONS |
| `HEALTH` | HIGH | OPERATIONS |
| `SECURITY` | HIGH | OPERATIONS, DEVELOPERS |
| `AI` | NORMAL | DEVELOPERS |

---

## Non-Blocking Guarantee
All Telegram dispatches use a 4000ms AbortController timeout. If Telegram is slow or offline, the core pipeline continues without disruption.
