/**
 * ATHENA NEWS ENGINE — STAGE 8.2B
 * TelegramQualityGate
 * 
 * Strict pre-dispatch quality gate for high-signal Telegram alerts.
 * Blocks any notification that fails accuracy, evidence, zero-fabrication, or anti-hallucination standards.
 */

import { TelegramEligibilityAssessment } from './TelegramAlertEligibilityEngine';
import { NewsArticle } from '../types/Article';

export interface QualityGateValidationResult {
  passed: boolean;
  failedChecks: string[];
  reasons: string[];
  sanitizedAssessment?: TelegramEligibilityAssessment;
}

export class TelegramQualityGate {
  private static recentAlertSignatures: Map<string, { timestamp: number; source: string; headline: string }> = new Map();

  /**
   * Clear in-memory deduplication cache (useful in tests)
   */
  public static clearHistory(): void {
    this.recentAlertSignatures.clear();
  }

  /**
   * Evaluates an assessment and underlying article against strict quality gates
   */
  public static validate(
    assessment: TelegramEligibilityAssessment,
    originalArticle: Partial<NewsArticle> & { headline: string; body?: string }
  ): QualityGateValidationResult {
    const failedChecks: string[] = [];
    const reasons: string[] = [];

    const headline = (originalArticle.headline || '').trim();
    const body = (originalArticle.body || '').trim();
    const summary = (assessment.executiveSummary || '').trim();
    const whyItMatters = (assessment.whyItMatters || '').trim();
    const traderRelevance = (assessment.traderRelevance || '').trim();

    // 1. Eligibility Check
    if (!assessment.isEligible) {
      failedChecks.push('ELIGIBILITY_FAILED');
      reasons.push(assessment.rejectionReason || 'Article does not meet minimum eligibility score threshold.');
    }

    // 1b. Urgency Gate: LOW urgency is feed-only
    if (assessment.urgency === 'LOW') {
      failedChecks.push('LOW_URGENCY_SUPPRESSED');
      reasons.push('LOW urgency alerts are restricted to Category Feed only.');
    }

    // 2. Non-empty Summary
    if (!summary || summary.length < 25) {
      failedChecks.push('EMPTY_OR_SHORT_SUMMARY');
      reasons.push('Executive summary is empty or too short (< 25 chars).');
    }

    // 3. Summary not verbatim headline
    if (summary.toLowerCase() === headline.toLowerCase() || (summary.length < headline.length + 10 && summary.toLowerCase().includes(headline.toLowerCase()))) {
      failedChecks.push('HEADLINE_AS_SUMMARY');
      reasons.push('Executive summary repeats the headline verbatim without synthesis.');
    }

    // 4. Meaningful, Non-Empty Why It Matters (Part E & F)
    if (!whyItMatters || whyItMatters.length < 20) {
      failedChecks.push('EMPTY_WHY_IT_MATTERS');
      reasons.push('"Why It Matters" must be concrete and at least 20 characters.');
    }

    const boilerplateWhyPhrases = [
      'routine operational disclosure',
      'favorable announcement for',
      'corporate development may impact sentiment',
      'investors should monitor the stock',
      'this could affect market participants'
    ];
    for (const phrase of boilerplateWhyPhrases) {
      if (whyItMatters.toLowerCase().includes(phrase)) {
        failedChecks.push('GENERIC_BOILERPLATE_REASONING');
        reasons.push(`"Why It Matters" contains forbidden boilerplate filler: "${phrase}".`);
      }
    }

    // 5. Anti-Guaranteed Returns / Compliant Language
    const forbiddenPhrases = [
      'guaranteed return', 'guaranteed profit', 'sure shot', 'multibagger guaranteed',
      'risk-free gain', '100% profit', 'can never go down'
    ];
    for (const phrase of forbiddenPhrases) {
      if (summary.toLowerCase().includes(phrase) || whyItMatters.toLowerCase().includes(phrase)) {
        failedChecks.push('NON_COMPLIANT_ADVISORY_LANGUAGE');
        reasons.push(`Contains unverified or prohibited claim: "${phrase}".`);
      }
    }

    // 6. F&O Metric Fabrication Check (Part H & I: Zero Fabrication)
    if (assessment.fnoEvidence && assessment.fnoEvidence.hasExplicitDerivativesData) {
      const text = `${headline} ${body}`.toLowerCase();
      if (assessment.fnoEvidence.oi && !text.includes('oi') && !text.includes('open interest')) {
        failedChecks.push('FABRICATED_FNO_METRIC');
        reasons.push('F&O open interest metric claims data not present in source text.');
      }
      if (assessment.fnoEvidence.pcr && !text.includes('pcr')) {
        failedChecks.push('FABRICATED_FNO_METRIC');
        reasons.push('F&O PCR metric claims data not present in source text.');
      }
      if (assessment.fnoEvidence.iv && !text.includes('iv') && !text.includes('volatility')) {
        failedChecks.push('FABRICATED_FNO_METRIC');
        reasons.push('F&O IV metric claims data not present in source text.');
      }
    }

    // 7. Brokerage-to-Ticker Contamination Check (Part M)
    const brokerageNames = ['MACQUARIE', 'GOLDMAN', 'MORGAN STANLEY', 'JEFFERIES', 'CLSA', 'CITI', 'UBS', 'NOMURA', 'MOTILAL OSWAL', 'SBI SECURITIES', 'KOTAK SECURITIES'];
    if (assessment.symbol && brokerageNames.some(b => assessment.symbol?.toUpperCase().includes(b))) {
      failedChecks.push('BROKERAGE_TICKER_CONTAMINATION');
      reasons.push(`Brokerage name "${assessment.symbol}" was incorrectly assigned as the traded entity.`);
    }

    // 8. Deduplication / Syndicated Cluster Check (Part K)
    const signature = assessment.eventFingerprint || `${(assessment.symbol || assessment.companyName).toLowerCase().replace(/[^a-z0-9]/g, '')}_${assessment.eventType}_${headline.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const lastAlert = this.recentAlertSignatures.get(signature);
    const now = Date.now();
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    if (lastAlert && (now - lastAlert.timestamp) < TWELVE_HOURS) {
      const incomingId = (originalArticle as any)?.id;
      // If it's a different article with the same signature, suppress duplicate.
      // If it is the exact same article retrying dispatch, do not block.
      if (!incomingId || !(lastAlert as any).articleId || incomingId !== (lastAlert as any).articleId) {
        failedChecks.push('DUPLICATE_ALERT_SUPPRESSED');
        reasons.push(`Duplicate alert for ${assessment.companyName} (${assessment.eventType}) already dispatched via ${lastAlert.source} within 12 hours.`);
      }
    }

    // 9. Source Availability
    if (!assessment.sources || assessment.sources.length === 0 || assessment.sources[0].trim() === '') {
      failedChecks.push('MISSING_SOURCE');
      reasons.push('No verified news source or publisher attributed to this notification.');
    }

    // 10. Trader Relevance Validation
    if (!traderRelevance || traderRelevance.length < 5 || traderRelevance === 'No Clear Beneficiary') {
      failedChecks.push('MISSING_TRADER_RELEVANCE');
      reasons.push('Trader relevance must explicitly identify target market participants.');
    }

    const passed = failedChecks.length === 0;

    if (passed) {
      const publisher = assessment.sources && assessment.sources.length > 0 ? assessment.sources[0] : 'Unknown';
      this.recentAlertSignatures.set(signature, { 
        timestamp: now, 
        source: publisher, 
        headline,
        articleId: (originalArticle as any)?.id 
      } as any);
    }

    return {
      passed,
      failedChecks,
      reasons,
      sanitizedAssessment: passed ? assessment : undefined
    };
  }
}
