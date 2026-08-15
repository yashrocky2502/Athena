/**
 * ATHENA NEWS ENGINE V3 — PARAGRAPH SIMILARITY CALCULATOR
 * 
 * Computes paragraph-level and sentence-level similarity across articles using
 * exact paragraph hashes, sentence hash intersection, and Jaccard token overlap.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';

export class ParagraphSimilarity {
  /**
   * Calculates structural paragraph similarity score (0.0 to 1.0) between two NormalizedDocuments.
   */
  public static calculate(docA: NormalizedDocument, docB: NormalizedDocument): number {
    if (!docA || !docB) return 0;

    // 1. Exact paragraph hash intersection
    const hashesA = new Set(docA.hashes.paragraphHashes);
    const hashesB = new Set(docB.hashes.paragraphHashes);

    if (hashesA.size > 0 && hashesB.size > 0) {
      let commonHashes = 0;
      hashesA.forEach(h => {
        if (hashesB.has(h)) commonHashes++;
      });
      const hashOverlapRatio = commonHashes / Math.min(hashesA.size, hashesB.size);
      if (hashOverlapRatio >= 0.8) return 1.0; // Almost identical paragraphs
    }

    // 2. Sentence hash intersection
    const sentHashesA = new Set(docA.hashes.sentenceHashes);
    const sentHashesB = new Set(docB.hashes.sentenceHashes);
    let commonSentHashes = 0;
    if (sentHashesA.size > 0 && sentHashesB.size > 0) {
      sentHashesA.forEach(sh => {
        if (sentHashesB.has(sh)) commonSentHashes++;
      });
      const sentOverlapRatio = commonSentHashes / Math.min(sentHashesA.size, sentHashesB.size);
      if (sentOverlapRatio >= 0.7) return 0.95;
    }

    // 3. Text-level Jaccard paragraph comparison
    const textParasA = docA.paragraphs.map(p => p.text);
    const textParasB = docB.paragraphs.map(p => p.text);

    let maxMatchSum = 0;
    let comparisons = 0;

    for (const pa of textParasA) {
      let bestMatch = 0;
      for (const pb of textParasB) {
        const sim = this.jaccardTextSimilarity(pa, pb);
        if (sim > bestMatch) bestMatch = sim;
      }
      maxMatchSum += bestMatch;
      comparisons++;
    }

    const avgParagraphMatch = comparisons > 0 ? maxMatchSum / comparisons : 0;

    return Math.min(1.0, Math.max(0.0, avgParagraphMatch));
  }

  private static jaccardTextSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    tokensA.forEach(t => {
      if (tokensB.has(t)) intersection++;
    });

    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
