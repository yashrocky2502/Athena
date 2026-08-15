# ATHENA NEWS ENGINE V3 — NORMALIZATION ARCHITECTURE

## Overview

The Universal Normalization Engine (Phase 3) is the deterministic transformation layer responsible for converting messy, multi-publisher raw HTML/unstructured news articles into pristine, structured, canonical `NormalizedDocument` objects.

## Core Guarantees

1. **Zero AI Dependency**: Complete absence of LLM calls or probabilistic models in normalization.
2. **100% Deterministic Execution**: Identical inputs produce identical outputs with matching hashes.
3. **High Throughput & Low Latency**: Processing time under 100ms per article.
4. **Sentence & Paragraph Integrity**: Preserves financial metrics, decimal values, and corporate abbreviations (`Rs.`, `Co. Ltd.`, `Q1 FY27`, `5.4%`).
5. **Observability Integration**: Publishes event progress and notifications via `NotificationHub` and `V3EventBus`.

## Module Layout

```
src/news/NewsEngineV3/normalization/
├── NormalizationEngine.ts      # Main pipeline orchestrator
├── HtmlCleaner.ts              # HTML tag stripper & block boundary parser
├── UnicodeNormalizer.ts        # Quote, dash, space, & character normalizer
├── BoilerplateRemover.ts       # Copyright, footer, & disclaimers remover
├── NoiseRemovalEngine.ts       # "Read More", "Live Updates", ad remover
├── ParagraphBuilder.ts         # Logical paragraph boundary detector
├── SentenceSegmenter.ts        # Financial-grade sentence tokenizer
├── MetadataExtractor.ts        # Publisher, author, title, url metadata builder
├── CompanyDetector.ts          # BSE/NSE ticker & company matcher
├── CurrencyNormalizer.ts       # INR/USD/EUR Crore/Million metric standardizer
├── DateNormalizer.ts           # ISO-8601 date converter & IST timezone handler
├── LanguageDetector.ts         # Script-based language identifier
├── CanonicalUrlResolver.ts     # URL tracking parameter stripper
├── DocumentHasher.ts           # 64-bit deterministic hash generator
├── NormalizerValidator.ts      # Quality gate validator
└── types/
    └── NormalizationTypes.ts   # Core Phase 3 interfaces
```
