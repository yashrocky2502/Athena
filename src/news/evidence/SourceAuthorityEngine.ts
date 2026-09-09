/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * SourceAuthorityEngine.ts
 * 
 * Deterministic source classification and authority tier scoring.
 * 
 * Tiers:
 * P0 — AUTHORITATIVE (100) - NSE, BSE, RBI, SEBI, official exchange filings, MCA
 * P1 — PRIMARY (85)       - Company IR, authorized broker feeds, official government releases
 * P2 — SECONDARY (70)     - Reuters, Bloomberg, established financial publications
 * P3 — AGGREGATED (50)    - RSS aggregators, syndicated copies
 * P4 — UNVERIFIED (25)    - Unverified web feeds, social scrapers
 */

import { SourceTier, EvidenceSourceMetadata } from './types.ts';

export class SourceAuthorityEngine {
  private static instance: SourceAuthorityEngine;
  private customAuthorityRules: Map<string, { tier: SourceTier; baseScore: number }> = new Map();

  private constructor() {
    this.initializeDefaults();
  }

  public static getInstance(): SourceAuthorityEngine {
    if (!SourceAuthorityEngine.instance) {
      SourceAuthorityEngine.instance = new SourceAuthorityEngine();
    }
    return SourceAuthorityEngine.instance;
  }

  private initializeDefaults(): void {
    // P0 - Authoritative (Exchanges, Central Bank, Securities Regulator)
    this.registerRule('NSE', 'P0_AUTHORITATIVE', 100);
    this.registerRule('NSE_DIRECT', 'P0_AUTHORITATIVE', 100);
    this.registerRule('BSE', 'P0_AUTHORITATIVE', 100);
    this.registerRule('BSE_DIRECT', 'P0_AUTHORITATIVE', 100);
    this.registerRule('RBI', 'P0_AUTHORITATIVE', 100);
    this.registerRule('SEBI', 'P0_AUTHORITATIVE', 100);
    this.registerRule('MCA', 'P0_AUTHORITATIVE', 100);
    this.registerRule('OFFICIAL_FILING', 'P0_AUTHORITATIVE', 100);
    this.registerRule('EXCHANGE_DISCLOSURE', 'P0_AUTHORITATIVE', 100);

    // P1 - Primary (Company Investor Relations, Verified Broker, PIB)
    this.registerRule('INVESTOR_RELATIONS', 'P1_PRIMARY', 88);
    this.registerRule('COMPANY_IR', 'P1_PRIMARY', 88);
    this.registerRule('PIB', 'P1_PRIMARY', 86);
    this.registerRule('BROKER_DIRECT', 'P1_PRIMARY', 85);
    this.registerRule('ZERODHA_FEED', 'P1_PRIMARY', 85);
    this.registerRule('SHOONYA_FEED', 'P1_PRIMARY', 85);
    this.registerRule('GOVERNMENT_RELEASE', 'P1_PRIMARY', 85);
    this.registerRule('REUTERS_TERMINAL', 'P1_PRIMARY', 95);

    // P2 - Secondary (Established Financial Press)
    this.registerRule('REUTERS', 'P2_SECONDARY', 78);
    this.registerRule('BLOOMBERG', 'P2_SECONDARY', 78);
    this.registerRule('ECONOMIC_TIMES', 'P2_SECONDARY', 74);
    this.registerRule('BUSINESS_STANDARD', 'P2_SECONDARY', 74);
    this.registerRule('MONEYCONTROL', 'P2_SECONDARY', 70);
    this.registerRule('LIVEMINT', 'P2_SECONDARY', 70);
    this.registerRule('CNBC_TV18', 'P2_SECONDARY', 70);

    // P3 - Aggregated (Syndicated news, aggregators)
    this.registerRule('GOOGLE_NEWS', 'P3_AGGREGATED', 50);
    this.registerRule('GOOGLE_NEWS_RSS', 'P3_AGGREGATED', 50);
    this.registerRule('NEWS_API', 'P3_AGGREGATED', 50);
    this.registerRule('RSS_AGGREGATOR', 'P3_AGGREGATED', 48);

    // P4 - Unverified
    this.registerRule('WEB_SCRAPER', 'P4_UNVERIFIED', 25);
    this.registerRule('SOCIAL_FEED', 'P4_UNVERIFIED', 20);
    this.registerRule('COMMUNITY_POST', 'P4_UNVERIFIED', 15);
  }

  public registerRule(sourceKey: string, tier: SourceTier, baseScore: number): void {
    this.customAuthorityRules.set(sourceKey.toUpperCase(), {
      tier,
      baseScore: Math.min(100, Math.max(0, baseScore))
    });
  }

  /**
   * Classify a source identifier deterministically
   */
  public classifySource(source: string, isOfficialExchange: boolean = false, isRegulatory: boolean = false): EvidenceSourceMetadata {
    if (!source || typeof source !== 'string') {
      return {
        sourceId: 'UNKNOWN',
        name: 'Unknown Source',
        tier: 'P4_UNVERIFIED',
        baseAuthorityScore: 20
      };
    }

    const cleanSource = source.trim().toUpperCase();

    // Fast-path for official exchange or regulatory overrides
    if (isOfficialExchange || isRegulatory) {
      return {
        sourceId: cleanSource,
        name: source,
        tier: 'P0_AUTHORITATIVE',
        isOfficialExchange,
        isRegulatory,
        baseAuthorityScore: 100
      };
    }

    let res: EvidenceSourceMetadata;

    const matched = this.customAuthorityRules.get(cleanSource);
    if (matched) {
      res = {
        sourceId: cleanSource,
        name: source,
        tier: matched.tier,
        baseAuthorityScore: matched.baseScore
      };
    } else if (cleanSource.includes('NSE') || cleanSource.includes('BSE') || cleanSource.includes('SEBI') || cleanSource.includes('RBI')) {
      res = { sourceId: cleanSource, name: source, tier: 'P0_AUTHORITATIVE', baseAuthorityScore: 100 };
    } else if (cleanSource.includes('FILING') || cleanSource.includes('DISCLOSURE') || cleanSource.includes('INVESTOR')) {
      res = { sourceId: cleanSource, name: source, tier: 'P1_PRIMARY', baseAuthorityScore: 85 };
    } else if (cleanSource.includes('REUTERS') || cleanSource.includes('BLOOMBERG') || cleanSource.includes('MINT') || cleanSource.includes('TIMES') || cleanSource.includes('MONEYCONTROL')) {
      res = { sourceId: cleanSource, name: source, tier: 'P2_SECONDARY', baseAuthorityScore: 70 };
    } else if (cleanSource.includes('RSS') || cleanSource.includes('AGGREGAT') || cleanSource.includes('GOOGLE')) {
      res = { sourceId: cleanSource, name: source, tier: 'P3_AGGREGATED', baseAuthorityScore: 50 };
    } else {
      res = {
        sourceId: cleanSource,
        name: source,
        tier: 'P4_UNVERIFIED',
        baseAuthorityScore: 20
      };
    }

    res.authorityScore = res.baseAuthorityScore;
    res.isPrimary = res.tier === 'P0_AUTHORITATIVE' || res.tier === 'P1_PRIMARY';
    return res;
  }

  /**
   * Return pure numeric authority score (0 - 100)
   */
  public getAuthorityScore(source: string, isOfficialExchange: boolean = false): number {
    return this.classifySource(source, isOfficialExchange).baseAuthorityScore;
  }
}

export const sourceAuthorityEngine = SourceAuthorityEngine.getInstance();
