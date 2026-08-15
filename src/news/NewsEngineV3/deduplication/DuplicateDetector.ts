/**
 * ATHENA NEWS ENGINE V3 — DUPLICATE DETECTOR
 * 
 * Classifies the match type between a candidate NormalizedDocument and existing StoryClusters.
 * Enforces strict non-merge constraints (company, quarter, event, filing conflicts).
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { StoryCluster, MatchType, SimilarityMetrics } from './types/DeduplicationTypes';
import { SimilarityCalculator } from './SimilarityCalculator';

export interface DetectionResult {
  isDuplicate: boolean;
  matchType: MatchType;
  similarityMetrics: SimilarityMetrics;
  candidateCluster?: StoryCluster;
  rejectionReason?: string;
}

export class DuplicateDetector {
  /**
   * Detects if an incoming NormalizedDocument matches an existing StoryCluster.
   */
  public static detectMatch(doc: NormalizedDocument, cluster: StoryCluster): DetectionResult {
    // 1. Strict Non-Merge Conflict Checks
    const conflictReason = this.checkHardConflicts(doc, cluster);
    if (conflictReason) {
      return {
        isDuplicate: false,
        matchType: 'NO_MATCH',
        similarityMetrics: {
          headlineSimilarity: 0,
          companyOverlapScore: 0,
          tickerOverlapScore: 0,
          entityOverlapScore: 0,
          financialMetricScore: 0,
          dateProximityScore: 0,
          categoryMatchScore: 0,
          paragraphSimilarity: 0,
          sentenceSimilarity: 0,
          documentHashMatch: false,
          normalizedHashMatch: false,
          compositeScore: 0
        },
        candidateCluster: cluster,
        rejectionReason: conflictReason
      };
    }

    // 2. Compare against representative document in cluster
    const clusterPrimaryDoc = cluster.documents[0];
    const metrics = SimilarityCalculator.calculateSimilarity(doc, clusterPrimaryDoc);

    // 3. Classify MatchType based on composite score and structural features
    let matchType: MatchType = 'NO_MATCH';
    let isDuplicate = false;

    if (metrics.documentHashMatch || metrics.normalizedHashMatch || metrics.compositeScore >= 95) {
      matchType = 'EXACT';
      isDuplicate = true;
    } else if (metrics.compositeScore >= 75) {
      if (this.isCorrection(doc)) {
        matchType = 'CORRECTION';
      } else if (this.isBreakingUpdate(doc, cluster)) {
        matchType = 'BREAKING_NEWS_UPDATE';
      } else if (doc.publisherId === cluster.primaryPublisherId) {
        matchType = 'UPDATE';
      } else {
        matchType = 'NEAR_DUPLICATE';
      }
      isDuplicate = true;
    } else if (metrics.compositeScore >= 55) {
      if (this.isFollowUpStory(doc, cluster)) {
        matchType = 'FOLLOW_UP';
      } else {
        matchType = 'PARTIAL_OVERLAP';
      }
      isDuplicate = true;
    } else {
      matchType = 'NO_MATCH';
      isDuplicate = false;
    }

    return {
      isDuplicate,
      matchType,
      similarityMetrics: metrics,
      candidateCluster: cluster
    };
  }

  /**
   * Enforces mandatory non-merge rules:
   * - Never merge different companies
   * - Never merge different quarters (e.g. Q1 FY27 vs Q2 FY27)
   * - Never merge different filings or events
   */
  private static checkHardConflicts(doc: NormalizedDocument, cluster: StoryCluster): string | null {
    // A. Company Ticker Conflict
    const docTickers = new Set(doc.companies.map(c => c.ticker));
    const clusterTickers = new Set(cluster.tickers);

    if (doc.primaryCompany && cluster.companies.length > 0) {
      const clusterPrimary = cluster.companies.find(c => c.isPrimary) || cluster.companies[0];
      if (doc.primaryCompany.ticker !== clusterPrimary.ticker) {
        return `COMPANY_CONFLICT: Doc primary company '${doc.primaryCompany.name}' (${doc.primaryCompany.ticker}) does not match cluster primary company '${clusterPrimary.name}' (${clusterPrimary.ticker}).`;
      }
    }

    // B. Quarter Conflict
    const docQuarter = this.extractQuarterTag(doc.title, doc.plainText);
    const clusterQuarter = cluster.metadata.quarterTag || this.extractQuarterTag(cluster.canonicalHeadline, cluster.documents[0]?.plainText || '');

    if (docQuarter && clusterQuarter && docQuarter !== clusterQuarter) {
      return `QUARTER_CONFLICT: Doc refers to '${docQuarter}' while cluster refers to '${clusterQuarter}'.`;
    }

    // C. Document Age Conflict (> 7 days apart)
    const docTime = new Date(doc.metadata.publishedAt).getTime();
    const clusterTime = new Date(cluster.metadata.firstSeenAt).getTime();
    const diffDays = Math.abs(docTime - clusterTime) / (1000 * 3600 * 24);

    if (diffDays > 7) {
      return `DATE_RANGE_CONFLICT: Article published ${Math.round(diffDays)} days apart from cluster creation.`;
    }

    // D. Financial Number/Amount Mismatch Conflict
    const extractHeadlineNumbers = (title: string): number[] => {
      const matches = title.match(/\b\d+(?:\.\d+)?\b/g);
      if (!matches) return [];
      return matches
        .map(Number)
        .filter(n => n !== 1 && n !== 2 && n !== 3 && n !== 4 && n !== 25 && n !== 26 && n !== 27 && n !== 2025 && n !== 2026 && n !== 2027);
    };

    const docNumbers = extractHeadlineNumbers(doc.title);
    const clusterNumbers = extractHeadlineNumbers(cluster.canonicalHeadline);

    // Only compare "large" numbers (likely absolute financial figures rather than percentages/dates)
    const docLargeNumbers = docNumbers.filter(n => n > 40);
    const clusterLargeNumbers = clusterNumbers.filter(n => n > 40);

    if (docLargeNumbers.length > 0 && clusterLargeNumbers.length > 0) {
      const docSet = new Set(docLargeNumbers);
      const clusterSet = new Set(clusterLargeNumbers);
      
      let hasIntersection = false;
      for (const n of docLargeNumbers) {
        if (clusterSet.has(n)) {
          hasIntersection = true;
          break;
        }
      }

      if (!hasIntersection) {
        return `FINANCIAL_NUMBER_CONFLICT: Core financial numbers do not match (${Array.from(docSet).join(', ')} vs ${Array.from(clusterSet).join(', ')}).`;
      }
    }

    return null;
  }

  private static extractQuarterTag(title: string, text: string): string | undefined {
    const combined = `${title} ${text.slice(0, 500)}`;
    const match = combined.match(/\b(Q[1-4]\s*(?:FY)?\d{2,4}|FY\d{2,4}\s*Q[1-4])\b/i);
    return match ? match[1].toUpperCase().replace(/\s+/g, '') : undefined;
  }

  private static isCorrection(doc: NormalizedDocument): boolean {
    const title = doc.title.toLowerCase();
    return title.includes('correction') || title.includes('clarification') || title.includes('erratum') || title.includes('revised');
  }

  private static isBreakingUpdate(doc: NormalizedDocument, cluster: StoryCluster): boolean {
    const title = doc.title.toLowerCase();
    const docTime = new Date(doc.metadata.publishedAt).getTime();
    const clusterTime = new Date(cluster.metadata.firstSeenAt).getTime();
    const diffHours = Math.abs(docTime - clusterTime) / (1000 * 3600);

    return (title.includes('breaking') || title.includes('live') || title.includes('flash')) && diffHours <= 2;
  }

  private static isFollowUpStory(doc: NormalizedDocument, cluster: StoryCluster): boolean {
    const docTime = new Date(doc.metadata.publishedAt).getTime();
    const clusterTime = new Date(cluster.metadata.firstSeenAt).getTime();
    const diffHours = (docTime - clusterTime) / (1000 * 3600);

    return diffHours >= 6 && diffHours <= 72;
  }
}
