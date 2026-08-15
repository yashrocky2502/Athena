/**
 * ATHENA NEWS ENGINE V3 — VERIFICATION ENGINE
 * 
 * Computes publisher trust scores, official filing confirmations, and multi-source verification weights.
 * Official exchange filings (NSE/BSE/Company Filings) provide the highest trust level.
 */

import { V3PublisherId } from '../types/V3Types';
import { VerificationScore, TrustLevel } from './types/DeduplicationTypes';

export class VerificationEngine {
  // Publisher trust weight configuration (0 - 100)
  private static readonly PUBLISHER_WEIGHTS: Record<string, number> = {
    'NSE': 100,
    'BSE': 100,
    'COMPANY_FILING': 100,
    'INVESTOR_RELATIONS': 95,
    'SEBI': 95,
    'RBI': 95,
    'REUTERS': 90,
    'ECONOMIC_TIMES': 85,
    'MONEYCONTROL': 85,
    'LIVEMINT': 85,
    'BUSINESS_STANDARD': 85,
    'CNBC_TV18': 80,
    'PIB': 80,
    'GOOGLE_NEWS_RSS': 60,
    'OTHER_PUBLISHER': 50
  };

  /**
   * Computes the complete VerificationScore for a list of publisher IDs.
   */
  public static calculateVerificationScore(publisherIds: V3PublisherId[]): VerificationScore {
    const uniqueIds = Array.from(new Set(publisherIds));
    const breakdown: Record<string, number> = {};

    let hasOfficialExchangeFiling = false;
    let hasTier1Media = false;
    let maxPublisherWeight = 0;

    uniqueIds.forEach(id => {
      const weight = this.PUBLISHER_WEIGHTS[id] || 50;
      breakdown[id] = weight;

      if (id === 'NSE' || id === 'BSE' || id === 'COMPANY_FILING' || id === 'INVESTOR_RELATIONS') {
        hasOfficialExchangeFiling = true;
      }

      if (['REUTERS', 'ECONOMIC_TIMES', 'MONEYCONTROL', 'LIVEMINT', 'BUSINESS_STANDARD'].includes(id)) {
        hasTier1Media = true;
      }

      if (weight > maxPublisherWeight) {
        maxPublisherWeight = weight;
      }
    });

    // Score Calculation:
    // Base = highest publisher weight
    let score = maxPublisherWeight;

    // Multi-source bonus (+10 per additional publisher up to +30)
    if (uniqueIds.length > 1) {
      score += Math.min(30, (uniqueIds.length - 1) * 10);
    }

    // Special combination bonus: Reuters + Official Exchange Filing = 100
    if (hasOfficialExchangeFiling && hasTier1Media) {
      score = Math.max(score, 98);
    }

    if (hasOfficialExchangeFiling && uniqueIds.includes('REUTERS')) {
      score = 100;
    }

    const finalScore = Math.min(100, Math.max(0, score));

    // Resolve Trust Level
    let trustLevel: TrustLevel = 'UNVERIFIED';
    if (hasOfficialExchangeFiling) {
      trustLevel = 'EXCHANGE_CONFIRMED';
    } else if (uniqueIds.length >= 2 && hasTier1Media) {
      trustLevel = 'MULTI_SOURCE_VERIFIED';
    } else if (uniqueIds.length >= 1) {
      trustLevel = 'SINGLE_SOURCE';
    }

    return {
      score: finalScore,
      trustLevel,
      verifiedSources: uniqueIds,
      publisherCount: uniqueIds.length,
      hasOfficialExchangeFiling,
      hasTier1Media,
      breakdown
    };
  }
}
