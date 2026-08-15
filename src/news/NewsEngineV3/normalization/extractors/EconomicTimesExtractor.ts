/**
 * ATHENA NEWS ENGINE V3 — ECONOMIC TIMES EXTRACTOR
 */

export class EconomicTimesExtractor {
  public static extract(html: string): string[] {
    const paragraphs: string[] = [];
    
    // Target the main article body container if present
    const artTextMatch = html.match(/<div[^>]*class="[^"]*(artText|js-article-text|article-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const contentToSearch = artTextMatch ? artTextMatch[2] : html;

    // Find all <p> tags
    const pMatches = contentToSearch.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches && pMatches.length > 0) {
      for (const p of pMatches) {
        const text = p.replace(/<[^>]+>/g, '').trim();
        // Skip common boilerplate
        if (text.length > 30 && !/click here to read|subscribe to|also read|read more/i.test(text)) {
          paragraphs.push(text);
        }
      }
    }

    // Fallback: split by line breaks or double line breaks if no <p> tags found
    if (paragraphs.length === 0) {
      const cleanText = contentToSearch.replace(/<[^>]+>/g, ' ');
      const blocks = cleanText.split(/\n\s*\n+/);
      for (const block of blocks) {
        const t = block.replace(/\s+/g, ' ').trim();
        if (t.length > 40) paragraphs.push(t);
      }
    }

    return paragraphs;
  }
}
