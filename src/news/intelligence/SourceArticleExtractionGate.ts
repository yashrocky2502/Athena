import { NewsArticle } from '../models/NewsArticle';

export interface ExtractionDiagnostic {
  publisher: string;
  extractionStatus: 'SUCCESS' | 'FAILED';
  extractionScore: number;
  bodyLength: number;
  sentenceCount: number;
  contaminationDetected: boolean;
  headlineSimilarity: number;
  rejectionReason: string | null;
}

export class SourceArticleExtractionGate {
  private static readonly MIN_SCORE_DEFAULT = 65;

  public static getMinScoreThreshold(): number {
    const envVal = process.env.SOURCE_EXTRACTION_MIN_SCORE;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return this.MIN_SCORE_DEFAULT;
  }

  /**
   * Helper to compute lexical word overlap similarity between headline and body.
   */
  public static calculateSimilarity(s1: string, s2: string): number {
    const w1 = new Set((s1 || '').toLowerCase().match(/\b\w{2,}\b/g) || []);
    const w2 = new Set((s2 || '').toLowerCase().match(/\b\w{2,}\b/g) || []);
    if (w1.size === 0 || w2.size === 0) return 0;
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    return intersection.size / Math.max(w1.size, w2.size);
  }

  /**
   * Determines if a publisher matches ET or LiveMint variants.
   */
  public static detectPublisher(article: any): { matched: boolean; name: 'Economic Times' | 'LiveMint' | 'Other' } {
    if (!article) return { matched: false, name: 'Other' };
    const publisherName = (article.publisher || article.source?.publisher || article.source?.name || '').trim();
    const url = (article.url || article.link || article.originalPublisherUrl || '').toLowerCase();

    const isET = 
      /economic times|the economic times|economictimes|et/i.test(publisherName) ||
      url.includes('economictimes.indiatimes.com') ||
      url.includes('/economictimes/') ||
      publisherName === 'ET' ||
      publisherName === 'The Economic Times' ||
      publisherName === 'Economic Times';

    if (isET) {
      return { matched: true, name: 'Economic Times' };
    }

    const isMint = 
      /livemint|mint/i.test(publisherName) ||
      url.includes('livemint.com') ||
      publisherName === 'LiveMint' ||
      publisherName === 'Mint';

    if (isMint) {
      return { matched: true, name: 'LiveMint' };
    }

    return { matched: false, name: 'Other' };
  }

  /**
   * Evaluates the extraction quality and returns status, score and internal diagnostic metadata.
   */
  public static evaluate(article: any): { diagnostic: ExtractionDiagnostic; cleanBody: string | null } {
    if (!article) {
      return {
        diagnostic: {
          publisher: 'Other',
          extractionStatus: 'FAILED',
          extractionScore: 0,
          bodyLength: 0,
          sentenceCount: 0,
          contaminationDetected: false,
          headlineSimilarity: 0,
          rejectionReason: 'Null or undefined article parameter'
        },
        cleanBody: null
      };
    }
    const { matched, name: publisher } = this.detectPublisher(article);
    const headline = (article.headline || article.title || '').trim();
    const body = (article.body || article.content || article.raw_text || '').trim();

    const diagnostic: ExtractionDiagnostic = {
      publisher,
      extractionStatus: 'FAILED',
      extractionScore: 0,
      bodyLength: body.length,
      sentenceCount: 0,
      contaminationDetected: false,
      headlineSimilarity: 0,
      rejectionReason: null
    };

    // Rule: If not ET or LiveMint, fail extraction immediately (SOURCE_UNAVAILABLE)
    if (!matched) {
      diagnostic.rejectionReason = 'Publisher not supported for high-quality extraction';
      return { diagnostic, cleanBody: null };
    }

    // Rule: Body must exist
    if (!body) {
      diagnostic.rejectionReason = 'Article body is empty';
      return { diagnostic, cleanBody: null };
    }

    // Check similarity with headline
    const headlineSimilarity = this.calculateSimilarity(headline, body);
    diagnostic.headlineSimilarity = headlineSimilarity;

    // Detect sentences
    const sentences = body
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 15);
    diagnostic.sentenceCount = sentences.length;

    // Contamination check
    const contaminationPatterns = [
      '</a>',
      '<font',
      '&nbsp;',
      'Read more',
      'Details here',
      'Click here',
      'Subscribe',
      'Login',
      'ADVERTISEMENT',
      'Related Stories',
      'Most Popular'
    ];
    const lowerBody = body.toLowerCase();
    const hasContamination = contaminationPatterns.some(pat => {
      // For HTML tags, do exact case-insensitive match; for phrases, match as boundaries if possible, or exact substring
      if (pat.startsWith('<') || pat.startsWith('&') || pat.includes('/')) {
        return lowerBody.includes(pat.toLowerCase());
      }
      return lowerBody.includes(pat.toLowerCase());
    });

    if (hasContamination) {
      diagnostic.contaminationDetected = true;
    }

    // Google news snippet or search results snippet check
    const isSnippet = 
      body.endsWith('...') || 
      (body.length < headline.length + 40 && headlineSimilarity > 0.6) ||
      /stock price today|share price today|today's live updates/i.test(body);

    // Calculate score
    let score = 0;

    // +25 body exists
    if (body.length > 0) {
      score += 25;
    }

    // +20 body length >= minimum threshold (minimum 200 chars)
    if (body.length >= 200) {
      score += 20;
    }

    // +15 multiple meaningful sentences (>= 2)
    if (sentences.length >= 2) {
      score += 15;
    }

    // +15 body differs materially from headline (similarity < 0.4)
    if (headlineSimilarity < 0.4) {
      score += 15;
    }

    // +10 contains article-specific facts/entities (numbers or standard metric indicators)
    const hasFacts = /\b\d+(?:,\d+)*(?:\.\d+)?\b/.test(body) || /₹|\$|Rs|crore|percent|%|PAT|EBITDA|YoY|revenue/i.test(body);
    if (hasFacts) {
      score += 10;
    }

    // +10 contains source metadata consistency
    const hasMetadataConsistency = article.publishedAt && !isNaN(Date.parse(article.publishedAt));
    if (hasMetadataConsistency) {
      score += 10;
    }

    // +5 clean HTML/text normalization
    if (!diagnostic.contaminationDetected && !body.includes('<div') && !body.includes('<p')) {
      score += 5;
    }

    // Negative constraints overrides
    if (diagnostic.contaminationDetected) {
      score -= 40; // Heavy penalty to force failure
    }
    if (isSnippet) {
      score -= 30; // Heavy penalty for snippets
    }
    if (body.length < 100) {
      score = Math.min(score, 30); // Hard limit for too-short body
    }
    if (headlineSimilarity > 0.8) {
      score = Math.min(score, 20); // Hard limit for repeated headlines
    }

    // Finalize score
    diagnostic.extractionScore = Math.max(0, Math.min(100, score));

    // Threshold check
    const threshold = this.getMinScoreThreshold();
    if (diagnostic.extractionScore >= threshold) {
      diagnostic.extractionStatus = 'SUCCESS';
      return { diagnostic, cleanBody: body };
    } else {
      diagnostic.rejectionReason = `Extraction quality score (${diagnostic.extractionScore}) fell below threshold (${threshold}). Contamination: ${diagnostic.contaminationDetected}, Snippet: ${isSnippet}`;
      return { diagnostic, cleanBody: null };
    }
  }
}
