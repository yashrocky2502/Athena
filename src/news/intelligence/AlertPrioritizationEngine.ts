export type AlertPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface AlertPriorityResult {
  priority: AlertPriority;
  priorityLabel: string;
  shouldAlertUser: boolean;
  isDuplicateSuppressed: boolean;
  reason: string;
}

export class AlertPrioritizationEngine {
  public static evaluate(
    title: string,
    body: string,
    urgency: string,
    relevanceScore: number,
    isFOEligible: boolean,
    isSyndicatedDuplicate: boolean = false
  ): AlertPriorityResult {
    if (isSyndicatedDuplicate) {
      return {
        priority: 'P5',
        priorityLabel: 'P5 — Syndicated Duplicate',
        shouldAlertUser: false,
        isDuplicateSuppressed: true,
        reason: 'Duplicate alert suppressed for syndicated article.',
      };
    }

    const text = `${title} ${body}`.toLowerCase();

    // P0: Emergency / Macro
    if (text.includes('rbi') || text.includes('circuit limit') || text.includes('war') || text.includes('emergency')) {
      return {
        priority: 'P0',
        priorityLabel: 'P0 — Market-Wide Emergency',
        shouldAlertUser: true,
        isDuplicateSuppressed: false,
        reason: 'Critical macro, regulatory, or central bank policy event.',
      };
    }

    // P1: Major Index / Sector
    if (text.includes('sebi') || text.includes('nifty') || text.includes('banknifty') || urgency === 'BREAKING') {
      return {
        priority: 'P1',
        priorityLabel: 'P1 — Major Index / Sector Event',
        shouldAlertUser: true,
        isDuplicateSuppressed: false,
        reason: 'Significant index, sector, or market structure movement.',
      };
    }

    // P2: Major F&O / Company
    if (isFOEligible && (text.includes('earnings') || text.includes('resignation') || text.includes('m&a'))) {
      return {
        priority: 'P2',
        priorityLabel: 'P2 — Major F&O / Company Event',
        shouldAlertUser: true,
        isDuplicateSuppressed: false,
        reason: 'Price-sensitive corporate action for high-volume F&O derivative security.',
      };
    }

    // P3: Important Intelligence
    if (relevanceScore >= 75) {
      return {
        priority: 'P3',
        priorityLabel: 'P3 — Important Market Intelligence',
        shouldAlertUser: true,
        isDuplicateSuppressed: false,
        reason: 'High relevance market news item.',
      };
    }

    // P4: Normal News
    if (relevanceScore >= 50) {
      return {
        priority: 'P4',
        priorityLabel: 'P4 — Normal News',
        shouldAlertUser: false,
        isDuplicateSuppressed: false,
        reason: 'Standard market update.',
      };
    }

    // P5: Background
    return {
      priority: 'P5',
      priorityLabel: 'P5 — Background',
      shouldAlertUser: false,
      isDuplicateSuppressed: false,
      reason: 'Low impact background narrative.',
    };
  }
}
