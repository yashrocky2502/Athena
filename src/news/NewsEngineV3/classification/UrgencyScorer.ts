/**
 * ATHENA NEWS ENGINE V3 — URGENCY SCORER
 * 
 * Computes deterministic urgency scores (0–100) based on financial event severity and publication speed requirements.
 */

import { ClassificationCategory } from './types/ClassificationTypes';

export class UrgencyScorer {
  /**
   * Calculates urgency score (0–100) based on categories and title markers.
   */
  public static calculateUrgency(categories: ClassificationCategory[], title: string): number {
    let baseUrgency = 25; // Default for general market stories

    for (const cat of categories) {
      let catScore = 30;
      switch (cat) {
        case 'RBI_POLICY':
        case 'SEBI_ACTION':
          catScore = 95;
          break;
        case 'QUARTERLY_RESULTS':
        case 'RESULT_REACTION':
          catScore = 85;
          break;
        case 'IPO':
        case 'BLOCK_DEAL':
        case 'BULK_DEAL':
          catScore = 80;
          break;
        case 'MACRO':
        case 'GDP':
        case 'CPI':
          catScore = 80;
          break;
        case 'BROKER_REPORT':
          catScore = 70;
          break;
        case 'DIVIDEND':
        case 'BONUS':
        case 'SPLIT':
        case 'BUYBACK':
        case 'MERGER':
        case 'ACQUISITION':
          catScore = 75;
          break;
        case 'ORDER_WIN':
        case 'ORDER_LOSS':
          catScore = 65;
          break;
        case 'MANAGEMENT_CHANGE':
        case 'CEO_CHANGE':
        case 'CFO_CHANGE':
        case 'RESIGNATION':
          catScore = 60;
          break;
        case 'RESULT_PREVIEW':
          catScore = 55;
          break;
        case 'GENERAL_MARKET':
          catScore = 30;
          break;
        default:
          catScore = 40;
      }

      if (catScore > baseUrgency) {
        baseUrgency = catScore;
      }
    }

    // Boost if breaking news markers exist in title
    if (/\b(breaking|flash|alert|urgent|just in)\b/i.test(title)) {
      baseUrgency = Math.min(100, baseUrgency + 10);
    }

    return Math.max(0, Math.min(100, baseUrgency));
  }
}
