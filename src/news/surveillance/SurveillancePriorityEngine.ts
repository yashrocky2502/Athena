/**
 * ATHENA — Phase 18 Priority Engine
 * SurveillancePriorityEngine.ts
 */

import { SurveillancePriority } from './types.ts';

export class SurveillancePriorityEngine {
  private static instance: SurveillancePriorityEngine;

  private constructor() {}

  public static getInstance(): SurveillancePriorityEngine {
    if (!SurveillancePriorityEngine.instance) {
      SurveillancePriorityEngine.instance = new SurveillancePriorityEngine();
    }
    return SurveillancePriorityEngine.instance;
  }

  public classify(
    compositeScore: number,
    catalystStatus: 'NEWS_CONFIRMED' | 'NEWS_POSSIBLE' | 'NEWS_UNRELATED' | 'NO_KNOWN_NEWS',
    hasContradictions: boolean,
    isFoEligible: boolean = true
  ): SurveillancePriority {
    if (compositeScore >= 80 && catalystStatus === 'NEWS_CONFIRMED' && !hasContradictions) {
      return 'P0_CRITICAL';
    }

    if (compositeScore >= 60) {
      return 'P1_HIGH';
    }

    if (compositeScore >= 40) {
      return 'P2_MEDIUM';
    }

    if (compositeScore >= 20) {
      return 'P3_LOW';
    }

    return 'P4_INFORMATIONAL';
  }
}
export const surveillancePriorityEngine = SurveillancePriorityEngine.getInstance();
