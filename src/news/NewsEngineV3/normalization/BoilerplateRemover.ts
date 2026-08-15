/**
 * ATHENA NEWS ENGINE V3 — BOILERPLATE REMOVER
 * 
 * Detects and removes recurring publisher boilerplate, header/footer text,
 * disclaimers, cookie banners, breadcrumbs, and copyright notices.
 */

export class BoilerplateRemover {
  private static readonly BOILERPLATE_PATTERNS = [
    /^\s*disclaimer\s*:?.*/i,
    /^\s*copyright\s*©?.*/i,
    /^\s*all\s+rights\s+reserved\.?.*/i,
    /^\s*terms\s+of\s+use\s*\|?.*/i,
    /^\s*privacy\s+policy\s*\|?.*/i,
    /^\s*cookie\s+policy\s*\|?.*/i,
    /^\s*follow\s+us\s+on\s+(twitter|facebook|linkedin|telegram|whatsapp|instagram).*/i,
    /^\s*subscribe\s+to\s+our\s+newsletter.*/i,
    /^\s*download\s+the\s+app.*/i,
    /^\s*for\s+more\s+news\s+and\s+updates\s+stay\s+tuned.*/i,
    /^\s*written\s+by\s*:\s*.*/i,
    /^\s*edited\s+by\s*:\s*.*/i,
    /^\s*first\s+published\s*:\s*.*/i,
    /^\s*last\s+updated\s*:\s*.*/i
  ];

  /**
   * Removes boilerplate lines and blocks from text.
   */
  public static removeBoilerplate(text: string): string {
    if (!text) return '';

    const lines = text.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep line break structure for paragraphs

      for (const pattern of this.BOILERPLATE_PATTERNS) {
        if (pattern.test(trimmed)) {
          return false;
        }
      }
      return true;
    });

    return filteredLines.join('\n');
  }
}
