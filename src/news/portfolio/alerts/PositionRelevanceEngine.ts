/**
 * ATHENA — PHASE 10P-3: PERSONAL POSITION ALERT INTELLIGENCE
 * PositionRelevanceEngine.ts
 * 
 * Deterministic Relevance Engine that evaluates incoming News Core V2 events
 * against active user positions.
 * 
 * Strict Architectural Guarantees:
 * 1. Zero Generic Market Alerts: Only active user positions can trigger alerts.
 * 2. Strict Entity Matching: Exact ISIN, Symbol, Exchange:Symbol, or Entity token match.
 *    No fuzzy matching that could cross-contaminate unrelated companies.
 * 3. Fail-Closed Provenance Gate: Rejects synthetic, test, unverified, or publisher-less events.
 * 4. Closed Position Isolation: Historical/closed positions are never alert targets.
 * 5. Deterministic Materiality & Severity Rules: Rule-based, non-speculative classification.
 * 6. Read-Only Safety: No order placement or trading actions.
 */

import {
  NormalizedPosition,
  PositionSnapshot,
  PositionNewsEventInput,
  PositionRelevanceResult,
  PositionImpactType,
  PositionAlertSeverity,
  PositionAlertCandidate
} from './types.ts';

export class PositionRelevanceEngine {
  private static readonly MACRO_SYMBOLS = new Set([
    'NIFTY',
    'NIFTY50',
    'BANKNIFTY',
    'SENSEX',
    'CRUDE',
    'CRUDEOIL',
    'GOLD',
    'SILVER',
    'USDINR',
    'INR'
  ]);

  /**
   * Evaluates a single News Core event against current active positions.
   */
  public evaluateEvent(
    event: PositionNewsEventInput,
    positionsInput: NormalizedPosition[] | PositionSnapshot
  ): PositionRelevanceResult {
    // 1. Provenance Gate (Fail-Closed)
    const provenanceCheck = this.verifyProvenance(event);
    if (!provenanceCheck.valid) {
      return {
        decision: 'NO_POSITION_IMPACT',
        rejectionReason: provenanceCheck.reason
      };
    }

    // 2. Extract Active Positions
    const activePositions = this.extractActivePositions(positionsInput);
    if (activePositions.length === 0) {
      return {
        decision: 'NO_POSITION_IMPACT',
        rejectionReason: 'NO_ACTIVE_POSITIONS'
      };
    }

    // 3. Match Event to Active Position
    const matchResult = this.findMatchingPosition(event, activePositions);
    if (!matchResult.matchedPosition) {
      return {
        decision: 'NO_POSITION_IMPACT',
        rejectionReason: matchResult.reason || 'NO_MATCHING_ACTIVE_POSITION'
      };
    }

    const position = matchResult.matchedPosition;

    // 4. Deterministic Materiality & Impact Classification
    const classification = this.classifyMateriality(event, position);
    if (!classification.isMaterial) {
      return {
        decision: 'NO_POSITION_IMPACT',
        positionId: position.positionId,
        symbol: position.symbol,
        rejectionReason: classification.rejectionReason || 'EVENT_NOT_MATERIAL'
      };
    }

    // 5. Build Alert Candidate
    const now = new Date().toISOString();
    const alertId = `ALT_REL_${position.positionId}_${event.id}_${Date.now()}`;
    const dedupeKey = `dedupe::pos_rel::${position.positionId}::${event.id}::${classification.impactType}::${classification.severity}`;

    const candidate: PositionAlertCandidate = {
      alertId,
      positionId: position.positionId,
      symbol: position.symbol,
      alertType: classification.impactType,
      severity: classification.severity,
      reason: `Position Intelligence [${position.symbol}]: ${event.headline}`,
      timestamp: event.publishedAt || now,
      marketData: {
        currentPrice: position.currentPrice ?? null,
        previousPrice: position.averagePrice ?? null
      },
      provenance: {
        source: event.source || event.provenance?.source || 'NEWS_CORE_V2',
        observedAt: now,
        eventId: event.id,
        publisher: event.publisher,
        url: event.url || event.provenance?.url
      },
      dedupeKey
    };

    return {
      decision: 'POSITION_IMPACT',
      positionId: position.positionId,
      symbol: position.symbol,
      impactType: classification.impactType,
      severity: classification.severity,
      reason: candidate.reason,
      candidate
    };
  }

  /**
   * Evaluates a batch of news events and returns all generated position alert candidates.
   */
  public evaluateEvents(
    events: PositionNewsEventInput[],
    positionsInput: NormalizedPosition[] | PositionSnapshot
  ): PositionAlertCandidate[] {
    const candidates: PositionAlertCandidate[] = [];
    for (const ev of events) {
      const result = this.evaluateEvent(ev, positionsInput);
      if (result.decision === 'POSITION_IMPACT' && result.candidate) {
        candidates.push(result.candidate);
      }
    }
    return candidates;
  }

  // =========================================================================
  // INTERNAL VERIFICATION & MATCHING HELPERS
  // =========================================================================

