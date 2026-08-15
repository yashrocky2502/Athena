# ATHENA NewsEngineV3 — Replay Architecture

## Overview
The Replay Engine allows developers and operations engineers to re-run raw articles or failed stories through the ATHENA NewsEngineV3 pipeline to verify fixes, test parser improvements, or benchmark quality gate thresholds.

---

## 10-Stage Replay Execution Timeline

Every replayed article passes through the exact same 10 stages as live articles:

1. **COLLECTION**: Ingestion validation
2. **NORMALIZATION**: HTML stripping & canonical URL cleanup
3. **DEDUPLICATION**: URL & content hash checking
4. **CLASSIFICATION**: Article category detection
5. **SPECIALIZED_PARSING**: Specialized financial parser execution
6. **STRUCTURED_EXTRACTION**: PAT, Revenue, EBITDA metric extraction
7. **AI_INTELLIGENCE**: Institutional summary & market impact calculation
8. **QUALITY_GATE**: 100-point accuracy verification
9. **STORAGE**: Persistence layer validation
10. **TELEGRAM_PUBLISHING**: Non-blocking channel distribution simulation

---

## Usage

```typescript
import { ReplayEngine } from '../replay/ReplayEngine';

const replayEngine = ReplayEngine.getInstance();
const result = await replayEngine.replayArticle('RAW_ET_1001', 'Post-parser fix verification');
console.log(result.success, result.latencyMs);
```
