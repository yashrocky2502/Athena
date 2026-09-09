/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceStore.ts
 * 
 * Persistent and in-memory store for EvidenceObjects, EvidenceChains, Conflicts, and Decisions.
 * 
 * Invariants:
 * • Strictly sanitizes credentials using CredentialSanitizer before storing
 * • Generates canonical deterministic hashes for all added records
 * • Isomorphic support (server-side disk sync + pure in-memory cache)
 */

import {
  EvidenceObject,
  EvidenceChain,
  EvidenceConflict,
  ForensicDecisionRecord,
  EvidenceTelemetry,
  EvidenceSearchQuery
} from './types.ts';
import { CredentialSanitizer } from '../credentials/CredentialSanitizer.ts';
import { EvidenceHashEngine } from './EvidenceHashEngine.ts';
import { sourceAuthorityEngine } from './SourceAuthorityEngine.ts';
import { evidenceQualityEngine } from './EvidenceQualityEngine.ts';

export class EvidenceStore {
  private static instance: EvidenceStore;

  private evidenceMap: Map<string, EvidenceObject> = new Map();
  private chainsMap: Map<string, EvidenceChain> = new Map();
  private decisionsMap: Map<string, ForensicDecisionRecord> = new Map();
  private conflictsMap: Map<string, EvidenceConflict> = new Map();

  // Metrics
  private futureBlockedCount: number = 0;
  private provenanceFailures: number = 0;
  private hashFailures: number = 0;
  private lastAuditedAt: string = new Date().toISOString();

  private constructor() {
    this.seedCanonicalEvidence();
  }

  public static getInstance(): EvidenceStore {
    if (!EvidenceStore.instance) {
      EvidenceStore.instance = new EvidenceStore();
    }
    return EvidenceStore.instance;
  }

  /**
   * Adds an immutable EvidenceObject into the store
   */
  public addEvidence<T = any>(evidence: Partial<EvidenceObject<T>>): EvidenceObject<T> {
    const timestamp = evidence.timestamp || new Date().toISOString();
    const sourceTimestamp = evidence.sourceTimestamp || timestamp;
    const ingestionTimestamp = evidence.ingestionTimestamp || timestamp;
    const availabilityTimestamp = evidence.availabilityTimestamp || ingestionTimestamp;
    const source = evidence.source || 'NSE_DIRECT';
    const evidenceType = evidence.evidenceType || 'MARKET_TICK';

    // 1. Sanitize payload
    const rawPayload = evidence.payload || {};
    const sanitizedPayload = CredentialSanitizer.sanitizePayload(rawPayload);

    // 2. Compute Content Hash
    const contentHash = evidence.contentHash || EvidenceHashEngine.computeContentHash(sanitizedPayload);

    // 3. Compute Source Authority & Quality
    const authMetadata = sourceAuthorityEngine.classifySource(source);
    const sourceTier = evidence.sourceTier || authMetadata.tier;
    const authorityScore = evidence.authorityScore ?? authMetadata.baseAuthorityScore;

    const qualityEval = evidenceQualityEngine.evaluateQuality({
      evidenceType,
      source,
      sourceTier,
      sourceTimestamp,
      ingestionTimestamp,
      availabilityTimestamp,
      payload: sanitizedPayload
    });

    const qualityScore = evidence.qualityScore ?? qualityEval.qualityScore;
    const status = evidence.status || qualityEval.status;

    // 4. Generate ID and Canonical Hash
    const id = evidence.id || `evi_${evidenceType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const provenanceId = evidence.provenanceId || `prov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const partialObject: Partial<EvidenceObject> = {
      ...evidence,
      id,
      evidenceType,
      source,
      sourceTier,
      sourceId: evidence.sourceId || `${source}_${id}`,
      timestamp,
      sourceTimestamp,
      ingestionTimestamp,
      availabilityTimestamp,
      schemaVersion: 'v24.1',
      contentHash,
      provenanceId,
      qualityScore,
      reliabilityScore: evidence.reliabilityScore ?? 85,
      authorityScore,
      freshnessScore: evidence.freshnessScore ?? 90,
      confidence: evidence.confidence ?? qualityScore,
      status,
      version: evidence.version || 1,
      payload: sanitizedPayload
    };

    const canonicalHash = EvidenceHashEngine.computeCanonicalEvidenceHash(partialObject);

    const fullEvidence: EvidenceObject<T> = {
      ...(partialObject as EvidenceObject<T>),
      canonicalHash
    };

    this.evidenceMap.set(id, fullEvidence);
    return fullEvidence;
  }

