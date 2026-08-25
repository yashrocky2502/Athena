/**
 * ATHENA NEWS ENGINE — STAGE 8.9.13
 * SourceArticleExtractor
 * 
 * Production-grade multi-tier financial source extractor, HTML sanitizer,
 * boilerplate stripper, and extraction diagnostic evaluator.
 * 
 * Supports Tier 1 (Exchanges & Regulators), Tier 2 (Major Financial Media),
 * Tier 3 (National Desks), and Tier 4 (Market Portals & Verified Aggregators).
 */

import { ExtractionFailureCategory, ExtractionTaxonomyReport } from './SourceArticleExtractionGate';

export interface ExtractorPublisherMatch {
  matched: boolean;
  canonicalName: string;
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNSUPPORTED';
}

export interface SanitizedArticleResult {
  cleanBody: string | null;
  wordCount: number;
  sentenceCount: number;
  hasResidualHtml: boolean;
  hasBoilerplate: boolean;
}

export interface SourceExtractionResult {
  publisher: string;
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNSUPPORTED';
  extractionStatus: 'SUCCESS' | 'FAILED';
  extractionScore: number;
  cleanBody: string | null;
  bodyLength: number;
  wordCount: number;
  sentenceCount: number;
  contaminationDetected: boolean;
  headlineSimilarity: number;
  rejectionReason: string | null;
  failureCategory?: ExtractionFailureCategory;
  extractionMethod?: string;
  paragraphCount?: number;
  contaminationScore?: number;
  retryCount?: number;
  elapsedMs?: number;
  sourceUrl?: string;
  timestamp?: string;
}

