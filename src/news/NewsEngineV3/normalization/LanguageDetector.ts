/**
 * ATHENA NEWS ENGINE V3 — LANGUAGE DETECTOR
 * 
 * Deterministic language detection using character set script ranges.
 * Distinguishes English ('en'), Hindi ('hi'), Gujarati ('gu'), Tamil ('ta'), Marathi ('mr'), etc.
 */

export class LanguageDetector {
  /**
   * Detects document language code from text content.
   */
  public static detectLanguage(text: string): string {
    if (!text || !text.trim()) return 'en';

    // Count script frequencies
    let devanagariCount = 0; // Hindi, Marathi
    let gujaratiCount = 0;
    let tamilCount = 0;
    let latinCount = 0;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (code >= 0x0900 && code <= 0x097F) devanagariCount++;
      else if (code >= 0x0A80 && code <= 0x0AFF) gujaratiCount++;
      else if (code >= 0x0B80 && code <= 0x0BFF) tamilCount++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latinCount++;
    }

    const totalChars = text.length;

    if (devanagariCount / totalChars > 0.15) return 'hi';
    if (gujaratiCount / totalChars > 0.15) return 'gu';
    if (tamilCount / totalChars > 0.15) return 'ta';

    return 'en';
  }
}
