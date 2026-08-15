# ATHENA NewsEngineV3 — Human Review Queue

## Flagging Triggers
Articles are automatically enqueued for human review under any of the following conditions:
1. `LOW_PARSER_CONFIDENCE`: Parser confidence score < 85%.
2. `QUALITY_GATE_WARNING`: Soft quality gate warning.
3. `METRIC_CONFLICT`: Financial metric comparison ambiguity (e.g. QoQ vs YoY mismatch).
4. `QUOTE_CONFLICT`: Speaker attribution uncertainty.
5. `DUPLICATE_UNCERTAINTY`: Partial headline match with different metrics.

---

## Reviewer Actions
- `APPROVE`: Override warning and publish story.
- `REJECT`: Mark story invalid and archive.
- `CORRECT`: Provide corrected financial metrics or classifications.
- `REPLAY`: Re-trigger pipeline execution.
