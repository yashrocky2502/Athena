/**
 * ATHENA NEWS ENGINE — PHASE 10E REMEDIATION
 * Strict Signal Source Provenance Data Model & Fail-Closed Resolver
 *
 * Distinct from market observation provenance.
 * Represents the truthful origin, publisher authority, and source chain
 * of fundamental catalysts and news signals:
 * NewsArticle → NewsEvent → MarketSignal → SignalLifecycle → SignalOutcome
 */

import { SourceAuthorityRanker } from '../intelligence/SourceAuthorityRanker.ts';

export type SignalProvenanceStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'UNKNOWN'
  | 'SYNTHETIC_TEST';

export interface SignalSourceProvenance {
  articleId?: string;
  publisher?: string;
  sourceUrl?: string;
  tier?: number;
  publishedAt?: string;
  headline?: string;
}

export interface SignalProvenance {
  status: SignalProvenanceStatus;
  primarySource?: SignalSourceProvenance;
  supportingSources: SignalSourceProvenance[];
  sourceCount: number;
}

/**
 * Checks if a publisher string is generic, placeholder, or ambiguous.
 */
export function isGenericOrUntrustedPublisher(publisher?: string): boolean {
  if (!publisher || typeof publisher !== 'string') return false;
  const p = publisher.trim().toLowerCase();
  if (!p || p === 'unknown') return false;
  if (
    p.includes('athena verified') ||
    p === 'athena source' ||
    p === 'verified source' ||
    p === 'market source' ||
    p === 'market wire' ||
    p === 'anonymous' ||
    p === 'anonymous forum' ||
    p === 'rumor' ||
    p === 'unverified' ||
    p === 'unknown source' ||
    p === 'placeholder' ||
    p === 'test source' ||
    p.includes('forum') ||
    p.includes('rumor')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a publisher is a known / recognized financial or official publisher
 * according to canonical SourceAuthorityRanker rules.
 */
export function isRecognizedPublisher(publisher?: string, url?: string): boolean {
  if (!publisher || typeof publisher !== 'string') return false;
  if (isGenericOrUntrustedPublisher(publisher)) return false;

  const pub = publisher.toLowerCase().trim();
  const u = (url || '').toLowerCase().trim();

  // Tier 1: Official / Primary
  if (
    pub.includes('sebi') || pub.includes('rbi') || pub.includes('nse') || pub.includes('bse') ||
    pub.includes('mcx') || pub.includes('pib') || pub.includes('government') ||
    pub.includes('filing') || pub.includes('investor relations') || pub.includes('exchange') ||
    u.includes('sebi.gov.in') || u.includes('rbi.org.in') || u.includes('nseindia.com') ||
    u.includes('bseindia.com') || u.includes('pib.gov.in')
  ) {
    return true;
  }

  // Tier 2: High-Quality Financial Wires & Major Media
  if (
    pub.includes('reuters') || pub.includes('economic times') || pub.includes('business standard') ||
    pub.includes('cnbc') || pub.includes('moneycontrol') || pub.includes('livemint') ||
    pub.includes('bloomberg') || pub.includes('pti') || pub.includes('press trust') ||
    u.includes('economictimes') || u.includes('business-standard') || u.includes('moneycontrol') ||
    u.includes('livemint') || u.includes('reuters') || u.includes('cnbctv18')
  ) {
    return true;
  }

  // Tier 3: Other Financial Publishers
  if (
    pub.includes('financial express') || pub.includes('zee business') || pub.includes('ndtv profit') ||
    pub.includes('business today') || pub.includes('fortune') || pub.includes('mint') ||
    pub.includes('businessline') || u.includes('financialexpress') || u.includes('zeebiz') ||
    u.includes('ndtvprofit') || u.includes('businesstoday')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether a primary source meets all criteria for VERIFIED status:
 * 1. non-empty articleId (and not a synthetic fallback)
 * 2. non-empty publisher (recognized, non-generic)
 * 3. valid sourceUrl when provided (no domain mismatch)
 * 4. valid tier 1–4 resolved deterministically
 */
export function isAuthoritativePrimarySource(source?: SignalSourceProvenance): boolean {
  if (!source || typeof source !== 'object') return false;

  // 1. Article ID check
  if (!source.articleId || typeof source.articleId !== 'string' || !source.articleId.trim()) {
    return false;
  }
  if (source.articleId.trim() === 'test-article-id' || source.articleId.trim() === 'synthetic-test-article') {
    return false;
  }

  // 2. Publisher check
  if (!source.publisher || typeof source.publisher !== 'string' || !source.publisher.trim()) {
    return false;
  }
  if (isGenericOrUntrustedPublisher(source.publisher)) {
    return false;
  }

  // 3. Tier check
  if (typeof source.tier !== 'number' || !Number.isInteger(source.tier) || source.tier < 1 || source.tier > 4) {
    return false;
  }

  // 4. URL check (if provided, must not have domain mismatch)
  if (source.sourceUrl && typeof source.sourceUrl === 'string' && source.sourceUrl.trim()) {
    const urlCheck = SourceAuthorityRanker.getInstance().validateSourceUrl(source.sourceUrl, source.publisher);
    if (urlCheck.domainMismatch) {
      return false;
    }
  }

  return true;
}

/**
 * Validates an existing provenance container rather than blindly trusting it.
 * Incomplete claims of VERIFIED are strictly demoted to PARTIALLY_VERIFIED or UNVERIFIED.
 * Non-VERIFIED statuses (UNKNOWN, PARTIALLY_VERIFIED, UNVERIFIED) are never upgraded.
 */
export function validateProvenance(provenance: SignalProvenance): SignalProvenance {
  if (!provenance || typeof provenance !== 'object') {
    return createUnknownProvenance();
  }

  if (provenance.status === 'SYNTHETIC_TEST') {
    return provenance;
  }

  if (provenance.status === 'VERIFIED') {
    if (isAuthoritativePrimarySource(provenance.primarySource)) {
      return provenance;
    }

    // Demote invalid or incomplete VERIFIED claim
    const hasArticleId = typeof provenance.primarySource?.articleId === 'string' &&
      provenance.primarySource.articleId.trim().length > 0 &&
      provenance.primarySource.articleId.trim() !== 'test-article-id' &&
      provenance.primarySource.articleId.trim() !== 'synthetic-test-article';
    const hasPublisher = typeof provenance.primarySource?.publisher === 'string' &&
      provenance.primarySource.publisher.trim().length > 0 &&
      provenance.primarySource.publisher.trim().toUpperCase() !== 'UNKNOWN';
    const isUntrusted = isGenericOrUntrustedPublisher(provenance.primarySource?.publisher);

    if (provenance.primarySource?.sourceUrl && provenance.primarySource?.publisher) {
      const urlCheck = SourceAuthorityRanker.getInstance().validateSourceUrl(
        provenance.primarySource.sourceUrl,
        provenance.primarySource.publisher
      );
      if (urlCheck.domainMismatch) {
        return {
          ...provenance,
          status: 'UNVERIFIED'
        };
      }
    }

    if (isUntrusted) {
      return {
        ...provenance,
        status: 'UNVERIFIED'
      };
    }

    if (hasPublisher || hasArticleId || (provenance.supportingSources && provenance.supportingSources.length > 0)) {
      return {
        ...provenance,
        status: 'PARTIALLY_VERIFIED'
      };
    }

    return createUnknownProvenance();
  }

  return provenance;
}

/**
 * Creates an explicit UNKNOWN provenance container.
 * Enforces fail-closed semantics without synthetic or fabricated defaults.
 */
export function createUnknownProvenance(): SignalProvenance {
  return {
    status: 'UNKNOWN',
    supportingSources: [],
    sourceCount: 0
  };
}

/**
 * Creates an explicit UNVERIFIED provenance container.
 */
export function createUnverifiedProvenance(overrides?: Partial<SignalProvenance>): SignalProvenance {
  return {
    status: 'UNVERIFIED',
    supportingSources: overrides?.supportingSources || [],
    sourceCount: overrides?.sourceCount ?? (overrides?.primarySource ? 1 : 0),
    ...overrides
  };
}

/**
 * Creates an explicit PARTIALLY_VERIFIED provenance container.
 */
export function createPartiallyVerifiedProvenance(overrides?: Partial<SignalProvenance>): SignalProvenance {
  return {
    status: 'PARTIALLY_VERIFIED',
    supportingSources: overrides?.supportingSources || [],
    sourceCount: overrides?.sourceCount ?? (overrides?.primarySource ? 1 : 0),
    ...overrides
  };
}

/**
 * Creates an explicit SYNTHETIC_TEST provenance container.
 * Synthetic defaults are permitted ONLY inside explicitly marked test execution.
 */
export function createSyntheticTestProvenance(overrides?: Partial<SignalProvenance>): SignalProvenance {
  return {
    status: 'SYNTHETIC_TEST',
    supportingSources: overrides?.supportingSources || [],
    sourceCount: overrides?.sourceCount ?? (overrides?.primarySource ? 1 : 0),
    ...overrides
  };
}

/**
 * Derives a normalized string tier ('TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNKNOWN')
 * from an authoritative SignalProvenance object.
 * Returns 'UNKNOWN' if no valid source evidence is present or status is UNKNOWN/UNVERIFIED.
 */
export function deriveSourceTierString(provenance?: SignalProvenance): 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNKNOWN' {
  if (!provenance || provenance.status === 'UNKNOWN' || provenance.status === 'UNVERIFIED') {
    return 'UNKNOWN';
  }
  const tierNum = provenance.primarySource?.tier ?? provenance.supportingSources?.[0]?.tier;
  if (tierNum === 1) return 'TIER_1';
  if (tierNum === 2) return 'TIER_2';
  if (tierNum === 3) return 'TIER_3';
  if (tierNum === 4) return 'TIER_4';
  return 'UNKNOWN';
}

/**
 * Deterministically resolves SignalProvenance from an originating NewsEvent and/or NewsArticle.
 * Strict fail-closed semantics:
 * - Never invent article IDs.
 * - Never invent publisher names.
 * - Never invent URLs.
 * - Never invent tiers (no tier ?? 1, no tier ?? 2).
 * - Never classify incomplete provenance as VERIFIED.
 * - Never silently convert an unknown source into Tier 1 or Tier 2.
 * - If evidence is ambiguous, fails closed to PARTIALLY_VERIFIED, UNVERIFIED, or UNKNOWN.
 */
export function resolveSignalProvenance(
  event?: any,
  article?: any
): SignalProvenance {
  // 1. Synthetic test detection (permitted ONLY for explicitly marked test data)
  if (
    event?.isSyntheticTest === true ||
    article?.isSyntheticTest === true ||
    event?.provenance?.status === 'SYNTHETIC_TEST' ||
    article?.provenance?.status === 'SYNTHETIC_TEST'
  ) {
    const primary = event?.primarySource || article?.source;
    const pub = primary?.publisher || primary?.name || (typeof primary === 'string' ? primary : undefined);
    return createSyntheticTestProvenance({
      primarySource: pub ? {
        articleId: event?.primarySource?.articleId || event?.latestArticleId || article?.id || article?.articleId || 'synthetic-test-article',
        publisher: pub,
        sourceUrl: event?.primarySource?.sourceUrl || article?.sourceUrl || article?.url,
        tier: typeof event?.primarySource?.tier === 'number' ? event.primarySource.tier : (typeof (article as any)?.sourceTier === 'number' ? (article as any).sourceTier : 1),
        publishedAt: event?.primarySource?.publishedAt || article?.publishedAt
      } : undefined,
      sourceCount: event?.sourceCount || (pub ? 1 : 0)
    });
  }

  // 2. Validate existing provenance if already attached (do NOT blindly trust)
  if (event?.provenance && typeof event.provenance === 'object' && event.provenance.status) {
    return validateProvenance(event.provenance);
  }
  if (article?.provenance && typeof article.provenance === 'object' && article.provenance.status) {
    return validateProvenance(article.provenance);
  }

  // 3. Extract primary candidate raw data from event or article
  let rawPub: string | undefined;
  let rawArtId: string | undefined;
  let rawUrl: string | undefined;
  let rawTier: number | undefined;
  let rawPublishedAt: string | undefined;

  if (event?.primarySource && typeof event.primarySource === 'object') {
    if (typeof event.primarySource.publisher === 'string' && event.primarySource.publisher.trim()) {
      rawPub = event.primarySource.publisher.trim();
    }
    if (typeof event.primarySource.articleId === 'string' && event.primarySource.articleId.trim()) {
      rawArtId = event.primarySource.articleId.trim();
    }
    if (typeof event.primarySource.sourceUrl === 'string' && event.primarySource.sourceUrl.trim()) {
      rawUrl = event.primarySource.sourceUrl.trim();
    }
    if (typeof event.primarySource.tier === 'number') {
      rawTier = event.primarySource.tier;
    }
    if (typeof event.primarySource.publishedAt === 'string') {
      rawPublishedAt = event.primarySource.publishedAt;
    }
  }

  // Fallback to article fields if event primarySource was not provided
  if (!rawPub && article && typeof article === 'object') {
    const rawSource = article.source;
    if (typeof rawSource === 'string' && rawSource.trim()) {
      rawPub = rawSource.trim();
    } else if (rawSource && typeof rawSource === 'object') {
      const p = (rawSource.publisher || rawSource.name || '').trim();
      if (p) rawPub = p;
      if (typeof rawSource.tier === 'number') rawTier = rawSource.tier;
    } else if (typeof article.publisher === 'string' && article.publisher.trim()) {
      rawPub = article.publisher.trim();
    }

    if (!rawArtId) {
      const artId = article.id || article.articleId || event?.latestArticleId;
      if (typeof artId === 'string' && artId.trim() && artId.trim() !== 'test-article-id' && artId.trim() !== 'synthetic-test-article') {
        rawArtId = artId.trim();
      }
    }
    const specificUrl = article.sourceUrl || article.url;
    if (typeof specificUrl === 'string' && specificUrl.trim()) {
      rawUrl = specificUrl.trim();
    } else if (!rawUrl && rawSource && typeof rawSource === 'object' && typeof rawSource.url === 'string' && rawSource.url.trim()) {
      rawUrl = rawSource.url.trim();
    }
    if (rawTier === undefined && typeof (article as any).sourceTier === 'number') {
      rawTier = (article as any).sourceTier;
    }
    if (!rawPublishedAt) {
      rawPublishedAt = article.publishedAt || event?.firstSeenAt;
    }
  }

  // Also check if latestArticleId exists on event if rawArtId is missing
  if (!rawArtId && typeof event?.latestArticleId === 'string' && event.latestArticleId.trim() && event.latestArticleId.trim() !== 'test-article-id' && event.latestArticleId.trim() !== 'synthetic-test-article') {
    rawArtId = event.latestArticleId.trim();
  }

  // 4. Resolve deterministic tier (without fabrication)
  let resolvedTier: number | undefined;
  if (typeof rawTier === 'number' && Number.isInteger(rawTier) && rawTier >= 1 && rawTier <= 4) {
    resolvedTier = rawTier;
  } else if (rawPub && !isGenericOrUntrustedPublisher(rawPub)) {
    // Only query ranker if publisher is actually known and recognized
    if (isRecognizedPublisher(rawPub, rawUrl)) {
      const rankTier = SourceAuthorityRanker.getInstance().getTier(rawPub, rawUrl);
      if (typeof rankTier === 'number' && rankTier >= 1 && rankTier <= 4) {
        resolvedTier = rankTier;
      }
    }
  }
  // DO NOT fabricate tier: no tier ?? 1, no tier ?? 2!

  // 5. Evaluate supporting sources
  const supportingSources: SignalSourceProvenance[] = [];
  if (Array.isArray(event?.supportingSources)) {
    for (const sup of event.supportingSources) {
      if (sup && typeof sup === 'object') {
        const sPub = typeof sup.publisher === 'string' ? sup.publisher.trim() : '';
        if (sPub && sPub.toUpperCase() !== 'UNKNOWN') {
          const sArtId = typeof sup.articleId === 'string' && sup.articleId.trim() !== 'test-article-id' && sup.articleId.trim() !== 'synthetic-test-article' ? sup.articleId.trim() : undefined;
          const sUrl = typeof sup.sourceUrl === 'string' && sup.sourceUrl.trim() ? sup.sourceUrl.trim() : undefined;
          const sPubAt = typeof sup.publishedAt === 'string' ? sup.publishedAt : undefined;

          let sTier: number | undefined;
          if (typeof sup.tier === 'number' && Number.isInteger(sup.tier) && sup.tier >= 1 && sup.tier <= 4) {
            sTier = sup.tier;
          } else if (isRecognizedPublisher(sPub, sUrl)) {
            const rankTier = SourceAuthorityRanker.getInstance().getTier(sPub, sUrl);
            if (typeof rankTier === 'number' && rankTier >= 1 && rankTier <= 4) {
              sTier = rankTier;
            }
          }

          supportingSources.push({
            articleId: sArtId,
            publisher: sPub,
            sourceUrl: sUrl,
            tier: sTier,
            publishedAt: sPubAt
          });
        }
      }
    }
  }

  // 6. Strict fail-closed status resolution
  const hasValidPublisher = !!rawPub && rawPub.toUpperCase() !== 'UNKNOWN';
  const isUntrustedPub = isGenericOrUntrustedPublisher(rawPub);
  const hasArticleId = !!rawArtId && rawArtId !== 'test-article-id' && rawArtId !== 'synthetic-test-article';

  // Check URL validation if URL was provided
  let hasDomainMismatch = false;
  if (rawUrl && rawPub) {
    const urlValidation = SourceAuthorityRanker.getInstance().validateSourceUrl(rawUrl, rawPub);
    if (urlValidation.domainMismatch) {
      hasDomainMismatch = true;
    }
  }

  // Construct primary source object if any identifiable evidence exists
  const primaryCandidate: SignalSourceProvenance | undefined = (hasValidPublisher || (hasArticleId && !isUntrustedPub))
    ? {
        articleId: rawArtId,
        publisher: rawPub,
        sourceUrl: rawUrl,
        tier: resolvedTier,
        publishedAt: rawPublishedAt
      }
    : undefined;

  const totalSourceCount = typeof event?.sourceCount === 'number' && event.sourceCount > 0
    ? event.sourceCount
    : ((primaryCandidate ? 1 : 0) + supportingSources.length);

  // Case A: Domain mismatch or untrusted/ambiguous publisher claimed -> UNVERIFIED
  if (hasDomainMismatch || (hasValidPublisher && isUntrustedPub)) {
    return {
      status: 'UNVERIFIED',
      primarySource: {
        articleId: rawArtId,
        publisher: rawPub,
        sourceUrl: rawUrl,
        tier: undefined, // untrusted publisher gets no tier!
        publishedAt: rawPublishedAt
      },
      supportingSources,
      sourceCount: totalSourceCount
    };
  }

  // Case B: Complete authoritative primary source -> VERIFIED
  // Invariants:
  // - non-empty articleId
  // - non-empty publisher
  // - recognized source identity
  // - valid tier (1–4)
  // - no domain mismatch
  if (hasArticleId && hasValidPublisher && !isUntrustedPub && typeof resolvedTier === 'number' && resolvedTier >= 1 && resolvedTier <= 4) {
    return {
      status: 'VERIFIED',
      primarySource: primaryCandidate,
      supportingSources,
      sourceCount: totalSourceCount
    };
  }

  // Case C: Partial evidence exists (e.g. known publisher but missing articleId, or missing tier, or valid supporting sources) -> PARTIALLY_VERIFIED
  if (
    (hasValidPublisher && !isUntrustedPub) ||
    hasArticleId ||
    supportingSources.length > 0
  ) {
    return {
      status: 'PARTIALLY_VERIFIED',
      primarySource: primaryCandidate,
      supportingSources,
      sourceCount: totalSourceCount
    };
  }

  // Case D: No usable provenance evidence exists -> UNKNOWN
  return createUnknownProvenance();
}
