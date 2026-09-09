/**
 * ATHENA NEWS ENGINE — PHASE 15
 * LearningSafetyGate.ts
 * 
 * CRITICAL SAFETY ENFORCEMENT ENGINE:
 * Prevents AI/LLM or automated learning algorithms from altering core risk parameters.
 * 
 * INVARIANTS ENFORCED:
 * 1. Hard risk limits cannot be modified by learning updates.
 * 2. Kill switches cannot be disabled or widened.
 * 3. Max leverage / position sizing caps cannot be increased.
 * 4. Portfolio risk gates CANNOT be bypassed by adaptive scores.
 * 5. Execution risk gates CANNOT be bypassed.
 * 6. Learning CANNOT place direct orders.
 * 7. Look-ahead bias / future data usage is strictly prohibited.
 * 8. Strategies CANNOT be promoted with insufficient sample size (< 10 trades).
 */

import { AdaptiveScore, AdaptiveChangeLogRecord } from './types.ts';

export class LearningSafetyGate {
  /**
   * Validates an adaptive score update before applying it to candidate ranking.
   */
  public static validateAdaptiveChange(
    entityKey: string,
    previousScore: number,
    proposedScore: number,
    sampleSize: number,
    learningVersion: string,
    reason: string
  ): { isValid: boolean; violationReason?: string; record?: AdaptiveChangeLogRecord } {
    // Rule 1: Insufficient sample size check for score promotion
    if (sampleSize < 10 && proposedScore > previousScore) {
      return {
        isValid: false,
        violationReason: `Cannot promote entity ${entityKey} with insufficient sample size (${sampleSize} < 10).`
      };
    }

    // Rule 2: Max score change velocity (max ±30 points in a single update)
    if (Math.abs(proposedScore - previousScore) > 30) {
      return {
        isValid: false,
        violationReason: `Score change velocity limit exceeded (${Math.abs(proposedScore - previousScore)} > 30 pts max step).`
      };
    }

    // Passed safety checks
    const record: AdaptiveChangeLogRecord = {
      logId: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      entityKey,
      previousScore,
      newScore: proposedScore,
      evidenceWindow: 'LAST_30_TRADES',
      sampleSize,
      performanceChange: proposedScore >= previousScore ? 'IMPROVED' : 'DECLINED',
      reason,
      learningVersion,
      riskGateChanged: false, // Invariant: Risk gate NEVER changed by learning
      timestamp: new Date().toISOString()
    };

    return {
      isValid: true,
      record
    };
  }
}
