/**
 * ATHENA NEWS ENGINE V3 — HTML CLEANER
 * 
 * Production HTML sanitizer and tag stripper.
 * Strips script, style, iframe, svg, noscript, tracking pixels,
 * embedded widgets, ad containers, sponsored blocks, social widgets,
 * and decodes HTML entities while preserving structural block boundaries (<p>, <div>, <br>).
 */

export class HtmlCleaner {
  /**
   * Cleans raw HTML string and extracts structural text.
   */
  public static cleanHtml(rawInput: string): string {
    if (!rawInput) return '';

    let text = rawInput;

    // 1. Remove script, style, iframe, svg, noscript, canvas, video, audio tags with content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
    text = text.replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ');

    // 2. Remove tracking pixels and images (1x1 images, img tags)
    text = text.replace(/<img\b[^>]*>/gi, ' ');

    // 3. Remove advertisement / sponsored / social blocks by class/id pattern in HTML tags
    text = text.replace(/<[^>]+(?:class|id)=["'][^"']*(?:ad-|ad_|sponsor|social-share|cookie-banner|tracking|promoted|outbrain|taboola)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, ' ');

    // 4. Convert block elements to newline breaks to preserve paragraph boundaries
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|article|section|blockquote)>/gi, '\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<hr\s*\/?>/gi, '\n\n');

    // 5. Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // 6. Decode HTML entities
    text = this.decodeHtmlEntities(text);

    return text;
  }

  /**
   * Decodes standard HTML entities into standard UTF-8 characters.
   */
  public static decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&cent;/gi, '¢')
      .replace(/&pound;/gi, '£')
      .replace(/&yen;/gi, '¥')
      .replace(/&euro;/gi, '€')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&#8377;/gi, '₹')
      .replace(/&#x20B9;/gi, '₹')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}
