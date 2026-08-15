/**
 * ATHENA NEWS ENGINE V3 — SIMILARITY CALCULATOR
 * 
 * Multi-dimensional similarity scoring engine combining headline, entity, paragraph,
 * financial metric, date proximity, category, and document hash comparisons.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { SimilarityMetrics } from './types/DeduplicationTypes';
import { HeadlineSimilarity } from './HeadlineSimilarity';
import { ParagraphSimilarity } from './ParagraphSimilarity';
import { EntityMatcher } from './EntityMatcher';

export class SimilarityCalculator {
  /**
   * Computes comprehensive SimilarityMetrics between two NormalizedDocuments.
   */
  public static calculateSimilarity(docA: NormalizedDocument, docB: NormalizedDocument): SimilarityMetrics {
    // 1. Document Hash & Normalized Hash Exact Matches
    const documentHashMatch = docA.hashes.rawHash === docB.hashes.rawHash;
    const normalizedHashMatch = docA.hashes.normalizedHash === docB.hashes.normalizedHash;

    if (documentHashMatch || normalizedHashMatch) {
      return {
        headlineSimilarity: 1.0,
        companyOverlapScore: 1.0,
        tickerOverlapScore: 1.0,
        entityOverlapScore: 1.0,
        financialMetricScore: 1.0,
        dateProximityScore: 1.0,
        categoryMatchScore: 1.0,
        paragraphSimilarity: 1.0,
        sentenceSimilarity: 1.0,
        documentHashMatch: true,
        normalizedHashMatch: true,
        compositeScore: 100
      };
    }

    // 2. Headline Similarity
    const headlineSimilarity = HeadlineSimilarity.calculate(docA.title, docB.title);

    // 3. Paragraph & Sentence Similarity
    const paragraphSimilarity = ParagraphSimilarity.calculate(docA, docB);
    const sentenceSimilarity = paragraphSimilarity; // Derived structural score

    // 4. Entity & Company Matching
    const entityResult = EntityMatcher.matchEntities(docA, docB);

    // 5. Date Proximity Score
    const dateA = new Date(docA.metadata.publishedAt).getTime();
    const dateB = new Date(docB.metadata.publishedAt).getTime();
    const diffHours = Math.abs(dateA - dateB) / (1000 * 3600);

    let dateProximityScore = 1.0;
    if (diffHours > 72) {
      dateProximityScore = 0.1; // Articles > 3 days apart unlikely to be same event cluster
    } else if (diffHours > 24) {
      dateProximityScore = 0.5;
    } else if (diffHours > 12) {
      dateProximityScore = 0.8;
    }

    // 6. Category Match Score
    const categoryMatchScore = (docA.category && docB.category && docA.category.toLowerCase() === docB.category.toLowerCase()) ? 1.0 : 0.7;

    // 7. Calculate Composite Weighted Score (0 to 100)
    let composite = 0;

    if (entityResult.hasCompanyConflict) {
      // Hard penalty for company conflict!
      composite = headlineSimilarity * 30; // Max ~30 if different primary companies
    } else {
      composite = (
        (headlineSimilarity * 35) +
        (entityResult.entityOverlapScore * 25) +
        (paragraphSimilarity * 20) +
        (dateProximityScore * 10) +
        (categoryMatchScore * 10)
      );
    }

    const compositeScore = Math.round(Math.min(100, Math.max(0, composite)));

    return {
      headlineSimilarity,
      companyOverlapScore: entityResult.companyOverlapScore,
      tickerOverlapScore: entityResult.tickerOverlapScore,
      entityOverlapScore: entityResult.entityOverlapScore,
      financialMetricScore: entityResult.financialMetricScore,
      dateProximityScore,
      categoryMatchScore,
      paragraphSimilarity,
      sentenceSimilarity,
      documentHashMatch,
      normalizedHashMatch,
      compositeScore
    };
  }
}
