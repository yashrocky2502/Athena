/**
 * ATHENA NEWS ENGINE V3 — BASE FINANCIAL PARSER
 *
 * Base class for all Phase 6 Institutional Grade Financial Parsers.
 * Purely deterministic, rule-based numeric & entity extraction.
 * No AI. No LLM. No placeholder values.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import {
  StructuredExtraction,
  ExtractedMetric,
  ExtractedEntity,
  ExtractedQuote,
  BusinessEvent,
  ExtractedDate,
  MetricTraceability,
  ExtractionValidation
} from './types/ParserTypes';
import { ParserTelemetryRepository } from './ParserTelemetryRepository';
import { TelegramMultiChannelRouter } from '../distribution/telegram/TelegramMultiChannelRouter';

export abstract class BaseFinancialParser {
  public abstract readonly parserType: string;

  /**
   * Main entry point for document parsing
   */
  public async parse(
    doc: NormalizedDocument,
    classification?: ClassificationResult
  ): Promise<StructuredExtraction> {
    const startTime = performance.now();

    try {
      // Perform primary extraction
      const rawResult = await this.executeParsing(doc, classification);

      // Filter & validate metrics strictly
      const validatedMetrics = this.validateAndCleanMetrics(rawResult.metrics);

      // Build metric traceability list
      const traceability: MetricTraceability[] = validatedMetrics.map((m) => ({
        paragraphIndex: m.paragraphIndex,
        sentenceIndex: m.sentenceIndex,
        sourceSentence: m.sourceSentence,
        characterOffset: m.characterOffset
      }));

      // Perform overall extraction validation
      const validation = this.validateExtraction(validatedMetrics, rawResult);

      // Compute deterministic confidence score
      const overallConfidence = this.calculateConfidence(validatedMetrics, validation);

      const processingTimeMs = Math.max(0.1, Math.round((performance.now() - startTime) * 100) / 100);

      const extraction: StructuredExtraction = {
        articleId: doc.documentId,
        parserType: this.parserType,
        company: classification?.resolvedCompany?.name || doc.companies[0]?.name || undefined,
        ticker: classification?.resolvedCompany?.ticker || doc.companies[0]?.ticker || undefined,
        category: classification?.primaryCategory || 'GENERAL_MARKET',
        metrics: validatedMetrics,
        entities: rawResult.entities,
        quotes: rawResult.quotes,
        businessEvents: rawResult.businessEvents,
        dates: rawResult.dates,
        currencies: this.extractCurrencies(doc),
        summaryFacts: rawResult.summaryFacts,
        confidence: overallConfidence,
        processingTimeMs,
        traceability,
        validation,
        specificFields: rawResult.specificFields
      };

      // Record successful run in Telemetry Repository
      ParserTelemetryRepository.getInstance().recordSuccess(doc, extraction);

      // Trigger Telegram dispatches asynchronously
      this.notifyDeveloperChannel(extraction);

      if (validation.warnings.length > 0 || !validation.isValid) {
        this.notifyOperationsChannel(extraction, 'VALIDATION_WARNING');
      }

      return extraction;
    } catch (error) {
      const processingTimeMs = Math.max(0.1, Math.round((performance.now() - startTime) * 100) / 100);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Record hard crash
      ParserTelemetryRepository.getInstance().recordFailure(this.parserType, errorMsg);

      // Dispatch Telegram crash alerts to both channels
      this.notifyDeveloperChannelFailure(doc, classification, errorMsg, processingTimeMs);
      this.notifyOperationsChannelFailure(doc, classification, errorMsg);

      throw error;
    }
  }

  private notifyDeveloperChannel(ext: StructuredExtraction): void {
    const router = TelegramMultiChannelRouter.getInstance();
    router.sendToChannel('DEVELOPERS', {
      title: `Parser Completion Alert — ${ext.parserType}`,
      type: 'PARSER_COMPLETION',
      priority: 'NORMAL',
      message: [
        `• *Parser:* ${ext.parserType}`,
        `• *Company:* ${ext.company || 'N/A'} [${ext.ticker || 'N/A'}]`,
        `• *Category:* ${ext.category}`,
        `• *Metrics Extracted:* ${ext.metrics.length}`,
        `• *Confidence:* ${ext.confidence}%`,
        `• *Latency:* ${ext.processingTimeMs} ms`
      ].join('\n')
    }).catch(() => {});
  }

  private notifyOperationsChannel(ext: StructuredExtraction, type: 'VALIDATION_WARNING' | 'PARSER_FAILURE'): void {
    const router = TelegramMultiChannelRouter.getInstance();
    router.sendToChannel('OPERATIONS', {
      title: `Parser Quality/Failure Alert — ${ext.parserType}`,
      type,
      priority: 'HIGH',
      message: [
        `• *Parser:* ${ext.parserType}`,
        `• *Alert Type:* ${type}`,
        `• *Company:* ${ext.company || 'N/A'}`,
        `• *Validation Valid:* ${ext.validation.isValid}`,
        `• *Warnings:*`,
        ext.validation.warnings.map((w) => `  - ${w}`).join('\n') || '  - None',
        `• *Errors:*`,
        ext.validation.errors.map((e) => `  - ${e}`).join('\n') || '  - None'
      ].join('\n')
    }).catch(() => {});
  }

  private notifyDeveloperChannelFailure(
    doc: NormalizedDocument,
    classification: ClassificationResult | undefined,
    errorMsg: string,
    latencyMs: number
  ): void {
    const router = TelegramMultiChannelRouter.getInstance();
    router.sendToChannel('DEVELOPERS', {
      title: `Parser CRASH Alert — ${this.parserType}`,
      type: 'PARSER_CRASH',
      priority: 'CRITICAL',
      message: [
        `• *Parser:* ${this.parserType}`,
        `• *Company:* ${classification?.resolvedCompany?.name || doc.companies[0]?.name || 'Unknown'}`,
        `• *Error:* \`${errorMsg}\``,
        `• *Latency:* ${latencyMs} ms`
      ].join('\n')
    }).catch(() => {});
  }

  private notifyOperationsChannelFailure(
    doc: NormalizedDocument,
    classification: ClassificationResult | undefined,
    errorMsg: string
  ): void {
    const router = TelegramMultiChannelRouter.getInstance();
    router.sendToChannel('OPERATIONS', {
      title: `Parser CRASH Alert — ${this.parserType}`,
      type: 'PARSER_CRASH',
      priority: 'CRITICAL',
      message: [
        `• *Parser:* ${this.parserType}`,
        `• *Company:* ${classification?.resolvedCompany?.name || doc.companies[0]?.name || 'Unknown'}`,
        `• *Error:* \`${errorMsg}\``,
        `• *Action:* Auto-flagged for human review & developer triage`
      ].join('\n')
    }).catch(() => {});
  }

  /**
   * Abstract method to be implemented by child parsers
   */
  protected abstract executeParsing(
    doc: NormalizedDocument,
    classification?: ClassificationResult
  ): Promise<{
    metrics: ExtractedMetric[];
    entities: ExtractedEntity[];
    quotes: ExtractedQuote[];
    businessEvents: BusinessEvent[];
    dates: ExtractedDate[];
    summaryFacts: string[];
    specificFields?: Record<string, any>;
  }>;

  // ==========================================
  // HELPER EXTRACTION METHODS (DETERMINISTIC)
  // ==========================================

  /**
   * Searches document paragraphs & sentences for keywords and extracts associated metric values
   */
  protected extractMetricByKeywords(
    doc: NormalizedDocument,
    metricName: string,
    keywords: string[],
    unitDefault: string = 'crore'
  ): ExtractedMetric | null {
    if (!doc.sentences || doc.sentences.length === 0) {
      return null;
    }

    for (const sentenceObj of doc.sentences) {
      const lowerText = sentenceObj.text.toLowerCase();
      const hasKeyword = keywords.some((kw) => lowerText.includes(kw.toLowerCase()));

      if (hasKeyword) {
        const extracted = this.extractNumericWithUnitAndContext(sentenceObj.text);
        if (extracted && extracted.value !== null && !isNaN(Number(extracted.value))) {
          const yoyQoq = this.extractYoYQoQ(sentenceObj.text);

          return {
            metricName,
            value: extracted.value,
            unit: extracted.unit || unitDefault,
            currency: extracted.currency || 'INR',
            YoY: yoyQoq.YoY,
            QoQ: yoyQoq.QoQ,
            previousValue: yoyQoq.previousValue,
            confidence: 95,
            sourceSentence: sentenceObj.text,
            paragraphIndex: sentenceObj.paragraphIndex,
            sentenceIndex: sentenceObj.indexInParagraph,
            characterOffset: 0
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract numbers with currency/unit context (e.g., "Rs 1,234.56 crore", "15.4%", "$500 million")
   */
  protected extractNumericWithUnitAndContext(
    text: string
  ): { value: number | null; unit: string; currency: string } | null {
    // Regex for numbers with unit (crore, lakh, billion, million, percent, etc.)
    const numberRegex =
      /(?:(?:rs\.?|inr|₹|\$|usd|eur|gbp)\s*)?([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|lakhs|billion|b|million|m|trillion|percent|%|bps|per share|rs|inr)?/i;

    const match = text.match(numberRegex);
    if (!match) return null;

    const rawNumStr = match[1].replace(/,/g, '');
    const val = parseFloat(rawNumStr);

    if (isNaN(val)) return null;

    let unit = (match[2] || '').toLowerCase();
    if (unit === 'cr') unit = 'crore';
    if (unit === 'lakhs') unit = 'lakh';
    if (unit === 'b') unit = 'billion';
    if (unit === 'm') unit = 'million';
    if (unit === '%') unit = 'percent';

    let currency = 'INR';
    if (text.includes('$') || /usd/i.test(text)) currency = 'USD';
    if (text.includes('€') || /eur/i.test(text)) currency = 'EUR';
    if (text.includes('£') || /gbp/i.test(text)) currency = 'GBP';

    return { value: val, unit: unit || 'units', currency };
  }

  /**
   * Extract YoY and QoQ comparisons from text
   */
  protected extractYoYQoQ(
    text: string
  ): { YoY: number | null; QoQ: number | null; previousValue: number | null } {
    let YoY: number | null = null;
    let QoQ: number | null = null;
    let previousValue: number | null = null;

    // YoY Match
    const yoyRegex =
      /(?:up|down|rose|fell|grew|declined|surged|dropped|jumped|increased|decreased|growth of)?\s*([\d.]+)\s*%\s*(?:y-o-y|yoy|year-on-year|year on year)/i;
    const yoyMatch = text.match(yoyRegex);
    if (yoyMatch) {
      let val = parseFloat(yoyMatch[1]);
      if (/down|fell|declined|dropped|decreased/i.test(text)) {
        val = -Math.abs(val);
      }
      YoY = val;
    }

    // QoQ Match
    const qoqRegex =
      /(?:up|down|rose|fell|grew|declined|surged|dropped|jumped|increased|decreased|growth of)?\s*([\d.]+)\s*%\s*(?:q-o-q|qoq|quarter-on-quarter|quarter on quarter)/i;
    const qoqMatch = text.match(qoqRegex);
    if (qoqMatch) {
      let val = parseFloat(qoqMatch[1]);
      if (/down|fell|declined|dropped|decreased/i.test(text)) {
        val = -Math.abs(val);
      }
      QoQ = val;
    }

    // Previous value match (e.g., "vs Rs 120 crore in Q1")
    const prevRegex = /(?:vs|against|compared to|from)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i;
    const prevMatch = text.match(prevRegex);
    if (prevMatch) {
      previousValue = parseFloat(prevMatch[1].replace(/,/g, ''));
    }

    return { YoY, QoQ, previousValue };
  }

  /**
   * Extract Date strings with labels (e.g., Record Date: Aug 15, 2026)
   */
  protected extractDates(doc: NormalizedDocument): ExtractedDate[] {
    const dates: ExtractedDate[] = [];
    if (!doc.sentences) return dates;

    const dateRegex =
      /(record date|ex-date|ex date|effective date|listing date|closure date|board meeting date|payment date)(?:\s*:\s*|\s+is\s+)([a-zA-Z0-9\s,/-]+)/i;

    for (const s of doc.sentences) {
      const match = s.text.match(dateRegex);
      if (match) {
        dates.push({
          label: match[1].trim(),
          date: match[2].trim(),
          sourceSentence: s.text
        });
      }
    }

    return dates;
  }

  /**
   * Extract Executive Quotes from text
   */
  protected extractQuotes(doc: NormalizedDocument): ExtractedQuote[] {
    const quotes: ExtractedQuote[] = [];
    if (!doc.sentences) return quotes;

    const quoteRegex = /"([^"]+)"\s*,?\s*said\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s*,\s*([^.]+))?/i;

    for (const s of doc.sentences) {
      const match = s.text.match(quoteRegex);
      if (match) {
        quotes.push({
          speaker: match[2].trim(),
          designation: match[3] ? match[3].trim() : undefined,
          quoteText: match[1].trim(),
          paragraphIndex: s.paragraphIndex,
          sentenceIndex: s.indexInParagraph
        });
      }
    }

    return quotes;
  }

  /**
   * Extract unique currencies mentioned in document
   */
  protected extractCurrencies(doc: NormalizedDocument): string[] {
    const currencies = new Set<string>();
    const text = doc.plainText || '';

    if (/rs\.?|inr|₹|crore|lakh/i.test(text)) currencies.add('INR');
    if (/\$|usd|dollar/i.test(text)) currencies.add('USD');
    if (/€|eur|euro/i.test(text)) currencies.add('EUR');
    if (/£|gbp|pound/i.test(text)) currencies.add('GBP');
    if (/¥|jpy|yen/i.test(text)) currencies.add('JPY');

    return Array.from(currencies);
  }

  /**
   * Validate & Clean Extracted Metrics strictly against AI Slop & invalid entries
   */
  protected validateAndCleanMetrics(metrics: ExtractedMetric[]): ExtractedMetric[] {
    const validMetrics: ExtractedMetric[] = [];
    const seenMetricNames = new Set<string>();

    for (const metric of metrics) {
      // Rule 1: No NaN or undefined values
      if (metric.value === undefined || metric.value === null || Number.isNaN(metric.value)) {
        continue;
      }

      // Rule 2: No raw placeholder string metrics without numeric values
      if (typeof metric.value === 'string') {
        const valStr = (metric.value as string).trim();
        if (
          valStr === '' ||
          /^(n\/a|tbd|unknown|null|placeholder|undefined|xx|--)$/i.test(valStr) ||
          /^(rs\.?|₹|crore|million|lakh)$/i.test(valStr)
        ) {
          continue;
        }
      }

      // Rule 3: Deduplicate metric names (keep highest confidence or first)
      if (seenMetricNames.has(metric.metricName.toUpperCase())) {
        continue;
      }

      seenMetricNames.add(metric.metricName.toUpperCase());
      validMetrics.push(metric);
    }

    return validMetrics;
  }

  /**
   * Validate extraction results and produce clear diagnostics
   */
  protected validateExtraction(
    metrics: ExtractedMetric[],
    result: { specificFields?: Record<string, any> }
  ): ExtractionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (metrics.length === 0 && !result.specificFields) {
      warnings.push('No numeric financial metrics extracted from document');
    }

    for (const m of metrics) {
      if (m.confidence < 50) {
        warnings.push(`Low confidence metric: ${m.metricName} (${m.confidence}%)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate overall parser confidence score (0 - 100)
   */
  protected calculateConfidence(
    metrics: ExtractedMetric[],
    validation: ExtractionValidation
  ): number {
    if (!validation.isValid) return 0;
    if (metrics.length === 0) return 40;

    const totalConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0);
    const avgConfidence = Math.round(totalConfidence / metrics.length);

    // Apply small penalty for warnings
    const warningPenalty = Math.min(20, validation.warnings.length * 5);

    return Math.max(10, Math.min(100, avgConfidence - warningPenalty));
  }
}
