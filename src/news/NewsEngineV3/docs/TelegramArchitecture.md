# ATHENA NewsEngineV3 — Telegram Observer & Observability Architecture

## Overview
The Telegram subsystem in NewsEngineV3 acts strictly as a non-blocking observer. It monitors system health, pipeline progress, and collector status without interfering with article ingestion or queue processing.

---

## Fail-Safe Guarantees

1. **Complete Non-Blocking Isolation**:
   - Asynchronous event bus subscriptions decouple Telegram API calls from the main thread.
   - Network timeouts, HTTP errors, invalid credentials, or rate limits from Telegram will **NEVER** throw exceptions back into collectors or queue routines.

2. **Command Handler Capabilities**:
   Supports operational commands via Telegram bot interface:
   - `/status`: System health, version, uptime, memory, queue length.
   - `/collectors`: Health status, latency, articles fetched, circuit breaker state.
   - `/queue`: Pending and processing queue metrics and top pending items.
   - `/pause <COLLECTOR_NAME>`: Pause polling for a specific collector.
   - `/resume <COLLECTOR_NAME>`: Resume polling for a specific collector.
   - `/restart <COLLECTOR_NAME>`: Perform clean restart of a collector.
   - `/logs`: Tail recent structured system log entries.
   - `/health`: Detailed diagnostic breakdown.

---

## Message Formatting
Uses `TelegramMessageFormatter` to convert pipeline events into clean, readable Markdown/HTML cards with source links, timestamps, and status emojis.
