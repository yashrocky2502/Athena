/**
 * ATHENA NEWS ENGINE V3 — NOISE REMOVAL ENGINE
 * 
 * Target-specific removal of promotional noise, "Read More" links, "Live Updates" markers,
 * "Should You Buy" promo widgets, social share buttons, related stories blocks, and breadcrumbs.
 */

import { BoilerplateRemover } from './BoilerplateRemover';

export class NoiseRemovalEngine {
  private static readonly NOISE_PATTERNS = [
    /^\s*read\s+more\s*:?.*/i,
    /^\s*also\s+read\s*:?.*/i,
    /^\s*continue\s+reading\s*:?.*/i,
    /^\s*what's\s+ahead\s*:?.*/i,
    /^\s*should\s+you\s+buy\s*:?.*/i,
    /^\s*live\s+updates\s*:?.*/i,
    /^\s*advertisement\s*:?.*/i,
    /^\s*follow\s+us\s*:?.*/i,
    /^\s*share\s+this\s+article\s*:?.*/i,
    /^\s*subscribe\s+now\s*:?.*/i,
    /^\s*trending\s+now\s*:?.*/i,
    /^\s*related\s+(articles|stories|news)\s*:?.*/i,
    /^\s*recommended\s+(stories|for\s+you)\s*:?.*/i,
    /^\s*comments\s*\(\d*\)\s*:?.*/i,
    /^\s*navigation\s*:?.*/i,
    /^\s*breadcrumbs?\s*:?.*/i,
    /^\s*home\s*>\s*news\s*>\s*.*/i,
    /^\s*\[?\s*click\s+here\s+to\s+read\s+more\s*\]?/i,
    /^\s*sign\s+in\s+to\s+comment.*/i,
    /^\s*photo\s*:\s*(getty|reuters|pti|bloomberg|afp|et\s+now).*/i,
    /^\s*agencies\s*\|\s*.*/i
  ];

  /**
   * Cleans text by running full noise and boilerplate stripping.
   */
  public static removeNoise(text: string): string {
    if (!text) return '';

    // First run boilerplate remover
    let clean = BoilerplateRemover.removeBoilerplate(text);

    // Line-by-line noise filter
    const lines = clean.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;

      for (const pattern of this.NOISE_PATTERNS) {
        if (pattern.test(trimmed)) {
          return false;
        }
      }
      return true;
    });

    clean = filteredLines.join('\n');

    // Inline noise removal (e.g. embedded "Read More: https://..." or "(Also Read: ...)")
    clean = clean.replace(/\(\s*(also\s+read|read\s+more|see\s+also)\s*:[^)]+\)/gi, '');
    clean = clean.replace(/\[\s*(also\s+read|read\s+more|see\s+also)\s*:[^\]]+\]/gi, '');

    return clean;
  }
}
