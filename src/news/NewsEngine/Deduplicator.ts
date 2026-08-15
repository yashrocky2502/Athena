import { NewsItem } from '../models/NewsItem';
import { EventDeduplicationEngine } from './EventDeduplicationEngine';
import { QualityAndReliabilityEngine } from './QualityAndReliabilityEngine';

export class Deduplicator {
  /**
   * Calculates similarity ratio between two strings (0 to 1)
   */
  public static calculateTitleSimilarity(str1: string, str2: string): number {
    return EventDeduplicationEngine.calculateTitleSimilarity(str1, str2);
  }

  /**
   * Deduplicates a list of news items by ID, URL, headline similarity, company tickers,
   * and tier prioritization using QualityAndReliabilityEngine & EventDeduplicationEngine.
   */
  public static deduplicateItems(items: NewsItem[]): NewsItem[] {
    return QualityAndReliabilityEngine.getInstance().deduplicateAndEnhanceArticles(items);
  }
}

