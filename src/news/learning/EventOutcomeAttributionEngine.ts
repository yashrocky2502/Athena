/**
 * ATHENA NEWS ENGINE — PHASE 16
 * EventOutcomeAttributionEngine.ts
 * 
 * Event Outcome Attribution Engine.
 * Formulates multidimensional attribution along the complete transmission chain:
 * NEWS -> SIGNAL -> STRATEGY -> PORTFOLIO -> EXECUTION -> OUTCOME.
 * Isolates exact performance drivers and prevents misclassification (such as labeling a strategy failure as a bad news signal).
 */

export interface ComponentQualityScore {
  component: 'SIGNAL' | 'STRATEGY' | 'PORTFOLIO' | 'EXECUTION' | 'REGIME' | 'EXTERNAL_SHOCK';
  score: number;                  // 0 to 100
  contributionINR: number;
  qualityRating: 'EXCELLENT' | 'ADEQUATE' | 'SUBOPTIMAL' | 'FAILING';
  notes: string;
}

export interface CompleteAttributionReport {
  attributionId: string;
  newsId: string;
  symbol: string;
  realizedPnLINR: number;
  isSuccess: boolean;
  components: ComponentQualityScore[];
  dominantDriver: string;
  reconciliationSummary: string;
  generatedAt: string;
}

export class EventOutcomeAttributionEngine {
  private static reports: Map<string, CompleteAttributionReport> = new Map();

  /**
   * Generates a complete outcome attribution report by isolating and scoring every step in the chain.
   */
  public static calculateCompleteAttribution(input: {
    newsId: string;
    symbol: string;
    realizedPnLINR: number;
    signalAccuracyPct: number;       // e.g. sentiment score vs day 1 direction
    strategyEdgePct: number;         // e.g. did entry catch MFE?
    portfolioSizeFactor: number;     // e.g. ratio of sizing to max limit
    executionSlippageINR: number;    // negative is high slippage cost
    regimeAlignmentPct: number;      // strategy/regime compatibility score
    externalShockINR?: number;       // external news impact
  }): CompleteAttributionReport {
    const isSuccess = input.realizedPnLINR > 0;
    const slippagePenalty = Math.abs(input.executionSlippageINR);

    // Calculate component scores and contributions
    const signalScore = input.signalAccuracyPct;
    const strategyScore = input.strategyEdgePct;
    const portfolioScore = Math.max(20, Math.min(100, 100 - Math.abs(1 - input.portfolioSizeFactor) * 50));
    
    const maxSlippageLimit = 5000;
    const executionScore = Math.max(0, Math.min(100, 100 - (slippagePenalty / maxSlippageLimit) * 100));
    const regimeScore = input.regimeAlignmentPct;
    const shockScore = input.externalShockINR ? (input.externalShockINR < 0 ? 30 : 90) : 100;

    const components: ComponentQualityScore[] = [
      {
        component: 'SIGNAL',
        score: signalScore,
        contributionINR: Math.round(input.realizedPnLINR * 0.35 * (signalScore / 100)),
        qualityRating: this.getRating(signalScore),
        notes: `Semantic classification accuracy at ${signalScore}%.`
      },
      {
        component: 'STRATEGY',
        score: strategyScore,
        contributionINR: Math.round(input.realizedPnLINR * 0.25 * (strategyScore / 100)),
        qualityRating: this.getRating(strategyScore),
        notes: `Parameter set / technical entry alignment rated at ${strategyScore}%.`
      },
      {
        component: 'PORTFOLIO',
        score: portfolioScore,
        contributionINR: Math.round(input.realizedPnLINR * 0.15 * (portfolioScore / 100)),
        qualityRating: this.getRating(portfolioScore),
        notes: `Position sizing and constraint matching efficiency score: ${portfolioScore}%.`
      },
      {
        component: 'EXECUTION',
        score: executionScore,
        contributionINR: Math.round(input.executionSlippageINR),
        qualityRating: this.getRating(executionScore),
        notes: `Slippage cost of ${input.executionSlippageINR} INR.`
      },
      {
        component: 'REGIME',
        score: regimeScore,
        contributionINR: Math.round(input.realizedPnLINR * 0.15 * (regimeScore / 100)),
        qualityRating: this.getRating(regimeScore),
        notes: `Compatibility alignment with discovered regime score: ${regimeScore}%.`
      },
      {
        component: 'EXTERNAL_SHOCK',
        score: shockScore,
        contributionINR: Math.round(input.externalShockINR || 0),
        qualityRating: this.getRating(shockScore),
        notes: input.externalShockINR ? `Exogenous market impact of ${input.externalShockINR} INR.` : 'No significant external shock detected.'
      }
    ];

    // Determine the dominant driver
    let dominantDriver = 'SIGNAL';
    let maxAbsContribution = 0;
    for (const comp of components) {
      if (Math.abs(comp.contributionINR) > maxAbsContribution) {
        maxAbsContribution = Math.abs(comp.contributionINR);
        dominantDriver = comp.component;
      }
    }

    // Guard against wrong classification: e.g. Good Signal + Bad Strategy
    let reconciliationSummary = `Attribution confirms successful transmission with ${dominantDriver} as key driver.`;
    if (!isSuccess && signalScore > 75 && strategyScore < 50) {
      reconciliationSummary = 'CRITICAL DIAGNOSIS: Signal was highly accurate, but Strategy rules or parameter boundaries caused overall loss.';
    } else if (!isSuccess && signalScore < 50) {
      reconciliationSummary = 'CRITICAL DIAGNOSIS: Semantic signaling error. Classification did not reflect true fundamental pressure.';
    }

    const report: CompleteAttributionReport = {
      attributionId: `ATT_${input.newsId}_${Date.now()}`,
      newsId: input.newsId,
      symbol: input.symbol,
      realizedPnLINR: input.realizedPnLINR,
      isSuccess,
      components,
      dominantDriver,
      reconciliationSummary,
      generatedAt: new Date().toISOString()
    };

    this.reports.set(report.attributionId, report);
    return report;
  }

  private static getRating(score: number): 'EXCELLENT' | 'ADEQUATE' | 'SUBOPTIMAL' | 'FAILING' {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 65) return 'ADEQUATE';
    if (score >= 45) return 'SUBOPTIMAL';
    return 'FAILING';
  }

  public static getReport(id: string): CompleteAttributionReport | undefined {
    return this.reports.get(id);
  }

  public static getAllReports(): CompleteAttributionReport[] {
    return Array.from(this.reports.values());
  }

  public static clear(): void {
    this.reports.clear();
  }
}