export class SourceArticleExtractor {
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
   * Detects and normalizes publisher across Tier 1 through Tier 4.
   */
  public static detectPublisher(article: any): ExtractorPublisherMatch {
    if (!article) {
      return { matched: false, canonicalName: 'Other', tier: 'UNSUPPORTED' };
    }

    const rawPublisher = (
      article.publisher ||
      (typeof article.source === 'string' ? article.source : article.source?.publisher || article.source?.name) ||
      ''
    ).trim();

    const url = (
      article.canonicalUrl ||
      article.url ||
      article.link ||
      article.sourceUrl ||
      article.source_url ||
      article.originalPublisherUrl ||
      article.source?.url ||
      ''
    ).toLowerCase();

    const pubLower = rawPublisher.toLowerCase();

    // ----------------------------------------------------
    // TIER 1: Primary Exchange & Regulatory Authorities
    // ----------------------------------------------------
    if (
      pubLower === 'nse' ||
      pubLower === 'national stock exchange' ||
      pubLower.includes('national stock exchange of india') ||
      url.includes('nseindia.com')
    ) {
      return { matched: true, canonicalName: 'NSE', tier: 'TIER_1' };
    }

    if (
      pubLower === 'bse' ||
      pubLower === 'bombay stock exchange' ||
      pubLower.includes('bse india') ||
      url.includes('bseindia.com')
    ) {
      return { matched: true, canonicalName: 'BSE', tier: 'TIER_1' };
    }

    if (
      pubLower === 'sebi' ||
      pubLower.includes('securities and exchange board') ||
      url.includes('sebi.gov.in')
    ) {
      return { matched: true, canonicalName: 'SEBI', tier: 'TIER_1' };
    }

    if (
      pubLower === 'rbi' ||
      pubLower.includes('reserve bank of india') ||
      url.includes('rbi.org.in')
    ) {
      return { matched: true, canonicalName: 'RBI', tier: 'TIER_1' };
    }

    if (
      pubLower === 'pib' ||
      pubLower.includes('press information bureau') ||
      url.includes('pib.gov.in')
    ) {
      return { matched: true, canonicalName: 'PIB', tier: 'TIER_1' };
    }

    // ----------------------------------------------------
    // TIER 2: Major Mainstream Financial Media
    // ----------------------------------------------------
    if (
      /economic times|economictimes|the economic times|^et$|^et now$/i.test(rawPublisher) ||
      url.includes('economictimes.indiatimes.com') ||
      url.includes('/economictimes/')
    ) {
      return { matched: true, canonicalName: 'Economic Times', tier: 'TIER_2' };
    }

    if (
      /livemint|^mint$|ht digital/i.test(rawPublisher) ||
      url.includes('livemint.com')
    ) {
      return { matched: true, canonicalName: 'LiveMint', tier: 'TIER_2' };
    }

    if (
      /moneycontrol|network18/i.test(rawPublisher) ||
      url.includes('moneycontrol.com')
    ) {
      return { matched: true, canonicalName: 'Moneycontrol', tier: 'TIER_2' };
    }

    if (
      /business standard|business-standard/i.test(rawPublisher) ||
      url.includes('business-standard.com')
    ) {
      return { matched: true, canonicalName: 'Business Standard', tier: 'TIER_2' };
    }

    if (
      /financial express/i.test(rawPublisher) ||
      url.includes('financialexpress.com')
    ) {
      return { matched: true, canonicalName: 'Financial Express', tier: 'TIER_2' };
    }

    if (
      /cnbc tv18|cnbctv18|cnbc/i.test(rawPublisher) ||
      url.includes('cnbctv18.com')
    ) {
      return { matched: true, canonicalName: 'CNBC TV18', tier: 'TIER_2' };
    }

    if (
      /zee business|zeebiz/i.test(rawPublisher) ||
      url.includes('zeebiz.com')
    ) {
      return { matched: true, canonicalName: 'Zee Business', tier: 'TIER_2' };
    }

    if (
      /ndtv profit|ndtv business|ndtv/i.test(rawPublisher) ||
      url.includes('ndtvprofit.com') ||
      url.includes('ndtv.com/business')
    ) {
      return { matched: true, canonicalName: 'NDTV Profit', tier: 'TIER_2' };
    }

    if (
      /reuters/i.test(rawPublisher) ||
      url.includes('reuters.com')
    ) {
      return { matched: true, canonicalName: 'Reuters', tier: 'TIER_2' };
    }

    if (
      /bloomberg|bq prime|bloombergquint/i.test(rawPublisher) ||
      url.includes('bloomberg.com') ||
      url.includes('bqprime.com')
    ) {
      return { matched: true, canonicalName: 'Bloomberg', tier: 'TIER_2' };
    }

    // ----------------------------------------------------
    // TIER 3: General National Media with Business Desks
    // ----------------------------------------------------
    if (
      /times of india|the times of india|^toi$/i.test(rawPublisher) ||
      url.includes('timesofindia.indiatimes.com')
    ) {
      return { matched: true, canonicalName: 'Times of India', tier: 'TIER_3' };
    }

    if (
      /hindu businessline|the hindu business line|businessline|the hindu/i.test(rawPublisher) ||
      url.includes('thehindubusinessline.com')
    ) {
      return { matched: true, canonicalName: 'Hindu BusinessLine', tier: 'TIER_3' };
    }

    if (
      /indian express|the indian express/i.test(rawPublisher) ||
      url.includes('indianexpress.com')
    ) {
      return { matched: true, canonicalName: 'Indian Express', tier: 'TIER_3' };
    }

    if (
      /india today|business today/i.test(rawPublisher) ||
      url.includes('indiatoday.in') ||
      url.includes('businesstoday.in')
    ) {
      return { matched: true, canonicalName: 'India Today', tier: 'TIER_3' };
    }

    if (
      /the wire|thewire/i.test(rawPublisher) ||
      url.includes('thewire.in')
    ) {
      return { matched: true, canonicalName: 'The Wire', tier: 'TIER_3' };
    }

    // ----------------------------------------------------
    // TIER 4: Market Portals, Brokers, & Aggregators
    // ----------------------------------------------------
    if (/upstox/i.test(rawPublisher) || url.includes('upstox.com')) {
      return { matched: true, canonicalName: 'Upstox', tier: 'TIER_4' };
    }

    if (/groww/i.test(rawPublisher) || url.includes('groww.in')) {
      return { matched: true, canonicalName: 'Groww', tier: 'TIER_4' };
    }

    if (/zerodha|pulse/i.test(rawPublisher) || url.includes('pulse.zerodha.com')) {
      return { matched: true, canonicalName: 'Zerodha Pulse', tier: 'TIER_4' };
    }

    if (/trendlyne/i.test(rawPublisher) || url.includes('trendlyne.com')) {
      return { matched: true, canonicalName: 'Trendlyne', tier: 'TIER_4' };
    }

    if (/scanx|scanx\.trade/i.test(rawPublisher) || url.includes('scanx.trade')) {
      return { matched: true, canonicalName: 'ScanX Trade', tier: 'TIER_4' };
    }

    if (/rediff|moneywiz/i.test(rawPublisher) || url.includes('rediff.com')) {
      return { matched: true, canonicalName: 'Rediff MoneyWiz', tier: 'TIER_4' };
    }

    if (/goodreturns/i.test(rawPublisher) || url.includes('goodreturns.in')) {
      return { matched: true, canonicalName: 'Goodreturns', tier: 'TIER_4' };
    }

    if (/india\.com|indiacom/i.test(rawPublisher) || url.includes('india.com')) {
      return { matched: true, canonicalName: 'India.com', tier: 'TIER_4' };
    }

    if (/yahoo finance|yahoo/i.test(rawPublisher) || url.includes('finance.yahoo.com')) {
      return { matched: true, canonicalName: 'Yahoo Finance', tier: 'TIER_4' };
    }

    if (/google news business|google news/i.test(rawPublisher) || url.includes('news.google.com')) {
      return { matched: true, canonicalName: 'Google News Business', tier: 'TIER_4' };
    }

    return { matched: false, canonicalName: rawPublisher || 'Other', tier: 'UNSUPPORTED' };
  }

