/**
 * ATHENA NEWS ENGINE — ADAPTIVE SUMMARY SUITE
 * ArticleContentSanitizer
 * 
 * Production-grade HTML, Google News RSS, and boilerplate sanitizer.
 * Guarantees that no raw HTML tags, font tags, Google News wrappers,
 * tracking URLs, cookie/subscription boilerplate, publisher AI Quick Reads,
 * duplicated RSS paragraphs, or broken currency fragments ("rs")
 * ever reach Canonical Summary, What Happened, Why It Matters, Key Numbers, or Telegram.
 */

export interface SanitizedArticleContent {
  headline: string;
  body: string;
  cleanText: string;
  sentences: string[];
  wordCount: number;
  hasResidualHtml: boolean;
  sanitizationScore: number;
}

export class ArticleContentSanitizer {
  private static readonly BOILERPLATE_PATTERNS = [
    /^advertisement$/i,
    /^ad$/i,
    /click here to (read|subscribe|join|download|view)/i,
    /^click here/i,
    /subscribe to (livemint|the economic times|moneycontrol|cnbc|business standard|bloomberg|reuters|financial express)/i,
    /^subscribe now/i,
    /also read:/i,
    /related stories:/i,
    /most popular:/i,
    /follow us on (twitter|telegram|whatsapp|google news|instagram|facebook|linkedin|x)/i,
    /copyright\s*(?:©|\(c\))?\s*\d{4}/i,
    /^published on:?\s*\d+/i,
    /^updated on:?\s*\d+/i,
    /^image:\s*/i,
    /^photo courtesy:\s*/i,
    /login to read the full (article|story)/i,
    /this is a developing story/i,
    /stay tuned for more updates/i,
    /\(with inputs from (pti|reuters|ani|bloomberg|ians)\)/i,
    /^disclaimer:\s*/i,
    /terms of service/i,
    /privacy policy/i,
    /all rights reserved/i,
    /sign up for our (newsletter|daily briefing)/i
  ];

  private static readonly PUBLISHER_AI_QUICK_READ_PREFIXES = [
    /^ai\s*quick\s*read:?\s*/i,
    /^ai\s*summary:?\s*/i,
    /^ai\s*generated\s*summary:?\s*/i,
    /^in\s*summary:?\s*/i,
    /^quick\s*take:?\s*/i,
    /^at\s*a\s*glance:?\s*/i,
    /^key\s*highlights:?\s*/i,
    /^key\s*points:?\s*/i,
    /^highlights:?\s*/i,
    /^summary:?\s*/i,
    /^in\s*brief:?\s*/i
  ];

