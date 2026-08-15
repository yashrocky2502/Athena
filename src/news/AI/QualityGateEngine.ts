export interface QualityGateResult {
  passed: boolean;
  issues: string[];
  cleanSummary?: string;
  cleanHighlights?: string[];
}

export class QualityGateEngine {
  private static FORBIDDEN_PATTERNS = [
    // Journalist bios & signatures
    /\bby\s+(?:reuters|bloomberg|pti|ans|staff|special correspondent|editorial team|author)\b/i,
    /\bwritten by\b/i,
    /\bfollow\s+@\w+/i,
    /\bemail\s+(?:the\s+)?author\b/i,
    
    // Disclaimers
    /\bdisclaimer\s*:/i,
    /\bpast performance is not indicative\b/i,
    /\bnot (?:a )?financial advice\b/i,
    /\bconsult your (?:financial|investment) advisor\b/i,
    
    // App download links
    /\bdownload (?:our|the) app\b/i,
    /\bclick here to install\b/i,
    /\bavailable on (?:google play|app store)\b/i,
    
    // Advertisements & Promoted content
    /\bsponsored content\b/i,
    /\bpromoted story\b/i,
    /\bpaid partnership\b/i,
    
    // Newsletters
    /\bsubscribe to (?:our )?newsletter\b/i,
    /\bsign up for (?:daily|weekly) digest\b/i,
    
    // Navigation & Footers
    /\bhome\s*>\s*markets\b/i,
    /\bback to top\b/i,
    /\ball rights reserved\b/i,
    /\bcopyright \d{4}\b/i
  ];

  public static evaluate(
    summaryText: string,
    highlights: string[],
    hasCompanyResolved: boolean
  ): QualityGateResult {
    const issues: string[] = [];

    // 1. Company Missing Check
    if (!hasCompanyResolved) {
      issues.push('Quality Gate Failure: Resolved company is missing');
    }

    // 2. Duplicate Bullets Check
    const normalizedBullets = highlights.map(h => h.toLowerCase().trim());
    const uniqueBullets = new Set(normalizedBullets);
    if (uniqueBullets.size < normalizedBullets.length) {
      issues.push('Quality Gate Failure: Duplicate bullets detected in key highlights');
    }

    // 3. Check for Forbidden Boilerplate Patterns
    const fullText = `${summaryText} ${highlights.join(' ')}`;
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(fullText)) {
        issues.push(`Quality Gate Failure: Forbidden boilerplate pattern detected: ${pattern.source}`);
      }
    }

    // 4. Clean summary text if minor issues found
    let cleanSummary = summaryText;
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      cleanSummary = cleanSummary.replace(pattern, '');
    }

    // Clean duplicate bullets if any
    const cleanHighlights: string[] = [];
    const seen = new Set<string>();
    for (const hl of highlights) {
      const key = hl.toLowerCase().trim();
      if (!seen.has(key) && hl.trim().length > 5) {
        seen.add(key);
        cleanHighlights.push(hl);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      cleanSummary: cleanSummary.trim(),
      cleanHighlights
    };
  }
}
