/**
 * ATHENA NEWS ENGINE V3 — FOUNDATION UTILITIES
 * 
 * Helper functions for correlation IDs, text sanitization, content hashing,
 * exponential backoff, and string manipulation.
 */

export class V3Utils {
  private static idCounter = 0;

  /**
   * Generates a unique correlation or request ID
   */
  public static generateId(prefix = 'V3'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const counter = (++V3Utils.idCounter).toString(36);
    return `${prefix}_${timestamp}_${random}_${counter}`.toUpperCase();
  }

  /**
   * Simple non-cryptographic string content hash for deduplication
   */
  public static computeContentHash(str: string): string {
    let hash = 0;
    const cleanStr = str.toLowerCase().replace(/\s+/g, '');
    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `HASH_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Sanitizes raw body text (strips scripts, html tags, normalizes whitespace)
   */
  public static sanitizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Exponential backoff delay calculation with jitter
   */
  public static calculateExponentialBackoff(attempt: number, baseMs = 100, maxMs = 5000): number {
    const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
    const jitter = Math.random() * 0.2 * delay; // 20% jitter
    return Math.round(delay + jitter);
  }

  /**
   * Truncates text cleanly at word boundaries
   */
  public static truncateCleanly(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text;
    const truncated = text.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    return truncated + '...';
  }
}
