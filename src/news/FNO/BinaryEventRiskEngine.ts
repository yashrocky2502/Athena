import { EventRiskLevel } from './FOTypes.js';

export interface BinaryEventAnalysis {
  riskLevel: EventRiskLevel;
  isBinaryEvent: boolean;
  eventCategory: string;
  reasons: string[];
  recommendedAction: 'PROHIBIT_TRADE' | 'FORCE_WAIT' | 'REQUIRE_HEDGE' | 'ALLOW_NORMAL';
}

export class BinaryEventRiskEngine {
  /**
   * Evaluates binary event risk based on article category, headline, and body text.
   */
  public evaluateRisk(category: string, title: string, body: string): BinaryEventAnalysis {
    const textLower = `${title} ${body}`.toLowerCase();
    const catLower = (category || '').toLowerCase();
    const reasons: string[] = [];

    // 1. Check for EXTREME / BINARY Event Risk
    const isImminentEarnings = (textLower.includes('results today') || textLower.includes('board meeting today') || textLower.includes('earnings release today') || textLower.includes('q1 results today') || textLower.includes('q2 results today') || textLower.includes('q3 results today') || textLower.includes('q4 results today')) && (textLower.includes('underway') || textLower.includes('meeting') || textLower.includes('today'));
    const isMajorLitigation = textLower.includes('supreme court verdict') || textLower.includes('insolvency proceeding') || textLower.includes('nclt order today') || textLower.includes('court ruling today');
    const isUnscheduledPolicy = textLower.includes('emergency rbi rate') || textLower.includes('unscheduled mpc') || textLower.includes('sudden policy rate');

    if (isImminentEarnings || isMajorLitigation || isUnscheduledPolicy) {
      if (isImminentEarnings) reasons.push('Imminent board meeting / quarterly earnings release today');
      if (isMajorLitigation) reasons.push('Imminent court verdict / NCLT insolvency ruling');
      if (isUnscheduledPolicy) reasons.push('Unscheduled monetary policy action');

      return {
        riskLevel: 'EXTREME',
        isBinaryEvent: true,
        eventCategory: 'IMMINENT_BINARY_EVENT',
        reasons,
        recommendedAction: 'PROHIBIT_TRADE'
      };
    }

    // 2. Check for HIGH Event Risk (Pending / Upcoming Binary Events)
    const isPostResultsAnnouncement = textLower.includes('reported') || textLower.includes('reports') || textLower.includes('jumps') || textLower.includes('falls') || textLower.includes('beats estimates') || textLower.includes('misses estimates') || textLower.includes('net loss') || textLower.includes('expands') || textLower.includes('q1 net profit') || textLower.includes('q2 net profit') || textLower.includes('q3 net profit') || textLower.includes('q4 net profit') || textLower.includes('q1 net loss') || textLower.includes('q2 net loss') || textLower.includes('q3 net loss') || textLower.includes('q4 net loss');
    const isScheduledEarnings = !isPostResultsAnnouncement && (catLower.includes('quarterly') || catLower.includes('earnings') || textLower.includes('q1 results today') || textLower.includes('q2 results today') || textLower.includes('board to meet on'));
    const isMacroPolicy = catLower.includes('macro') || textLower.includes('rbi policy') || textLower.includes('fed decision') || textLower.includes('repo rate decision') || textLower.includes('fomc');
    const isMergerApproval = catLower.includes('m&a') || textLower.includes('merger approval') || textLower.includes('nclt approves merger') || textLower.includes('acquires') || textLower.includes('acquisition');

    if (isScheduledEarnings || isMacroPolicy || isMergerApproval) {
      if (isScheduledEarnings) reasons.push('Scheduled quarterly earnings / board meeting event');
      if (isMacroPolicy) reasons.push('Macroeconomic / RBI Monetary Policy event');
      if (isMergerApproval) reasons.push('Major corporate merger / acquisition approval');

      return {
        riskLevel: 'HIGH',
        isBinaryEvent: true,
        eventCategory: 'SCHEDULED_BINARY_EVENT',
        reasons,
        recommendedAction: 'FORCE_WAIT'
      };
    }

    // 3. Check for MEDIUM Event Risk
    const isManagementResignation = textLower.includes('cfo resigns') || textLower.includes('ceo resigns') || textLower.includes('md resigns') || textLower.includes('management change');
    const isBonusSplitIssue = textLower.includes('bonus issue') || textLower.includes('stock split') || textLower.includes('buyback');
    const isRegulatoryPenalty = catLower.includes('regulatory') || textLower.includes('sebi penalty') || textLower.includes('usfda eir') || textLower.includes('inspection observation');

    if (isManagementResignation || isBonusSplitIssue || isRegulatoryPenalty) {
      if (isManagementResignation) reasons.push('Key management personnel change / executive resignation');
      if (isBonusSplitIssue) reasons.push('Corporate action (Bonus/Split/Buyback)');
      if (isRegulatoryPenalty) reasons.push('Regulatory enforcement / inspection update');

      return {
        riskLevel: 'MEDIUM',
        isBinaryEvent: false,
        eventCategory: 'CORPORATE_DEVELOPMENT',
        reasons,
        recommendedAction: 'REQUIRE_HEDGE'
      };
    }

    // 4. LOW Event Risk
    return {
      riskLevel: 'LOW',
      isBinaryEvent: false,
      eventCategory: 'STANDARD_MARKET_NEWS',
      reasons: ['Standard news event with no binary event volatility expansion expected'],
      recommendedAction: 'ALLOW_NORMAL'
    };
  }
}