  private verifyProvenance(event: PositionNewsEventInput): { valid: boolean; reason?: string } {
    if (!event || typeof event !== 'object') {
      return { valid: false, reason: 'INVALID_EVENT_OBJECT' };
    }

    if (!event.id || typeof event.id !== 'string' || event.id.trim() === '') {
      return { valid: false, reason: 'INVALID_EVENT_ID' };
    }

    if (!event.headline || typeof event.headline !== 'string' || event.headline.trim() === '') {
      return { valid: false, reason: 'MISSING_HEADLINE' };
    }

    // Explicit synthetic / test exclusion (Fail-closed)
    if (
      event.isSynthetic === true ||
      event.isTest === true ||
      event.id.startsWith('SYNTH_') ||
      event.id.startsWith('TEST_') ||
      event.id.startsWith('TEST_SYNTH')
    ) {
      return { valid: false, reason: 'SYNTHETIC_OR_TEST_EVENT_REJECTED' };
    }

    // Provenance origin & authenticity check
    const sourceIdentifier = (event.provenance?.source || event.source || event.publisher || '').trim();
    if (!sourceIdentifier) {
      return { valid: false, reason: 'MISSING_PROVENANCE_SOURCE' };
    }

    // If explicit provenance record is present, check verified flag
    if (event.provenance && event.provenance.verified === false) {
      return { valid: false, reason: 'UNVERIFIED_PROVENANCE_REJECTED' };
    }

    return { valid: true };
  }

  private extractActivePositions(
    positionsInput: NormalizedPosition[] | PositionSnapshot
  ): NormalizedPosition[] {
    if (Array.isArray(positionsInput)) {
      return positionsInput.filter(p => p.quantity > 0);
    }
    if (positionsInput && positionsInput.positions instanceof Map) {
      return Array.from(positionsInput.positions.values()).filter(p => p.quantity > 0);
    }
    return [];
  }

  private findMatchingPosition(
    event: PositionNewsEventInput,
    activePositions: NormalizedPosition[]
  ): { matchedPosition: NormalizedPosition | null; reason?: string } {
    // 1. Check for pure Macro / Benchmark events without specific target
    const eventSymbol = (event.symbols && event.symbols.length === 1) ? event.symbols[0].toUpperCase() : null;
    if (eventSymbol && PositionRelevanceEngine.MACRO_SYMBOLS.has(eventSymbol)) {
      // Check if user actually holds this exact symbol (e.g. an ETF named NIFTYBEES or direct index instrument)
      const exactIndexHolding = activePositions.find(p => p.symbol === eventSymbol);
      if (!exactIndexHolding) {
        return { matchedPosition: null, reason: 'GENERIC_MACRO_BENCHMARK_EVENT' };
      }
    }

    // 2. Strict Matching Mechanism 1: Exact ISIN match
    if (event.isin && typeof event.isin === 'string' && event.isin.trim().length >= 10) {
      const cleanIsin = event.isin.trim().toUpperCase();
      const isinMatch = activePositions.find(p => p.isin && p.isin.trim().toUpperCase() === cleanIsin);
      if (isinMatch) {
        return { matchedPosition: isinMatch };
      }
    }

    // 3. Strict Matching Mechanism 2: Exact Symbol match from structured symbols field
    if (Array.isArray(event.symbols) && event.symbols.length > 0) {
      const upperSymbols = event.symbols.map(s => (typeof s === 'string' ? s.trim().toUpperCase() : ''));
      for (const pos of activePositions) {
        if (upperSymbols.includes(pos.symbol)) {
          return { matchedPosition: pos };
        }
      }
    }

    // 4. Strict Matching Mechanism 3: Exact Exchange + Symbol match
    if (event.exchange && event.symbols && Array.isArray(event.symbols)) {
      const targetExchange = event.exchange.trim().toUpperCase();
      for (const pos of activePositions) {
        if (
          pos.exchange &&
          pos.exchange.toUpperCase() === targetExchange &&
          event.symbols.some(s => typeof s === 'string' && s.trim().toUpperCase() === pos.symbol)
        ) {
          return { matchedPosition: pos };
        }
      }
    }

    // 5. Strict Matching Mechanism 4: Exact Canonical Underlying Symbol
    for (const pos of activePositions) {
      if (pos.underlyingSymbol) {
        const uSym = pos.underlyingSymbol.trim().toUpperCase();
        if (
          (event.symbols && event.symbols.some(s => typeof s === 'string' && s.trim().toUpperCase() === uSym)) ||
          (event.entities && event.entities.some(e => typeof e === 'string' && e.trim().toUpperCase() === uSym))
        ) {
          return { matchedPosition: pos };
        }
      }
    }

    // 6. Strict Matching Mechanism 5: Exact Entity Identifier match in structured entities field
    if (Array.isArray(event.entities) && event.entities.length > 0) {
      const upperEntities = event.entities.map(e => (typeof e === 'string' ? e.trim().toUpperCase() : ''));
      for (const pos of activePositions) {
        if (
          upperEntities.includes(pos.symbol) ||
          upperEntities.includes(`NSE:${pos.symbol}`) ||
          upperEntities.includes(`BSE:${pos.symbol}`)
        ) {
          return { matchedPosition: pos };
        }
      }
    }

    // Strict Fail-Closed: If none of the trusted structured identifiers match -> NO_POSITION_IMPACT
    return { matchedPosition: null, reason: 'NO_MATCHING_ACTIVE_POSITION' };
  }

