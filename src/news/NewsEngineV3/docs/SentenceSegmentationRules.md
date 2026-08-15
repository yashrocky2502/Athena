# ATHENA NEWS ENGINE V3 — SENTENCE SEGMENTATION RULES

## Protected Token Rules

`SentenceSegmenter` uses a two-pass tokenizer that masks periods inside financial terms before applying terminal sentence splitting rules.

### Protected Categories

1. **Currency Prefixes**:
   - `Rs.`, `rs.`, `RS.`
2. **Corporate Suffixes**:
   - `Ltd.`, `Inc.`, `Pvt.`, `Co.`, `Corp.`, `Bros.`, `Mfg.`
3. **Month Abbreviations**:
   - `Jan.`, `Feb.`, `Mar.`, `Apr.`, `Jun.`, `Jul.`, `Aug.`, `Sep.`, `Sept.`, `Oct.`, `Nov.`, `Dec.`
4. **Decimals & Metrics**:
   - Numbers with decimal points: `5.4%`, `Rs. 593.50 crore`
   - Quarters and Fiscal Years: `Q1 FY27`, `FY26`, `YoY`, `QoQ`, `MoM`
5. **Honorifics**:
   - `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Prof.`

## Splitting Boundary

Sentences are split on terminal punctuation marks (`.`, `!`, `?`) when followed by whitespace and an uppercase letter, quotation mark, currency symbol, or digit, after all protected tokens have been masked. Protected tokens are fully restored in the final `NormalizedSentence` objects.