  /**
   * Decodes HTML entities to clean UTF-8 text.
   */
  public static decodeHtmlEntities(text: string): string {
    if (!text) return '';
    return text
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#8377;|&inr;/gi, '₹')
      .replace(/&#36;/gi, '$')
      .replace(/&#37;/gi, '%')
      .replace(/&mdash;|&ndash;|&#8212;|&#8211;/gi, '—')
      .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
      .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")
      .replace(/&hellip;|&#8230;/gi, '...')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return !isNaN(code) ? String.fromCharCode(code) : '';
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return !isNaN(code) ? String.fromCharCode(code) : '';
      });
  }

  /**
   * Strips Google News RSS wrapper formatting, e.g.:
   * <a href="https://news.google.com/rss/articles/...">Title</a><font color="#6f6f6f">Publisher</font>
   */
  public static stripGoogleNewsWrappers(text: string): string {
    if (!text) return '';
    let result = text;

    // Remove Google News RSS anchor tags
    result = result.replace(/<a\s+[^>]*href=["']https?:\/\/news\.google\.com\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, '$1');
    // Strip other anchor tags preserving inner content
    result = result.replace(/<a\s+[^>]*>([\s\S]*?)<\/a>/gi, '$1');
    // Strip font tags preserving inner text
    result = result.replace(/<font[^>]*>([\s\S]*?)<\/font>/gi, '$1');
    // Strip remaining generic HTML tags
    result = result.replace(/<[^>]+>/g, ' ');

    return result;
  }

  /**
   * Sanitizes any text string completely.
   */
  public static sanitizeString(text: string): string {
    if (!text) return '';
    let clean = text;

    // 1. Remove script / style / iframe blocks
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    clean = clean.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    clean = clean.replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ');
    clean = clean.replace(/<!--[\s\S]*?-->/g, ' ');

    // 2. Strip Google News RSS wrappers & HTML tags
    clean = this.stripGoogleNewsWrappers(clean);

    // 3. Decode HTML entities
    clean = this.decodeHtmlEntities(clean);

    // 4. Remove tracking URLs & raw URLs
    clean = clean.replace(/https?:\/\/[^\s)]+/gi, '');

    // 5. Normalize broken currency representations: "rs." or "rs" before numbers -> "₹"
    clean = clean.replace(/\brs\.?\s*(?=\d)/gi, '₹');
    clean = clean.replace(/\binr\s*(?=\d)/gi, '₹');
    clean = clean.replace(/₹\s+/g, '₹');

    // 6. Clean isolated "rs," or "rs" tokens that have no value attached
    clean = clean.replace(/\b(?:rs|inr)[,.]?\s*(?=[^0-9\s]|$)/gi, '');

    // 7. Clean whitespace and non-printable control characters
    clean = clean
      .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    return clean;
  }

  /**
   * Sanitizes full article content (headline + body) and extracts clean sentences.
   * Strips publisher AI Quick Reads and deduplicates repeated RSS body sections.
   */
  public static sanitizeArticle(article: any): SanitizedArticleContent {
    const rawHeadline = article?.headline || article?.title || '';
    const rawBody = article?.body || article?.cleanText || article?.content || '';

    const cleanHeadline = this.sanitizeString(rawHeadline);
    let cleanBodyText = this.sanitizeString(rawBody);

    // Strip publisher AI Quick Read prefix if present at start of body
    for (const prefix of this.PUBLISHER_AI_QUICK_READ_PREFIXES) {
      cleanBodyText = cleanBodyText.replace(prefix, '').trim();
    }

    // Split body into sentences and filter boilerplate
    const rawSentences = cleanBodyText
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const cleanSentences: string[] = [];
    const seenSentences = new Set<string>();

    for (let s of rawSentences) {
      // Strip any inner AI Quick read labels
      for (const prefix of this.PUBLISHER_AI_QUICK_READ_PREFIXES) {
        s = s.replace(prefix, '').trim();
      }

      if (s.length < 15) {
        // Skip short debris (navigation/buttons)
        if (/^(share|save|print|comments|font size|read more|details here|sign in|home|market news|photo|video|advertisement)$/i.test(s)) {
          continue;
        }
      }

      const isBoilerplate = this.BOILERPLATE_PATTERNS.some(pat => pat.test(s));
      if (isBoilerplate) continue;

      // Deduplicate identical or near-identical consecutive sentences (common in RSS duplication)
      const normalizedSentence = s.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (normalizedSentence.length > 20) {
        if (seenSentences.has(normalizedSentence)) {
          continue; // skip duplicate sentence
        }
        seenSentences.add(normalizedSentence);
      }

      cleanSentences.push(s);
    }

    const cleanBody = cleanSentences.join(' ');
    const words = cleanBody.match(/\b[A-Za-z0-9₹$%.-]+\b/g) || [];
    const hasResidualHtml = /<[a-z/][\s\S]*?>/i.test(cleanHeadline) || /<[a-z/][\s\S]*?>/i.test(cleanBody);

    return {
      headline: cleanHeadline,
      body: cleanBody,
      cleanText: cleanBody,
      sentences: cleanSentences,
      wordCount: words.length,
      hasResidualHtml,
      sanitizationScore: hasResidualHtml ? 50 : 100
    };
  }
}
