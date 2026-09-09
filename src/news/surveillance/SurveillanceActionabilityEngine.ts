/**
 * ATHENA — Phase 18 Actionability Engine
 * SurveillanceActionabilityEngine.ts
 */

import { SurveillanceActionability } from './types.ts';

export class SurveillanceActionabilityEngine {
  private static instance: SurveillanceActionabilityEngine;

  private constructor() {}

  public static getInstance(): SurveillanceActionabilityEngine {
    if (!SurveillanceActionabilityEngine.instance) {
      SurveillanceActionabilityEngine.instance = new SurveillanceActionabilityEngine();
    }
    return SurveillanceActionabilityEngine.instance;
  }

  public determine(
    compositeScore: number,
    hasCriticalContradictions: boolean,
    liquidityShock: boolean
  ): SurveillanceActionability {
    if (hasCriticalContradictions || liquidityShock) {
      return 'NO_TRADE';
    }

    if (compositeScore >= 75) {
      return 'TRADEABLE'; // Evidence is extremely robust, pass downstream
    }

    if (compositeScore >= 55) {
      return 'CONDITIONAL';
    }

    return 'WATCH';
  }
}
export const surveillanceActionabilityEngine = SurveillanceActionabilityEngine.getInstance();
