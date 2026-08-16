export type UrgencyLevel = 'BREAKING' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BACKGROUND';

export interface BreakingNewsResult {
  urgency: UrgencyLevel;
  isBreaking: boolean;
  breakingReason?: string;
  duplicateAlertSuppressed: boolean;
}

export class BreakingNewsDetector {
  private static highImpactKeywords = [
    'rbi', 'sebi', 'rate hike', 'rate cut', 'earnings beat', 'earnings miss',
    'resignation', 'ceo resigns', 'managing director resigns', 'raid', 'investigation',
    'm&a', 'merger', 'acquisition', 'order win', 'order cancellation', 'rating downgrade',
    'war', 'sanction', 'emergency', 'circuit limit'
  ];

  public static detect(
    title: string,
    body: string,
    publishedAtISO: string,
    isSyndicatedDuplicate: boolean = false,
    nowTimeMs: number = Date.now()
  ): BreakingNewsResult {
    if (isSyndicatedDuplicate) {
      return {
        urgency: 'MEDIUM',
        isBreaking: false,
        duplicateAlertSuppressed: true,
        breakingReason: 'Syndicated duplicate version suppressed from breaking alert triggers.',
      };
    }

    const text = `${title} ${body}`.toLowerCase();
    const pubMs = new Date(publishedAtISO).getTime();
    const ageMinutes = isNaN(pubMs) ? 999 : Math.floor((nowTimeMs - pubMs) / 60000);

    let matchCount = 0;
    let matchedReason = '';

    for (const kw of this.highImpactKeywords) {
      if (text.includes(kw)) {
        matchCount++;
        matchedReason = `High-impact keyword '${kw}' identified in headline/body.`;
      }
    }

    // BREAKING requires both recent publication (<= 30 mins) and high impact keyword
    if (ageMinutes <= 30 && matchCount >= 1) {
      return {
        urgency: 'BREAKING',
        isBreaking: true,
        breakingReason: matchedReason,
        duplicateAlertSuppressed: false,
      };
    }

    if (matchCount >= 2 || (ageMinutes <= 120 && matchCount >= 1)) {
      return {
        urgency: 'HIGH',
        isBreaking: false,
        duplicateAlertSuppressed: false,
      };
    }

    if (ageMinutes <= 360) {
      return {
        urgency: 'MEDIUM',
        isBreaking: false,
        duplicateAlertSuppressed: false,
      };
    }

    if (ageMinutes <= 1440) {
      return {
        urgency: 'LOW',
        isBreaking: false,
        duplicateAlertSuppressed: false,
      };
    }

    return {
      urgency: 'BACKGROUND',
      isBreaking: false,
      duplicateAlertSuppressed: false,
    };
  }
}