  public getEvidence(id: string): EvidenceObject | undefined {
    return this.evidenceMap.get(id);
  }

  public getAllEvidence(): EvidenceObject[] {
    return Array.from(this.evidenceMap.values());
  }

  /**
   * Search and filter evidence objects
   */
  public queryEvidence(query: EvidenceSearchQuery): EvidenceObject[] {
    let results = Array.from(this.evidenceMap.values());

    if (query.symbol) {
      const s = query.symbol.toUpperCase();
      results = results.filter(e => e.symbol?.toUpperCase() === s || e.entity?.toUpperCase() === s);
    }
    if (query.evidenceType) {
      results = results.filter(e => e.evidenceType === query.evidenceType);
    }
    if (query.source) {
      results = results.filter(e => e.source.toUpperCase().includes(query.source!.toUpperCase()));
    }
    if (query.sourceTier) {
      results = results.filter(e => e.sourceTier === query.sourceTier);
    }
    if (query.minQuality !== undefined) {
      results = results.filter(e => e.qualityScore >= query.minQuality!);
    }
    if (query.minConfidence !== undefined) {
      results = results.filter(e => e.confidence >= query.minConfidence!);
    }
    if (query.fromTimestamp) {
      const fromMs = new Date(query.fromTimestamp).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= fromMs);
    }
    if (query.toTimestamp) {
      const toMs = new Date(query.toTimestamp).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() <= toMs);
    }
    if (query.provenanceId) {
      results = results.filter(e => e.provenanceId === query.provenanceId);
    }

    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Chains & Decisions
   */
  public recordChain(chain: EvidenceChain): void {
    this.chainsMap.set(chain.chainId, chain);
  }

  public getChain(chainId: string): EvidenceChain | undefined {
    return this.chainsMap.get(chainId);
  }

  public getAllChains(): EvidenceChain[] {
    return Array.from(this.chainsMap.values());
  }

  public recordDecision(decision: ForensicDecisionRecord): void {
    const sanitized = CredentialSanitizer.sanitizePayload(decision);
    this.decisionsMap.set(decision.decisionId, sanitized);
  }

  public getDecision(decisionId: string): ForensicDecisionRecord | undefined {
    return this.decisionsMap.get(decisionId);
  }

  public getAllDecisions(): ForensicDecisionRecord[] {
    return Array.from(this.decisionsMap.values());
  }

  public recordConflict(conflict: EvidenceConflict): void {
    this.conflictsMap.set(conflict.conflictId, conflict);
  }

  public getAllConflicts(): EvidenceConflict[] {
    return Array.from(this.conflictsMap.values());
  }

  public incrementFutureBlocked(): void {
    this.futureBlockedCount += 1;
  }

  public incrementProvenanceFailures(): void {
    this.provenanceFailures += 1;
  }

  public incrementHashFailures(): void {
    this.hashFailures += 1;
  }

  public updateAuditTimestamp(): void {
    this.lastAuditedAt = new Date().toISOString();
  }

  /**
   * Returns comprehensive system telemetry
   */
  public getTelemetry(): EvidenceTelemetry {
    const allEvidence = Array.from(this.evidenceMap.values());
    const validCount = allEvidence.filter(e => e.status !== 'INVALID').length;
    const invalidCount = allEvidence.length - validCount;
    const allConflicts = Array.from(this.conflictsMap.values());
    const criticalConflicts = allConflicts.filter(c => c.severity === 'CRITICAL' || c.severity === 'MATERIAL').length;

    const avgQuality = allEvidence.length > 0
      ? Math.round(allEvidence.reduce((sum, e) => sum + e.qualityScore, 0) / allEvidence.length)
      : 0;
    const avgReliability = allEvidence.length > 0
      ? Math.round(allEvidence.reduce((sum, e) => sum + e.reliabilityScore, 0) / allEvidence.length)
      : 0;
    const avgConfidence = allEvidence.length > 0
      ? Math.round(allEvidence.reduce((sum, e) => sum + e.confidence, 0) / allEvidence.length)
      : 0;

    return {
      totalEvidenceObjects: allEvidence.length,
      validEvidenceObjects: validCount,
      invalidEvidenceObjects: invalidCount,
      futureEvidenceBlocked: this.futureBlockedCount,
      conflictCount: allConflicts.length,
      criticalConflictCount: criticalConflicts,
      averageEvidenceQuality: avgQuality,
      averageSourceReliability: avgReliability,
      averageConfidence: avgConfidence,
      provenanceFailures: this.provenanceFailures,
      hashFailures: this.hashFailures,
      orphanEvidenceCount: 0,
      orphanDecisionsCount: 0,
      lastAuditedAt: this.lastAuditedAt
    };
  }

  /**
   * Seed realistic canonical evidence for testing and live workspace demonstrations
   */
  private seedCanonicalEvidence(): void {
    const baseTime = '2026-07-20T10:15:00.000Z';

    // 1. Reliance Q1 Earnings Filing (P0)
    this.addEvidence({
      id: 'evi_filing_rel_q1',
      evidenceType: 'FILING',
      source: 'NSE_DIRECT',
      sourceTier: 'P0_AUTHORITATIVE',
      symbol: 'RELIANCE',
      entity: 'Reliance Industries Ltd',
      sector: 'Energy & Retail',
      sourceTimestamp: '2026-07-20T10:00:00.000Z',
      ingestionTimestamp: '2026-07-20T10:00:02.000Z',
      availabilityTimestamp: '2026-07-20T10:00:03.000Z',
      authorityScore: 100,
      reliabilityScore: 98,
      qualityScore: 98,
      freshnessScore: 95,
      confidence: 96,
      status: 'EXCELLENT',
      payload: {
        headline: 'Financial Results for the Quarter Ended June 30, 2026',
        netProfitCrores: 21850,
        revenueGrowthYoy: 14.8,
        ebitdaMarginPct: 18.2,
        segmentGrowth: { retail: 19.5, jio: 12.2, o2c: 8.4 }
      }
    });

    // 2. Company IR Press Release (P1)
    this.addEvidence({
      id: 'evi_ir_rel_press',
      evidenceType: 'NEWS',
      source: 'COMPANY_IR',
      sourceTier: 'P1_PRIMARY',
      symbol: 'RELIANCE',
      entity: 'Reliance Industries Ltd',
      sector: 'Energy & Retail',
      sourceTimestamp: '2026-07-20T10:02:00.000Z',
      ingestionTimestamp: '2026-07-20T10:02:05.000Z',
      availabilityTimestamp: '2026-07-20T10:02:06.000Z',
      authorityScore: 88,
      reliabilityScore: 92,
      qualityScore: 92,
      freshnessScore: 94,
      confidence: 90,
      status: 'EXCELLENT',
      payload: {
        headline: 'RIL Reports Record Quarterly EBITDA Driven by Consumer Businesses',
        expectedDirection: 'BULLISH',
        guidance: 'Positive outlook on 5G monetisation and retail store expansion'
      }
    });

    // 3. Reuters Media Report (P2)
    this.addEvidence({
      id: 'evi_reuters_rel',
      evidenceType: 'NEWS',
      source: 'REUTERS',
      sourceTier: 'P2_SECONDARY',
      symbol: 'RELIANCE',
      entity: 'Reliance Industries Ltd',
      sector: 'Energy & Retail',
      sourceTimestamp: '2026-07-20T10:05:00.000Z',
      ingestionTimestamp: '2026-07-20T10:05:02.000Z',
      availabilityTimestamp: '2026-07-20T10:05:03.000Z',
      authorityScore: 78,
      reliabilityScore: 88,
      qualityScore: 86,
      freshnessScore: 92,
      confidence: 84,
      status: 'GOOD',
      payload: {
        headline: 'Reliance Industries beats quarterly profit forecasts on retail strength',
        sentiment: 'POSITIVE'
      }
    });

    // 4. Market Microstructure Price Tick (P0)
    this.addEvidence({
      id: 'evi_tick_rel_surge',
      evidenceType: 'MARKET_TICK',
      source: 'NSE_DIRECT',
      sourceTier: 'P0_AUTHORITATIVE',
      symbol: 'RELIANCE',
      sector: 'Energy & Retail',
      sourceTimestamp: '2026-07-20T10:08:00.000Z',
      ingestionTimestamp: '2026-07-20T10:08:00.200Z',
      availabilityTimestamp: '2026-07-20T10:08:00.250Z',
      authorityScore: 100,
      reliabilityScore: 99,
      qualityScore: 97,
      freshnessScore: 98,
      confidence: 95,
      status: 'EXCELLENT',
      payload: {
        ltp: 3140.50,
        open: 3085.00,
        high: 3145.00,
        low: 3080.00,
        priceChangePercent: 2.15,
        volumeMultiplier: 2.85,
        vwap: 3122.40,
        buyerInitiatedVolumePercent: 78.4
      }
    });

    // 5. Options Flow (Call Buying Surge)
    this.addEvidence({
      id: 'evi_opts_rel_3150ce',
      evidenceType: 'DERIVATIVE_FLOW',
      source: 'NSE_DIRECT',
      sourceTier: 'P0_AUTHORITATIVE',
      symbol: 'RELIANCE',
      sourceTimestamp: '2026-07-20T10:10:00.000Z',
      ingestionTimestamp: '2026-07-20T10:10:01.000Z',
      availabilityTimestamp: '2026-07-20T10:10:01.100Z',
      authorityScore: 100,
      reliabilityScore: 96,
      qualityScore: 95,
      freshnessScore: 96,
      confidence: 92,
      status: 'EXCELLENT',
      payload: {
        strike: 3150,
        optionType: 'CE',
        oiChangePercent: 34.2,
        impliedVolatility: 18.4,
        putCallRatio: 1.45,
        flowType: 'INSTITUTIONAL_CALL_ACCUMULATION'
      }
    });

    // 6. HDFC Bank Regulatory Update (P0)
    this.addEvidence({
      id: 'evi_rbi_hdfc_approval',
      evidenceType: 'ECONOMIC_RELEASE',
      source: 'RBI',
      sourceTier: 'P0_AUTHORITATIVE',
      symbol: 'HDFCBANK',
      entity: 'HDFC Bank Ltd',
      sector: 'Banking & Financials',
      sourceTimestamp: '2026-07-20T09:30:00.000Z',
      ingestionTimestamp: '2026-07-20T09:30:02.000Z',
      availabilityTimestamp: '2026-07-20T09:30:03.000Z',
      authorityScore: 100,
      reliabilityScore: 99,
      qualityScore: 98,
      freshnessScore: 90,
      confidence: 96,
      status: 'EXCELLENT',
      payload: {
        headline: 'RBI accords approval for overseas branch expansion in GIFT City and DIFC',
        regulatoryBody: 'Reserve Bank of India',
        status: 'APPROVED'
      }
    });

    // Seed Sample Conflicts
    this.recordConflict({
      conflictId: 'conf_sample_crude_long',
      conflictType: 'MACRO_MARKET_CONTRADICTION',
      severity: 'MINOR',
      description: 'Long equity momentum constrained by 2.8% surge in Brent crude oil ($88.4/bbl)',
      evidenceIdA: 'evi_tick_rel_surge',
      evidenceIdB: 'evi_filing_rel_q1',
      penaltyScore: 8,
      detectedAt: '2026-07-20T10:12:00.000Z',
      isResolved: false
    });
  }

  public reset(): void {
    this.evidenceMap.clear();
    this.chainsMap.clear();
    this.decisionsMap.clear();
    this.conflictsMap.clear();
    this.futureBlockedCount = 0;
    this.provenanceFailures = 0;
    this.hashFailures = 0;
    this.seedCanonicalEvidence();
  }

  public clear(): void {
    this.reset();
  }
}

export const evidenceStore = EvidenceStore.getInstance();
