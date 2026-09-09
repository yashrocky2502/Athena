/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * SourceReliabilityEngine.ts
 * 
 * Deterministic source reliability calculation based on:
 * • historical accuracy
 * • timestamp integrity
 * • data completeness
 * • contradiction frequency
 * • update frequency
 * • source authority
 * 
 * Guarantee: Pure deterministic math. AI is strictly barred from computing reliability.
 */

import { sourceAuthorityEngine } from './SourceAuthorityEngine.ts';

export interface SourceReliabilityRecord {
  sourceId: string;
  totalSubmissions: number;
  validSubmissions: number;
  timestampErrors: number;
  contradictionCount: number;
  incompletePayloads: number;
  lastUpdated: string;
  rollingAccuracyPercent: number;
}

export class SourceReliabilityEngine {
  private static instance: SourceReliabilityEngine;
  private sourceHistory: Map<string, SourceReliabilityRecord> = new Map();

  private constructor() {}

  public static getInstance(): SourceReliabilityEngine {
    if (!SourceReliabilityEngine.instance) {
      SourceReliabilityEngine.instance = new SourceReliabilityEngine();
    }
    return SourceReliabilityEngine.instance;
  }

  /**
   * Records a data submission from a source to update dynamic reliability statistics
   */
  public recordSubmission(
    sourceId: string,
    params: {
      isValid: boolean;
      hasTimestampError: boolean;
      hasContradiction: boolean;
      isIncomplete: boolean;
      timestamp: string;
    }
  ): void {
    const key = sourceId.toUpperCase();
    const existing = this.sourceHistory.get(key) || {
      sourceId: key,
      totalSubmissions: 0,
      validSubmissions: 0,
      timestampErrors: 0,
      contradictionCount: 0,
      incompletePayloads: 0,
      lastUpdated: params.timestamp,
      rollingAccuracyPercent: 100
    };

    existing.totalSubmissions += 1;
    if (params.isValid) existing.validSubmissions += 1;
    if (params.hasTimestampError) existing.timestampErrors += 1;
    if (params.hasContradiction) existing.contradictionCount += 1;
    if (params.isIncomplete) existing.incompletePayloads += 1;
    existing.lastUpdated = params.timestamp;

    // Calculate rolling accuracy
    const accuracy = (existing.validSubmissions / existing.totalSubmissions) * 100;
    existing.rollingAccuracyPercent = Number(accuracy.toFixed(2));

    this.sourceHistory.set(key, existing);
  }

  /**
   * Computes deterministic reliability score (0 - 100) for a given source
   */
  public calculateReliability(
    source: string,
    samplePayload?: {
      hasTimestamp: boolean;
      isComplete: boolean;
      isCorroborated?: boolean;
    }
  ): number {
    const cleanSource = source.toUpperCase();
    const authorityScore = sourceAuthorityEngine.getAuthorityScore(cleanSource);
    const history = this.sourceHistory.get(cleanSource);

    // If no prior history, base reliability on source tier authority
    if (!history || history.totalSubmissions === 0) {
      let baseline = authorityScore;
      if (samplePayload) {
        if (!samplePayload.hasTimestamp) baseline -= 30;
        if (!samplePayload.isComplete) baseline -= 20;
      }
      return Math.max(10, Math.min(100, Math.round(baseline)));
    }

    // Historical weighted factors
    const accuracyWeight = 0.40;
    const authorityWeight = 0.25;
    const timestampIntegrityWeight = 0.15;
    const completenessWeight = 0.10;
    const contradictionPenaltyWeight = 0.10;

    const accuracyScore = history.rollingAccuracyPercent;
    const timestampIntegrityScore = Math.max(0, 100 - (history.timestampErrors / history.totalSubmissions) * 100);
    const completenessScore = Math.max(0, 100 - (history.incompletePayloads / history.totalSubmissions) * 100);
    const contradictionRate = (history.contradictionCount / history.totalSubmissions) * 100;
    const contradictionScore = Math.max(0, 100 - contradictionRate * 2);

    const calculatedScore =
      accuracyScore * accuracyWeight +
      authorityScore * authorityWeight +
      timestampIntegrityScore * timestampIntegrityWeight +
      completenessScore * completenessWeight +
      contradictionScore * contradictionPenaltyWeight;

    return Math.max(10, Math.min(100, Math.round(calculatedScore)));
  }

  public getSourceRecord(source: string): SourceReliabilityRecord | undefined {
    return this.sourceHistory.get(source.toUpperCase());
  }

  public getReliability(source: string): {
    reliabilityScore: number;
    verifiedReports: number;
    totalSubmissions: number;
  } {
    const score = this.calculateReliability(source);
    const history = this.getSourceRecord(source);
    return {
      reliabilityScore: score,
      verifiedReports: history ? history.validSubmissions : 0,
      totalSubmissions: history ? history.totalSubmissions : 0
    };
  }

  public recordOutcome(source: string, isVerified: boolean): void {
    this.recordSubmission(source, {
      isValid: isVerified,
      hasTimestampError: false,
      hasContradiction: !isVerified,
      isIncomplete: false,
      timestamp: new Date().toISOString()
    });
  }

  public getAllSourceRecords(): SourceReliabilityRecord[] {
    return Array.from(this.sourceHistory.values());
  }

  public reset(): void {
    this.sourceHistory.clear();
  }
}

export const sourceReliabilityEngine = SourceReliabilityEngine.getInstance();
