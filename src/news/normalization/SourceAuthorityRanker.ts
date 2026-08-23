/**
 * ATHENA NEWS ENGINE — STAGE 8.9.3 SOURCE AUTHORITY RANKER
 * SourceAuthorityRanker
 * 
 * Provides deterministic source authority tiering and domain validation.
 * 
 * Tiering Hierarchy:
 * - Tier 1: Regulatory Filings, Central Banks, Stock Exchanges, Official Disclosures (SEBI, RBI, NSE, BSE, MCX, PIB, Company IR)
 * - Tier 2: Premium Financial Wires & National Business Outlets (Reuters, Economic Times, Business Standard, CNBC TV18, Moneycontrol, LiveMint)
 * - Tier 3: General Financial Outlets & Regional Outlets
 * - Tier 4: Secondary Aggregators / Discovery Feeds
 */

export type SourceAuthorityTier = 1 | 2 | 3 | 4;

export class SourceAuthorityRanker {
  /**
   * Returns the authority tier (1 to 4) for a given publisher string or source object.
   */
  public static getAuthorityTier(sourceInput: string | { publisher?: string; tier?: number }): SourceAuthorityTier {
    if (!sourceInput) return 4;

    if (typeof sourceInput === 'object') {
      if (typeof sourceInput.tier === 'number' && [1, 2, 3, 4].includes(sourceInput.tier)) {
        return sourceInput.tier as SourceAuthorityTier;
      }
      sourceInput = sourceInput.publisher || '';
    }

    const norm = String(sourceInput).trim().toLowerCase();

    // Tier 1: Official regulators, exchanges, central banks, official filings
    if (
      /\b(bse|nse|sebi|rbi|mcx|pib|exchange filing|regulatory filing|company ir|company disclosure|official filing)\b/i.test(norm) ||
      norm === 'bse' || norm === 'nse' || norm === 'sebi' || norm === 'rbi'
    ) {
      return 1;
    }

    // Tier 2: Major financial wires and primary national business publications
    if (
      /\b(reuters|economic times|business standard|cnbc|cnbc tv18|moneycontrol|livemint|mint|bloomberg|financial express)\b/i.test(norm) ||
      norm.includes('reuters') || norm.includes('economic times') || norm.includes('moneycontrol')
    ) {
      return 2;
    }

    // Tier 3: Other financial news outlets
    if (
      /\b(yahoo|google news|business today|zee business|ndtv|moneyworks|business line|financial news)\b/i.test(norm)
    ) {
      return 3;
    }

    // Tier 4: Discovery feeds / secondary aggregators
    return 4;
  }

  /**
   * Compares two sources. Returns positive if sourceA outranks sourceB, negative if sourceB outranks sourceA, 0 if equal.
   */
  public static compareAuthority(
    sourceA: string | { publisher?: string; tier?: number },
    sourceB: string | { publisher?: string; tier?: number }
  ): number {
    const tierA = this.getAuthorityTier(sourceA);
    const tierB = this.getAuthorityTier(sourceB);
    // Lower tier number means higher authority (Tier 1 > Tier 2 > Tier 3 > Tier 4)
    return tierB - tierA;
  }
}