  private classifyMateriality(
    event: PositionNewsEventInput,
    position: NormalizedPosition
  ): {
    isMaterial: boolean;
    impactType: PositionImpactType;
    severity: PositionAlertSeverity;
    rejectionReason?: string;
  } {
    const text = `${event.headline} ${event.body || ''}`.toLowerCase();
    const cat = (event.category || '').toUpperCase();
    const eventType = (event.eventType || '').toUpperCase();

    // 1. Regulatory Actions & Trading Halts (Highest Criticality)
    if (
      eventType.includes('REGULATORY') ||
      eventType.includes('HALT') ||
      eventType.includes('SUSPENSION') ||
      text.includes('trading halt') ||
      text.includes('trading suspended') ||
      text.includes('sebi ban') ||
      text.includes('rbi sanction') ||
      text.includes('license revoked') ||
      text.includes('insolvency') ||
      text.includes('fraud probe') ||
      text.includes('cbi raid')
    ) {
      const isCritical =
        text.includes('trading halt') ||
        text.includes('suspended') ||
        text.includes('ban') ||
        text.includes('insolvency') ||
        text.includes('fraud');

      return {
        isMaterial: true,
        impactType: 'REGULATORY_EVENT',
        severity: isCritical ? 'CRITICAL' : 'WARNING'
      };
    }

    // 2. Results / Earnings Announcements
    if (
      cat === 'RESULTS' ||
      eventType.includes('RESULTS') ||
      eventType.includes('EARNINGS') ||
      text.includes('q1 results') ||
      text.includes('q2 results') ||
      text.includes('q3 results') ||
      text.includes('q4 results') ||
      text.includes('quarterly profit') ||
      text.includes('quarterly loss') ||
      text.includes('net profit jumps') ||
      text.includes('net profit drops') ||
      text.includes('reports net profit') ||
      text.includes('reports net loss') ||
      text.includes('revenue surges') ||
      text.includes('revenue falls') ||
      text.includes('ebitda')
    ) {
      return {
        isMaterial: true,
        impactType: 'RESULTS_EVENT',
        severity: 'WARNING'
      };
    }

    // 3. Corporate Actions (Dividends, Splits, Buybacks)
    if (
      cat === 'CORPORATE_ACTION' ||
      eventType.includes('DIVIDEND') ||
      eventType.includes('BUYBACK') ||
      eventType.includes('SPLIT') ||
      text.includes('dividend') ||
      text.includes('stock split') ||
      text.includes('bonus issue') ||
      text.includes('share buyback') ||
      text.includes('rights issue')
    ) {
      return {
        isMaterial: true,
        impactType: 'CORPORATE_ACTION',
        severity: 'WARNING'
      };
    }

    // 4. Material Corporate / Business Announcements (M&A, Executive Change, Big Orders/Deals)
    if (
      cat === 'M&A' ||
      cat === 'CORPORATE' ||
      eventType.includes('MERGER') ||
      eventType.includes('ACQUISITION') ||
      eventType.includes('MANAGEMENT') ||
      eventType.includes('ORDER') ||
      eventType.includes('DEAL') ||
      text.includes('merger') ||
      text.includes('acquisition') ||
      text.includes('acquires') ||
      text.includes('stake purchase') ||
      text.includes('order win') ||
      text.includes('bags order') ||
      text.includes('bags') ||
      text.includes('deal') ||
      text.includes('contract awarded') ||
      text.includes('contract') ||
      text.includes('ceo resigns') ||
      text.includes('md resigns') ||
      text.includes('appoints new ceo') ||
      text.includes('credit rating downgrade') ||
      text.includes('credit rating upgrade') ||
      text.includes('debt default')
    ) {
      const isCritical = text.includes('debt default') || text.includes('downgraded to junk');
      return {
        isMaterial: true,
        impactType: 'MATERIAL_COMPANY_EVENT',
        severity: isCritical ? 'CRITICAL' : 'WARNING'
      };
    }

    // 5. Standard Company News with direct high-confidence ticker mapping
    if (event.symbols && event.symbols.includes(position.symbol)) {
      return {
        isMaterial: true,
        impactType: 'POSITION_NEWS_EVENT',
        severity: 'INFO'
      };
    }

    // 6. Generic noise rejection
    return {
      isMaterial: false,
      impactType: 'POSITION_NEWS_EVENT',
      severity: 'INFO',
      rejectionReason: 'NON_MATERIAL_GENERIC_COMMENTARY'
    };
  }
}
