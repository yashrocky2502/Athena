export type FreshnessTier =
  | 'Very Fresh'
  | 'Fresh'
  | 'Recent'
  | 'Aging'
  | 'Background'
  | 'Historical';

export interface FreshnessScoreResult {
  tier: FreshnessTier;
  ageMinutes: number;
  score: number; // 0 to 20
  multiplier: number; // 0.2 to 1.0
  formattedAge: string;
}

export class FreshnessEngine {
  public static evaluate(publishedAtISO: string, nowTimeMs: number = Date.now()): FreshnessScoreResult {
    const pubTimeMs = new Date(publishedAtISO).getTime();
    if (isNaN(pubTimeMs)) {
      return {
        tier: 'Historical',
        ageMinutes: 999999,
        score: 2,
        multiplier: 0.2,
        formattedAge: 'Unknown Date',
      };
    }

    const diffMs = Math.max(0, nowTimeMs - pubTimeMs);
    const ageMinutes = Math.floor(diffMs / (60 * 1000));

    if (ageMinutes <= 10) {
      return {
        tier: 'Very Fresh',
        ageMinutes,
        score: 20,
        multiplier: 1.0,
        formattedAge: `${ageMinutes}m ago`,
      };
    }

    if (ageMinutes <= 30) {
      return {
        tier: 'Fresh',
        ageMinutes,
        score: 18,
        multiplier: 0.9,
        formattedAge: `${ageMinutes}m ago`,
      };
    }

    if (ageMinutes <= 120) {
      return {
        tier: 'Recent',
        ageMinutes,
        score: 15,
        multiplier: 0.8,
        formattedAge: `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m ago`,
      };
    }

    if (ageMinutes <= 360) { // 6 hours
      return {
        tier: 'Aging',
        ageMinutes,
        score: 11,
        multiplier: 0.65,
        formattedAge: `${Math.floor(ageMinutes / 60)}h ago`,
      };
    }

    if (ageMinutes <= 1440) { // 24 hours
      return {
        tier: 'Background',
        ageMinutes,
        score: 7,
        multiplier: 0.45,
        formattedAge: `${Math.floor(ageMinutes / 60)}h ago`,
      };
    }

    const days = Math.floor(ageMinutes / 1440);
    return {
      tier: 'Historical',
      ageMinutes,
      score: 3,
      multiplier: 0.25,
      formattedAge: `${days}d ago`,
    };
  }
}
