/**
 * ATHENA NEWS ENGINE V3 — HEADLINE SIMILARITY CALCULATOR
 * 
 * Financial headline matching using n-gram token overlap, Jaccard index,
 * key entity alignment, metric matching, and Levenshtein distance.
 */

export class HeadlineSimilarity {
  /**
   * Calculates similarity score (0.0 to 1.0) between two news headlines.
   */
  public static calculate(headlineA: string, headlineB: string): number {
    if (!headlineA || !headlineB) return 0;

    const normA = this.normalizeHeadline(headlineA);
    const normB = this.normalizeHeadline(headlineB);

    if (normA === normB) return 1.0;

    // 1. Token sets and Jaccard similarity
    const tokensA = this.tokenize(normA);
    const tokensB = this.tokenize(normB);

    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const jaccard = this.jaccardSimilarity(tokensA, tokensB);

    // 2. Bigram overlap
    const bigramsA = this.getNGrams(tokensA, 2);
    const bigramsB = this.getNGrams(tokensB, 2);
    const bigramSim = this.jaccardSimilarity(bigramsA, bigramsB);

    // 3. Number / Financial Metric Overlap (e.g., Q1, 30%, 18900 cr)
    const metricsA = normA.match(/\b(?:\d+(?:\.\d+)?%?|q[1-4]|fy\d{2,4}|cr|lakh|bn|mn)\b/gi) || [];
    const metricsB = normB.match(/\b(?:\d+(?:\.\d+)?%?|q[1-4]|fy\d{2,4}|cr|lakh|bn|mn)\b/gi) || [];
    const metricSim = this.arrayOverlapScore(metricsA, metricsB);

    // 4. Levenshtein edit distance ratio
    const levenshteinRatio = 1 - (this.levenshteinDistance(normA, normB) / Math.max(normA.length, normB.length));

    // Weighted composite
    const score = (jaccard * 0.45) + (bigramSim * 0.25) + (metricSim * 0.15) + (levenshteinRatio * 0.15);

    return Math.min(1.0, Math.max(0.0, score));
  }

  private static normalizeHeadline(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s%₹$]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static tokenize(str: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'of', 'for', 'to', 'and', 'or', 'is', 'are', 'by', 'with', 'as', 'its', 'has', 'have']);
    return str.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
  }

  private static getNGrams(tokens: string[], n: number): string[] {
    const nGrams: string[] = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      nGrams.push(tokens.slice(i, i + n).join('_'));
    }
    return nGrams;
  }

  private static jaccardSimilarity(arrA: string[], arrB: string[]): number {
    if (arrA.length === 0 && arrB.length === 0) return 1.0;
    const setA = new Set(arrA);
    const setB = new Set(arrB);
    let intersection = 0;

    setA.forEach(item => {
      if (setB.has(item)) intersection++;
    });

    const union = new Set([...arrA, ...arrB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private static arrayOverlapScore(arrA: string[], arrB: string[]): number {
    if (arrA.length === 0 && arrB.length === 0) return 1.0;
    if (arrA.length === 0 || arrB.length === 0) return 0.5; // neutral if no metrics present
    const setA = new Set(arrA.map(s => s.toLowerCase()));
    const setB = new Set(arrB.map(s => s.toLowerCase()));
    let matches = 0;
    setA.forEach(item => {
      if (setB.has(item)) matches++;
    });
    return matches / Math.max(setA.size, setB.size);
  }

  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}
