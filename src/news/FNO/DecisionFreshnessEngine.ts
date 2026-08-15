import { FreshnessStatus } from './FOTypes.js';

export interface FreshnessResult {
  freshnessStatus: FreshnessStatus;
  ageInMinutes: number;
  isActionable: boolean;
  notes: string;
}

export class DecisionFreshnessEngine {
  /**
   * Calculates event-aware freshness.
   */
  public evaluateFreshness(
    publishedAt: string | number,
    category: string,
    nowTimestamp: number = Date.now()
  ): FreshnessResult {
    const pubTime = new Date(publishedAt).getTime();
    if (isNaN(pubTime)) {
      return {
        freshnessStatus: 'STALE',
        ageInMinutes: 9999,
        isActionable: false,
        notes: 'Invalid publishedAt timestamp'
      };
    }

    const ageInMinutes = Math.max(0, Math.round((nowTimestamp - pubTime) / 60000));
    const catLower = (category || '').toLowerCase();

    // Breaking news / Earnings have tighter freshness windows
    const isBreaking = catLower.includes('earnings') || catLower.includes('result') || catLower.includes('macro') || catLower.includes('f&o');

    let freshnessStatus: FreshnessStatus = 'LIVE';
    let isActionable = true;

    if (isBreaking) {
      if (ageInMinutes <= 15) {
        freshnessStatus = 'LIVE';
      } else if (ageInMinutes <= 60) {
        freshnessStatus = 'FRESH';
      } else if (ageInMinutes <= 240) {
        freshnessStatus = 'AGING';
      } else if (ageInMinutes <= 1440) {
        freshnessStatus = 'STALE';
        isActionable = false;
      } else {
        freshnessStatus = 'EXPIRED';
        isActionable = false;
      }
    } else {
      if (ageInMinutes <= 60) {
        freshnessStatus = 'LIVE';
      } else if (ageInMinutes <= 360) {
        freshnessStatus = 'FRESH';
      } else if (ageInMinutes <= 1440) {
        freshnessStatus = 'AGING';
      } else if (ageInMinutes <= 4320) {
        freshnessStatus = 'STALE';
        isActionable = false;
      } else {
        freshnessStatus = 'EXPIRED';
        isActionable = false;
      }
    }

    const notes = isActionable
      ? `Article age is ${ageInMinutes} mins (${freshnessStatus}) — Valid for decision generation`
      : `Article age is ${ageInMinutes} mins (${freshnessStatus}) — Expired/Stale for live option selling decisions`;

    return {
      freshnessStatus,
      ageInMinutes,
      isActionable,
      notes
    };
  }
}
