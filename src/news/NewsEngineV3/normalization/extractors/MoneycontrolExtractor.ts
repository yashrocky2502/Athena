/**
 * ATHENA NEWS ENGINE V3 — MONEYCONTROL EXTRACTOR
 */

export class MoneycontrolExtractor {
  public static extract(html: string): string[] {
    const paragraphs: string[] = [];
    
    // Target the main article body container if present
    const bodyMatch = html.match(/<div[^>]*class="[^"]*(content_wrapper|arti-flow|article-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const contentToSearch = bodyMatch ? bodyMatch[2] : html;

    const pMatches = contentToSearch.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches && pMatches.length > 0) {
      for (const p of pMatches) {
        const text = p.replace(/<[^>]+>/g, '').trim();
        if (text.length > 30 && !/read also|also read|read more|click here/i.test(text)) {
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