  /**
   * Decodes HTML entities safely.
   */
  public static decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&#x27;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#8217;|&#8216;/gi, "'")
      .replace(/&#8220;|&#8221;/gi, '"')
      .replace(/&#8211;/gi, '-')
      .replace(/&#8212;/gi, '—')
      .replace(/&#8377;/gi, '₹')
      .replace(/&rsquo;|&lsquo;/gi, "'")
      .replace(/&rdquo;|&ldquo;/gi, '"')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '-')
      .replace(/&hellip;/gi, '...')
      .replace(/&#\d+;/g, (match) => {
        const num = parseInt(match.slice(2, -1), 10);
        return isNaN(num) ? match : String.fromCharCode(num);
      });
  }

  /**
   * Deep sanitization: strips HTML tags, removes boilerplate / ad paragraphs, and cleans text.
   */
  public static sanitizeContent(rawText: string): SanitizedArticleResult {
    if (!rawText || !rawText.trim()) {
      return {
        cleanBody: null,
        wordCount: 0,
        sentenceCount: 0,
        hasResidualHtml: false,
        hasBoilerplate: false
      };
    }

    // 1. Check if raw text had HTML before stripping
    const hadHtml = /<[a-z/][\s\S]*?>|&[a-z0-9#]+;/i.test(rawText);

    // 2. Decode entities
    let text = this.decodeHtmlEntities(rawText);

    // 3. Remove script and style tags and comments
    text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    // 4. Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // 5. Split into sentences / paragraphs and remove boilerplate
    const rawSentences = text
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);

    const boilerplatePatterns = [
      /^advertisement$/i,
      /^ad$/i,
      /click here to (read|subscribe|join|download)/i,
      /^click here/i,
      /subscribe to (livemint|the economic times|moneycontrol|cnbc|business standard)/i,
      /^subscribe now/i,
      /also read:/i,
      /related stories:/i,
      /most popular:/i,
      /follow us on (twitter|telegram|whatsapp|google news|instagram|facebook|linkedin)/i,
      /copyright\s*(?:©|\(c\))?\s*\d{4}/i,
      /^published on:?\s*\d+/i,
      /^updated on:?\s*\d+/i,
      /^image:\s*/i,
      /^photo courtesy:\s*/i,
      /login to read the full (article|story)/i,
      /this is a developing story/i,
      /stay tuned for more updates/i,
      /\(with inputs from (pti|reuters|ani|bloomberg|ians)\)/i,
      /^disclaimer:\s*/i
    ];

    let hasBoilerplate = false;
    const cleanSentences: string[] = [];

    for (const sentence of rawSentences) {
      const isBoilerplate = boilerplatePatterns.some(pattern => pattern.test(sentence));
      if (isBoilerplate) {
        hasBoilerplate = true;
        continue;
      }
      // Skip very short fragments that are navigation debris
      if (sentence.length < 15 && /^(share|save|print|comments|font size|read more|details here|sign in|home|market news)$/i.test(sentence)) {
        continue;
      }
      cleanSentences.push(sentence);
    }

    let cleanBody = cleanSentences.join(' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

    // Check for residual HTML tags
    const hasResidualHtml = /<[a-z/][\s\S]*?>/i.test(cleanBody);

    // Count words and sentences
    const words = cleanBody ? cleanBody.match(/\b[A-Za-z0-9₹$%.-]+\b/g) || [] : [];
    const wordCount = words.length;

    const sentences = cleanBody
      ? cleanBody.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(s => s.length > 15)
      : [];
    const sentenceCount = sentences.length;

    return {
      cleanBody: cleanBody.length > 0 ? cleanBody : null,
      wordCount,
      sentenceCount,
      hasResidualHtml,
      hasBoilerplate
    };
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
   * Safely normalizes text encoding and removes invalid UTF-8 control characters.
   */
  public static normalizeEncoding(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  /**
   * Calculates contamination score from 0 to 100 based on HTML, navigation, and marketing debris.
   */
  public static calculateContaminationScore(text: string): number {
    if (!text) return 0;
    let score = 0;
    if (/<[a-z/][\s\S]*?>/i.test(text)) score += 40;
    if (/cookie|privacy policy|terms of use|all rights reserved/i.test(text)) score += 20;
    if (/follow us on|subscribe now|click here/i.test(text)) score += 20;
    if (/advertisement|sponsored|promoted/i.test(text)) score += 20;
    return Math.min(100, score);
  }

  /**
   * Safely attempts multi-strategy extraction layers across available article attributes.
   */
  public static extractMultiStrategy(article: any): { cleanBody: string | null; method: string; rawText: string } {
    if (!article) return { cleanBody: null, method: 'NONE', rawText: '' };

    // Strategy 1: Primary Body Field
    const primaryText = this.normalizeEncoding(
      (article.body || article.content || article.raw_text || article.full_content || '').trim()
    );
    if (primaryText) {
      const sanitized = this.sanitizeContent(primaryText);
      if (sanitized.cleanBody && sanitized.wordCount >= 12 && !sanitized.hasResidualHtml) {
        return { cleanBody: sanitized.cleanBody, method: 'PRIMARY_BODY', rawText: primaryText };
      }
    }

    // Strategy 2: JSON-LD / Structured Data
    if (article.json_ld || article.schema_data || article.jsonLd) {
      try {
        const jsonLdObj = typeof article.json_ld === 'string'
          ? (article.json_ld.startsWith('{') ? JSON.parse(article.json_ld) : null)
          : (article.json_ld || article.schema_data || article.jsonLd);
        
        const jsonBody = jsonLdObj?.articleBody || jsonLdObj?.description || jsonLdObj?.text;
        if (typeof jsonBody === 'string' && jsonBody.trim().length > 0) {
          const normJson = this.normalizeEncoding(jsonBody);
          const sanitized = this.sanitizeContent(normJson);
          if (sanitized.cleanBody && sanitized.wordCount >= 10) {
            return { cleanBody: sanitized.cleanBody, method: 'JSON_LD', rawText: normJson };
          }
        }
      } catch {
        // Safe json parse fallthrough
      }
    }

    // Strategy 3: Publisher Recovery Profiles (Moneycontrol, CNBC TV18, PIB, Google News, NSE, BSE, RBI, SEBI, Business Standard, ET, LiveMint)
    const { canonicalName: publisher } = this.detectPublisher(article);
    if (publisher) {
      const candidateFields = [
        article.description,
        article.summary,
        article.og_description,
        article.ogDescription,
        article.details,
        article.fullText
      ];
      for (const candidate of candidateFields) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          const normCandidate = this.normalizeEncoding(candidate);
          const sanitized = this.sanitizeContent(normCandidate);
          const headline = (article.headline || article.title || '').trim();
          const sim = this.calculateSimilarity(headline, sanitized.cleanBody || '');
          if (sanitized.cleanBody && sanitized.wordCount >= 10 && sim < 0.85) {
            return { cleanBody: sanitized.cleanBody, method: 'PUBLISHER_PROFILE_RECOVERY', rawText: normCandidate };
          }
        }
      }
    }

    // Strategy 4: Paragraph Aggregation
    if (Array.isArray(article.paragraphs) || Array.isArray(article.p_tags)) {
      const paragraphs = article.paragraphs || article.p_tags;
      const joined = paragraphs.filter((p: any) => typeof p === 'string' && p.trim().length > 0).join(' ');
      if (joined.trim().length > 0) {
        const normJoined = this.normalizeEncoding(joined);
        const sanitized = this.sanitizeContent(normJoined);
        if (sanitized.cleanBody && sanitized.wordCount >= 12) {
          return { cleanBody: sanitized.cleanBody, method: 'PARAGRAPH_AGGREGATION', rawText: normJoined };
        }
      }
    }

    // Strategy 5: Secondary Description / Summary
    const secondaryText = this.normalizeEncoding(
      (article.description || article.summary || article.og_description || article.ogDescription || article.raw_description || '').trim()
    );
    if (secondaryText) {
      const sanitized = this.sanitizeContent(secondaryText);
      const headline = (article.headline || article.title || '').trim();
      const sim = this.calculateSimilarity(headline, sanitized.cleanBody || '');
      if (sanitized.cleanBody && sanitized.wordCount >= 8 && sim < 0.85) {
        return { cleanBody: sanitized.cleanBody, method: 'SECONDARY_DESCRIPTION', rawText: secondaryText };
      }
    }

    // Fallback if primaryText was provided
    if (primaryText) {
      const sanitized = this.sanitizeContent(primaryText);
      return { cleanBody: sanitized.cleanBody, method: 'PRIMARY_BODY_FALLBACK', rawText: primaryText };
    }

    return { cleanBody: null, method: 'FAILED_EXTRACTION', rawText: '' };
  }

  /**
   * Master evaluation method: evaluates article extraction quality across all tiers.
   */
  public static evaluate(article: any): SourceExtractionResult {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    if (!article) {
      return {
        publisher: 'Other',
        tier: 'UNSUPPORTED',
        extractionStatus: 'FAILED',
        extractionScore: 0,
        cleanBody: null,
        bodyLength: 0,
        wordCount: 0,
        sentenceCount: 0,
        contaminationDetected: false,
        headlineSimilarity: 0,
        rejectionReason: 'Null or undefined article parameter',
        failureCategory: 'NO_SOURCE_BODY',
        extractionMethod: 'NONE',
        paragraphCount: 0,
        contaminationScore: 0,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl: '',
        timestamp
      };
    }

    const { matched, canonicalName: publisher, tier } = this.detectPublisher(article);
    const headline = (article.headline || article.title || '').trim();
    const sourceUrl = (
      article.canonicalUrl ||
      article.url ||
      article.link ||
      article.sourceUrl ||
      article.source_url ||
      article.originalPublisherUrl ||
      article.source?.url ||
      ''
    );

    // 1. Publisher Support Check
    if (!matched || tier === 'UNSUPPORTED') {
      return {
        publisher,
        tier,
        extractionStatus: 'FAILED',
        extractionScore: 0,
        cleanBody: null,
        bodyLength: 0,
        wordCount: 0,
        sentenceCount: 0,
        contaminationDetected: false,
        headlineSimilarity: 0,
        rejectionReason: 'Publisher not supported for high-quality extraction',
        failureCategory: 'UNSUPPORTED_PUBLISHER',
        extractionMethod: 'UNSUPPORTED',
        paragraphCount: 0,
        contaminationScore: 0,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl,
        timestamp
      };
    }

    // Multi-strategy extraction attempt
    const multiResult = this.extractMultiStrategy(article);
    const rawBody = multiResult.rawText;
    const extractionMethod = multiResult.method;

    // 2. Empty Body Check
    if (!rawBody) {
      return {
        publisher,
        tier,
        extractionStatus: 'FAILED',
        extractionScore: 0,
        cleanBody: null,
        bodyLength: 0,
        wordCount: 0,
        sentenceCount: 0,
        contaminationDetected: false,
        headlineSimilarity: 0,
        rejectionReason: 'Article body is empty',
        failureCategory: 'NO_SOURCE_BODY',
        extractionMethod: 'NO_SOURCE_BODY',
        paragraphCount: 0,
        contaminationScore: 0,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl,
        timestamp
      };
    }

    // 3. Sanitization
    const sanitized = this.sanitizeContent(rawBody);
    const cleanBody = sanitized.cleanBody;
    const contaminationScore = this.calculateContaminationScore(rawBody);

    if (!cleanBody) {
      const cat = this.classifyFailureCategory(article);
      return {
        publisher,
        tier,
        extractionStatus: 'FAILED',
        extractionScore: 0,
        cleanBody: null,
        bodyLength: 0,
        wordCount: 0,
        sentenceCount: 0,
        contaminationDetected: sanitized.hasResidualHtml || sanitized.hasBoilerplate,
        headlineSimilarity: 0,
        rejectionReason: 'Sanitization produced empty body after removing boilerplate',
        failureCategory: cat,
        extractionMethod,
        paragraphCount: 0,
        contaminationScore,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl,
        timestamp
      };
    }

    // 4. Headline similarity check
    const headlineSimilarity = this.calculateSimilarity(headline, cleanBody);

    // 5. Snippet and repetition checks
    const isSnippet =
      cleanBody.endsWith('...') ||
      (cleanBody.length < headline.length + 30 && headlineSimilarity > 0.65) ||
      /stock price today|share price today|today's live updates/i.test(cleanBody);

    // 6. Quality Scoring (0 to 100)
    let score = 0;

    // +25 body exists
    if (cleanBody.length > 0) {
      score += 25;
    }

    // +20 body length >= 120 chars or >= 22 words
    if (cleanBody.length >= 120 || sanitized.wordCount >= 22) {
      score += 20;
    } else if (cleanBody.length >= 80 || sanitized.wordCount >= 14) {
      score += 12;
    }

    // +15 multiple meaningful sentences (>= 2)
    if (sanitized.sentenceCount >= 2) {
      score += 15;
    } else if (sanitized.sentenceCount === 1 && sanitized.wordCount >= 14) {
      score += 10;
    }

    // +15 lexical divergence from headline (similarity < 0.45)
    if (headlineSimilarity < 0.45) {
      score += 15;
    } else if (headlineSimilarity < 0.65) {
      score += 8;
    }

    // +10 contains quantifiable financial facts / entities
    const hasFacts =
      /\b\d+(?:,\d+)*(?:\.\d+)?\b/.test(cleanBody) ||
      /₹|\$|Rs|crore|cr|percent|%|PAT|EBITDA|YoY|revenue|profit|loss|margin|shares|stake|order|board/i.test(cleanBody);
    if (hasFacts) {
      score += 10;
    }

    // +10 valid publication timestamp
    const hasTimestamp = article.publishedAt && !isNaN(Date.parse(article.publishedAt));
    if (hasTimestamp) {
      score += 10;
    }

    // +5 no residual HTML
    if (!sanitized.hasResidualHtml) {
      score += 5;
    }

    // Penalties
    if (sanitized.hasResidualHtml) {
      score -= 40;
    }
    if (isSnippet) {
      score -= 30;
    }
    if (/tree plantation|csr drive|inaugurates garden|cultural festival|marathon/i.test(cleanBody)) {
      score -= 35;
    }
    if (!hasFacts && sanitized.sentenceCount <= 1 && sanitized.wordCount < 18) {
      score -= 20;
    }
    if (sanitized.wordCount < 12 || cleanBody.length < 65) {
      score = Math.min(score, 30);
    }
    if (headlineSimilarity > 0.85) {
      score = Math.min(score, 20);
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const threshold = this.getMinScoreThreshold();
    const paragraphCount = cleanBody.split('\n').filter(Boolean).length || sanitized.sentenceCount;

    if (finalScore >= threshold) {
      return {
        publisher,
        tier,
        extractionStatus: 'SUCCESS',
        extractionScore: finalScore,
        cleanBody,
        bodyLength: cleanBody.length,
        wordCount: sanitized.wordCount,
        sentenceCount: sanitized.sentenceCount,
        contaminationDetected: sanitized.hasResidualHtml,
        headlineSimilarity,
        rejectionReason: null,
        extractionMethod,
        paragraphCount,
        contaminationScore,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl,
        timestamp
      };
    } else {
      const failureCategory = this.classifyFailureCategory(article);
      return {
        publisher,
        tier,
        extractionStatus: 'FAILED',
        extractionScore: finalScore,
        cleanBody: null,
        bodyLength: cleanBody.length,
        wordCount: sanitized.wordCount,
        sentenceCount: sanitized.sentenceCount,
        contaminationDetected: sanitized.hasResidualHtml,
        headlineSimilarity,
        rejectionReason: `Extraction quality score (${finalScore}) fell below threshold (${threshold}). Category: ${failureCategory}. Contamination: ${sanitized.hasResidualHtml || contaminationScore > 0}, Snippet: ${isSnippet}, Residual HTML: ${sanitized.hasResidualHtml}`,
        failureCategory,
        extractionMethod,
        paragraphCount,
        contaminationScore,
        retryCount: 0,
        elapsedMs: Date.now() - startTime,
        sourceUrl,
        timestamp
      };
    }
  }

  /**
   * Deterministically classifies extraction failures into one of 18 diagnostic categories.
   */
  public static classifyFailureCategory(article: any): ExtractionFailureCategory {
    if (!article) return 'NO_SOURCE_BODY';

    if (article.httpStatus) {
      if (article.httpStatus === 429 || article.httpStatus === 408 || (article.httpStatus >= 500 && article.httpStatus < 600)) {
        return 'TEMPORARY_SOURCE_FAILURE';
      }
      if (article.httpStatus >= 400 && article.httpStatus < 500) {
        return 'HTTP_FAILURE';
      }
    }
    if (article.errorType === 'TIMEOUT' || article.isTimeout) {
      return 'TIMEOUT';
    }
    if (article.errorType === 'HTTP_FAILURE' || article.httpError) {
      return 'HTTP_FAILURE';
    }
    if (article.errorType === 'ENCODING_FAILURE' || article.hasEncodingError) {
      return 'ENCODING_FAILURE';
    }
    if (article.errorType === 'MALFORMED_SOURCE' || article.isMalformed) {
      return 'MALFORMED_SOURCE';
    }
    if (article.isDuplicate || article.duplicateContentDetected) {
      return 'DUPLICATE_CONTENT';
    }

    const pubMatch = this.detectPublisher(article);
    if (!pubMatch.matched || pubMatch.tier === 'UNSUPPORTED') {
      return 'UNSUPPORTED_PUBLISHER';
    }

    const rawBody = (article.body || article.content || article.raw_text || article.description || '').trim();
    if (!rawBody) {
      return 'NO_SOURCE_BODY';
    }

    // Check for Cloudflare / Security captcha / Bot protection
    if (/cloudflare|enable javascript|refresh the page|captcha|security check|access denied/i.test(rawBody)) {
      return 'BOT_PROTECTION';
    }

    const headline = (article.headline || article.title || '').trim();
    const sanitized = this.sanitizeContent(rawBody);
    const cleanBody = sanitized.cleanBody || '';

    // Check for Navigation Contamination first (as navigation menus may contain words like 'subscribe')
    if (/(home > news|share this article|click here to|copyright \d{4})/i.test(rawBody) || /(home > news|share this article|click here to|copyright \d{4})/i.test(cleanBody)) {
      return 'NAVIGATION_CONTAMINATION';
    }

    // Check for Paywall / Login prompts
    if (/subscribe|subscriber|login|sign in|paywall|premium article|premium member|premium subscriber|restricted to premium/i.test(rawBody)) {
      return 'PAYWALL_OR_LOGIN';
    }

    if (/<[a-z][\s\S]*>/i.test(rawBody) || sanitized.hasResidualHtml) {
      return 'HTML_CONTAMINATION';
    }

    if (!cleanBody) {
      return 'CONTENT_TOO_SHORT';
    }

    const sim = this.calculateSimilarity(headline, cleanBody);

    if (sim > 0.85 || cleanBody === headline || (rawBody.startsWith('<a href=') && cleanBody.length < headline.length + 40)) {
      return 'HEADLINE_ONLY';
    }

    if (cleanBody.endsWith('...') || /stock price today|share price today|today's live updates/i.test(cleanBody)) {
      return 'SNIPPET_ONLY';
    }

    if (sanitized.wordCount < 12 || cleanBody.length < 65) {
      return 'CONTENT_TOO_SHORT';
    }

    if (/(home > news|share this article|click here to|copyright \d{4})/i.test(cleanBody)) {
      return 'NAVIGATION_CONTAMINATION';
    }

    return 'UNKNOWN_EXTRACTION_FAILURE';
  }

  /**
   * Generates a complete ExtractionTaxonomyReport across a dataset of articles.
   */
  public static getDiagnosticReport(articles: any[]): ExtractionTaxonomyReport {
    const totalArticles = articles.length;
    let groundedCount = 0;
    let failedCount = 0;

    const taxonomyBreakdown: Record<ExtractionFailureCategory, number> = {
      UNSUPPORTED_PUBLISHER: 0,
      NO_SOURCE_BODY: 0,
      HEADLINE_ONLY: 0,
      SNIPPET_ONLY: 0,
      PAYWALL_OR_LOGIN: 0,
      BOT_PROTECTION: 0,
      HTTP_FAILURE: 0,
      TIMEOUT: 0,
      HTML_PARSE_FAILURE: 0,
      CONTENT_SELECTOR_FAILURE: 0,
      HTML_CONTAMINATION: 0,
      CONTENT_TOO_SHORT: 0,
      NAVIGATION_CONTAMINATION: 0,
      DUPLICATE_CONTENT: 0,
      ENCODING_FAILURE: 0,
      MALFORMED_SOURCE: 0,
      TEMPORARY_SOURCE_FAILURE: 0,
      UNKNOWN_EXTRACTION_FAILURE: 0
    };

    const publisherFailures: Record<string, number> = {};

    for (const article of articles) {
      const evalResult = this.evaluate(article);
      if (evalResult.extractionStatus === 'SUCCESS') {
        groundedCount++;
      } else {
        failedCount++;
        const cat = evalResult.failureCategory || this.classifyFailureCategory(article);
        taxonomyBreakdown[cat] = (taxonomyBreakdown[cat] || 0) + 1;

        const pub = evalResult.publisher || 'Unknown';
        publisherFailures[pub] = (publisherFailures[pub] || 0) + 1;
      }
    }

    const topFailedPublishers = Object.entries(publisherFailures)
      .map(([publisher, failureCount]) => ({ publisher, failureCount }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 10);

    const groundedPercentage = totalArticles > 0
      ? parseFloat(((groundedCount / totalArticles) * 100).toFixed(2))
      : 0;

    return {
      totalArticles,
      groundedCount,
      failedCount,
      groundedPercentage,
      taxonomyBreakdown,
      topFailedPublishers,
      qualityGateThreshold: this.getMinScoreThreshold(),
      timestamp: new Date().toISOString()
    };
  }
}
