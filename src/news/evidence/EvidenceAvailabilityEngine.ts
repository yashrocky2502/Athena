/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceAvailabilityEngine.ts
 * 
 * Availability Firewall for evidence consumption.
 * Enforces the fundamental principle:
 * "A downstream engine may ONLY consume evidence where availabilityTimestamp <= decisionTimestamp."
 * 
 * Integrates directly with Phase 23 HistoricalFutureFirewall.
 */

import { EvidenceObject } from './types.ts';
import { historicalFutureFirewall } from '../historical-truth/HistoricalFutureFirewall.ts';

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  code: 'AVAILABLE' | 'FUTURE_EVIDENCE_BLOCKED' | 'INVALID_TIMESTAMP';
  decisionTimestamp: string;
  availabilityTimestamp: string;
  deltaMs: number;
  message?: string;
}

export class EvidenceAvailabilityEngine {
  private static instance: EvidenceAvailabilityEngine;

  private constructor() {}

  public static getInstance(): EvidenceAvailabilityEngine {
    if (!EvidenceAvailabilityEngine.instance) {
      EvidenceAvailabilityEngine.instance = new EvidenceAvailabilityEngine();
    }
    return EvidenceAvailabilityEngine.instance;
  }

  /**
   * Validates if a single evidence object is available at a given decision timestamp
   */
  public checkAvailability(
    evidenceOrParams: EvidenceObject | { availabilityTimestamp: string; asOfTimestamp?: string; decisionTimestamp?: string },
    decisionTimestampArg?: string
  ): AvailabilityCheckResult & { isFutureBlocked?: boolean; latencyMs?: number; reason?: string } {
    let availIso: string;
    let decIso: string;
    let evidenceId = 'EVI_CHECK';
    let source = 'UNKNOWN';

    if ('id' in evidenceOrParams) {
      availIso = evidenceOrParams.availabilityTimestamp;
      decIso = decisionTimestampArg || new Date().toISOString();
      evidenceId = evidenceOrParams.id;
      source = evidenceOrParams.source;
    } else {
      availIso = evidenceOrParams.availabilityTimestamp;
      decIso = evidenceOrParams.asOfTimestamp || evidenceOrParams.decisionTimestamp || decisionTimestampArg || new Date().toISOString();
    }

    const availMs = new Date(availIso).getTime();
    const decMs = new Date(decIso).getTime();

    if (isNaN(availMs) || isNaN(decMs)) {
      return {
        isAvailable: false,
        isFutureBlocked: true,
        code: 'INVALID_TIMESTAMP',
        decisionTimestamp: decIso,
        availabilityTimestamp: availIso,
        deltaMs: 0,
        latencyMs: 0,
        reason: 'Invalid ISO timestamp supplied for availability check',
        message: 'Invalid ISO timestamp supplied for availability check'
      };
    }

    const deltaMs = availMs - decMs;
    const latencyMs = decMs - availMs;

    // Check against Phase 23 HistoricalFutureFirewall if active replay cursor is present
    const activeReplayCursor = historicalFutureFirewall.getActiveCursor();
    if (activeReplayCursor) {
      const firewallInspection = historicalFutureFirewall.inspectRecord(
        'AI_INTERPRETATION',
        availIso,
        source,
        'evidenceObject',
        evidenceId,
        false
      );

      if (!firewallInspection.passed) {
        return {
          isAvailable: false,
          isFutureBlocked: true,
          code: 'FUTURE_EVIDENCE_BLOCKED',
          decisionTimestamp: activeReplayCursor,
          availabilityTimestamp: availIso,
          deltaMs,
          latencyMs,
          reason: `[LOOK-AHEAD BIAS DETECTED] Evidence ${evidenceId} was not available at replay time ${activeReplayCursor}`,
          message: `[LOOK-AHEAD BIAS DETECTED] Evidence ${evidenceId} was not available at replay time ${activeReplayCursor}`
        };
      }
    }

    // Availability condition: availabilityTimestamp <= decisionTimestamp
    if (availMs > decMs) {
      return {
        isAvailable: false,
        isFutureBlocked: true,
        code: 'FUTURE_EVIDENCE_BLOCKED',
        decisionTimestamp: decIso,
        availabilityTimestamp: availIso,
        deltaMs,
        latencyMs,
        reason: `LOOK-AHEAD BIAS DETECTED: Evidence ${evidenceId} available at ${availIso} is in the future of asOf ${decIso}`,
        message: `LOOK-AHEAD BIAS DETECTED: Evidence ${evidenceId} available at ${availIso} is in the future of asOf ${decIso}`
      };
    }

    return {
      isAvailable: true,
      isFutureBlocked: false,
      code: 'AVAILABLE',
      decisionTimestamp: decIso,
      availabilityTimestamp: availIso,
      deltaMs,
      latencyMs: Math.max(0, latencyMs)
    };
  }

  /**
   * Filters a collection of evidence objects to strictly include those available at decisionTimestamp
   */
  public filterAvailableEvidence<T extends EvidenceObject>(evidenceList: T[], decisionTimestamp: string): T[] {
    const decMs = new Date(decisionTimestamp).getTime();
    return evidenceList.filter(evi => {
      const availMs = new Date(evi.availabilityTimestamp).getTime();
      return !isNaN(availMs) && availMs <= decMs;
    });
  }

  /**
   * Partitions evidence into (Available At Then) vs (Appeared Later in Future)
   */
  public partitionByTimestamp<T extends EvidenceObject>(
    evidenceList: T[],
    decisionTimestamp: string
  ): { availableThen: T[]; appearedLater: T[] } {
    const decMs = new Date(decisionTimestamp).getTime();
    const availableThen: T[] = [];
    const appearedLater: T[] = [];

    for (const evi of evidenceList) {
      const availMs = new Date(evi.availabilityTimestamp).getTime();
      if (!isNaN(availMs) && availMs <= decMs) {
        availableThen.push(evi);
      } else {
        appearedLater.push(evi);
      }
    }

    return { availableThen, appearedLater };
  }
}

export const evidenceAvailabilityEngine = EvidenceAvailabilityEngine.getInstance();
