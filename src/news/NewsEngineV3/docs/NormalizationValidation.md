# ATHENA NEWS ENGINE V3 — NORMALIZATION VALIDATION RULES

## Quality Gate Criteria

The `NormalizerValidator` evaluates candidate documents against the following rules before allowing them to proceed to Phase 4 (Deduplication):

| Rule Code | Description | Severity | Target Threshold |
| :--- | :--- | :--- | :--- |
| `CRITICAL_MISSING_TITLE` | Article title must be non-empty | Critical Rejection | Non-empty string |
| `CRITICAL_MISSING_PUBLISHER` | Publisher name must be identified | Critical Rejection | Non-empty string |
| `CRITICAL_INSUFFICIENT_PARAGRAPHS` | Document must contain paragraphs | Critical Rejection | `>= 1` paragraph |
| `CRITICAL_INSUFFICIENT_SENTENCES` | Document must contain full sentences | Critical Rejection | `>= 1` sentence |
| `CRITICAL_UNREADABLE_ENCODING` | Invalid byte sequences / replacement chars | Critical Rejection | `< 5%` corrupted chars |
| `HIGH_NOISE_RATIO` | Excessive navigation or ad content | Warning | `< 40%` noise stripped |

## Error Routing

- **Validation Success**: Document is published to Phase 4; Developer Telegram channel receives summary metrics.
- **Validation Failure**: Article is halted; Operations Telegram channel receives immediate alert with failure reasons.
