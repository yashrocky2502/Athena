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
      article.source?.publisher ||
      article.source?.name ||
      ''
    ).trim();

    const url = (
      article.canonicalUrl ||
      article.url ||
      article.link ||
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
   * Master evaluation method: evaluates article extraction quality across all tiers.
   */
  public static evaluate(article: any): SourceExtractionResult {
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
        rejectionReason: 'Null or undefined article parameter'
      };
    }

    const { matched, canonicalName: publisher, tier } = this.detectPublisher(article);
    const headline = (article.headline || article.title || '').trim();
    const rawBody = (article.body || article.content || article.raw_text || '').trim();

    // 1. Publisher Support Check
    if (!matched || tier === 'UNSUPPORTED') {
      return {
        publisher,
        tier,
        extractionStatus: 'FAILED',
        extractionScore: 0,
        cleanBody: null,
        bodyLength: rawBody.length,
        wordCount: 0,
        sentenceCount: 0,
        contaminationDetected: false,
        headlineSimilarity: 0,
        rejectionReason: 'Publisher not supported for high-quality extraction'
      };
    }

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
        rejectionReason: 'Article body is empty'
      };
    }

    // 3. Sanitization
    const sanitized = this.sanitizeContent(rawBody);
    const cleanBody = sanitized.cleanBody;

    if (!cleanBody) {
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
        rejectionReason: 'Sanitization produced empty body after removing boilerplate'
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
        rejectionReason: null
      };
    } else {
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
        rejectionReason: `Extraction quality score (${finalScore}) fell below threshold (${threshold}). Snippet: ${isSnippet}, Residual HTML: ${sanitized.hasResidualHtml}`
      };
    }
  }
}
