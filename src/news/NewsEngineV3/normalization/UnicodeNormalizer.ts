/**
 * ATHENA NEWS ENGINE V3 — UNICODE NORMALIZER
 * 
 * Standardizes quote variants, dashes, zero-width spaces, non-breaking spaces,
 * currency symbols, and applies NFC Unicode normalization.
 */

export class UnicodeNormalizer {
  public static normalize(text: string): string {
    if (!text) return '';

    // 1. NFC normalization
    let norm = text.normalize('NFC');

    // 2. Remove zero-width spaces & control characters
    norm = norm.replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    // 3. Normalize non-breaking and special spaces to standard space
    norm = norm.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

    // 4. Normalize quotes
    norm = norm
      .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

    // 5. Normalize dashes (em-dash, en-dash to hyphen or spaced hyphen)
    norm = norm
      .replace(/[\u2013\u2014\u2012\u2015]/g, ' - ');

    // 6. Normalize currency symbols (e.g. ₹ symbol variants)
    norm = norm.replace(/\u20B9/g, '₹');

    // 7. Collapse multiple spaces within a line while preserving single space
    norm = norm.replace(/[ \t]{2,}/g, ' ');

    return norm.trim();
  }
}
