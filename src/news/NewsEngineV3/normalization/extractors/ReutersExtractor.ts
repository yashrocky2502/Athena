/**
 * ATHENA NEWS ENGINE V3 — REUTERS EXTRACTOR
 */

export class ReutersExtractor {
  public static extract(html: string): string[] {
    const paragraphs: string[] = [];
    
    // Reuters often uses specific paragraph layout classes
    const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    if (pMatches && pMatches.length > 0) {
      for (const p of pMatches) {
        const text = p.replace(/<[^>]+>/g, '').trim();
        if (text.length > 30 && !/reuters|reporting by|editing by/i.test(text)) {
          paragraphs.push(text);
        }
      }
    }

    if (paragraphs.length === 0) {
      const cleanText = html.replace(/<[^>]+>/g, ' ');
      const blocks = cleanText.split(/\n\s*\n+/);
      for (const block of blocks) {
        const t = block.replace(/\s+/g, ' ').trim();
        if (t.length > 40) paragraphs.push(t);
      }
    }

    return paragraphs;
  }
}
