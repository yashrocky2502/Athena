/**
 * ATHENA NEWS ENGINE V3 — LIVEMINT EXTRACTOR
 */

export class LiveMintExtractor {
  public static extract(html: string): string[] {
    const paragraphs: string[] = [];
    
    const bodyMatch = html.match(/<div[^>]*class="[^"]*(mainArea|article-body|story-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const contentToSearch = bodyMatch ? bodyMatch[2] : html;

    const pMatches = contentToSearch.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches && pMatches.length > 0) {
      for (const p of pMatches) {
        const text = p.replace(/<[^>]+>/g, '').trim();
        if (text.length > 30 && !/livemint|also read|read more/i.test(text)) {
          paragraphs.push(text);
        }
      }
    }

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
