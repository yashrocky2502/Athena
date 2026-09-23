/**
 * ATHENA NEWS ENGINE — PHASE 10E
 * Signal Source Provenance Data Model
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
  | 'UNKNOWN'
  | 'SYNTHETIC_TEST';

export interface SignalSourceProvenance {
  articleId: string;
  publisher: string;
  sourceUrl?: string;
  tier?: number;
  publishedAt?: string;
}

export interface SignalProvenance {
  status: SignalProvenanceStatus;
  primarySource?: SignalSourceProvenance;
  supportingSources: SignalSourceProvenance[];
  sourceCount: number;
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
 * Creates an explicit SYNTHETIC_TEST provenance container.
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
 * Returns 'UNKNOWN' if no valid source evidence is present.
 */
export function deriveSourceTierString(provenance?: SignalProvenance): 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4' | 'UNKNOWN' {
  if (!provenance || provenance.status === 'UNKNOWN') {
    return 'UNKNOWN';
  }
  const tierNum = provenance.primarySource?.tier ?? provenance.supportingSources[0]?.tier;
  if (tierNum === 1) return 'TIER_1';
  if (tierNum === 2) return 'TIER_2';
  if (tierNum === 3) return 'TIER_3';
  if (tierNum === 4) return 'TIER_4';
  return 'UNKNOWN';
}

/**
 * Deterministically resolves SignalProvenance from an originating NewsEvent and/or NewsArticle.
 * Never invents a publisher, tier, or URL.
 */
export function resolveSignalProvenance(
  event?: any,
  article?: any
): SignalProvenance {
  // 1. Synthetic test detection
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
        articleId: event?.primarySource?.articleId || event?.latestArticleId || article?.id || article?.articleId || 'test-article-id',
        publisher: pub,
        sourceUrl: event?.primarySource?.sourceUrl || article?.sourceUrl || article?.url,
        tier: event?.primarySource?.tier ?? (article as any)?.sourceTier ?? 1,
        publishedAt: event?.primarySource?.publishedAt || article?.publishedAt
      } : undefined,
      sourceCount: event?.sourceCount || (pub ? 1 : 0)
    });
  }

  // 2. Direct reuse if authoritative provenance is already attached
  if (event?.provenance && typeof event.provenance === 'object' && event.provenance.status) {
    return event.provenance;
  }
  if (article?.provenance && typeof article.provenance === 'object' && article.provenance.status) {
    return article.provenance;
  }

  // 3. Extract primary source candidate from NewsEvent primarySource
  let primaryCandidate: SignalSourceProvenance | undefined;

  if (event?.primarySource && typeof event.primarySource === 'object') {
    const rawPub = typeof event.primarySource.publisher === 'string' ? event.primarySource.publisher.trim() : '';
    if (rawPub && rawPub.toUpperCase() !== 'UNKNOWN') {
      const artId = event.primarySource.articleId || event.latestArticleId || article?.id || article?.articleId || '';
      const url = event.primarySource.sourceUrl || article?.sourceUrl || article?.source?.url || article?.url;
      const pubAt = event.primarySource.publishedAt || article?.publishedAt;
      
      let tier: number | undefined;
      if (typeof event.primarySource.tier === 'number' && event.primarySource.tier >= 1 && event.primarySource.tier <= 4) {
        tier = event.primarySource.tier;
      } else {
        const rankedTier = SourceAuthorityRanker.getInstance().getAuthorityTier(rawPub, url);
        if (typeof rankedTier === 'number' && rankedTier >= 1 && rankedTier <= 4) {
          tier = rankedTier;
        }
      }

      primaryCandidate = {
        articleId: artId,
        publisher: rawPub,
        sourceUrl: url ? url : undefined,
        tier,
        publishedAt: pubAt ? pubAt : undefined
      };
    }
  }

  // 4. Fallback to article if NewsEvent primarySource was missing
  if (!primaryCandidate && article && typeof article === 'object') {
    const rawSource = article.source;
    let rawPub = '';
    if (typeof rawSource === 'string') {
      rawPub = rawSource.trim();
    } else if (rawSource && typeof rawSource === 'object') {
      rawPub = (rawSource.publisher || rawSource.name || '').trim();
    } else if (typeof article.publisher === 'string') {
      rawPub = article.publisher.trim();
    }

    if (rawPub && rawPub.toUpperCase() !== 'UNKNOWN') {
      const artId = article.id || article.articleId || event?.latestArticleId || '';
      const url = article.sourceUrl || article.source?.url || article.url;
      const pubAt = article.publishedAt || event?.firstSeenAt;

      let tier: number | undefined;
      if (typeof (article as any).sourceTier === 'number' && (article as any).sourceTier >= 1 && (article as any).sourceTier <= 4) {
        tier = (article as any).sourceTier;
      } else if (typeof (rawSource as any)?.tier === 'number' && (rawSource as any).tier >= 1 && (rawSource as any).tier <= 4) {
        tier = (rawSource as any).tier;
      } else {
        const rankedTier = SourceAuthorityRanker.getInstance().getAuthorityTier(rawPub, url);
        if (typeof rankedTier === 'number' && rankedTier >= 1 && rankedTier <= 4) {
          tier = rankedTier;
        }
      }

      primaryCandidate = {
        articleId: artId,
        publisher: rawPub,
        sourceUrl: url ? url : undefined,
        tier,
        publishedAt: pubAt ? pubAt : undefined
      };
    }
  }

  // 5. Extract supporting sources
  const supportingSources: SignalSourceProvenance[] = [];
  if (Array.isArray(event?.supportingSources)) {
    for (const sup of event.supportingSources) {
      if (sup && typeof sup === 'object') {
        const rawPub = typeof sup.publisher === 'string' ? sup.publisher.trim() : '';
        if (rawPub && rawPub.toUpperCase() !== 'UNKNOWN') {
          const artId = sup.articleId || '';
          const url = sup.sourceUrl;
          const pubAt = sup.publishedAt;
          
          let tier: number | undefined;
          if (typeof sup.tier === 'number' && sup.tier >= 1 && sup.tier <= 4) {
            tier = sup.tier;
          } else {
            const rankedTier = SourceAuthorityRanker.getInstance().getAuthorityTier(rawPub, url);
            if (typeof rankedTier === 'number' && rankedTier >= 1 && rankedTier <= 4) {
              tier = rankedTier;
            }
          }

          supportingSources.push({
            articleId: artId,
            publisher: rawPub,
            sourceUrl: url ? url : undefined,
            tier,
            publishedAt: pubAt ? pubAt : undefined
          });
        }
      }
    }
  }

  // 6. Evaluate status and source count
  if (primaryCandidate) {
    const explicitSourceCount = typeof event?.sourceCount === 'number' && event.sourceCount > 0
      ? event.sourceCount
      : (1 + supportingSources.length);
    return {
      status: 'VERIFIED',
      primarySource: primaryCandidate,
      supportingSources,
      sourceCount: Math.max(1 + supportingSources.length, explicitSourceCount)
    };
  }

  if (supportingSources.length > 0) {
    return {
      status: 'PARTIALLY_VERIFIED',
      supportingSources,
      sourceCount: supportingSources.length
    };
  }

  // Fail-closed: No authoritative source evidence available
  return createUnknownProvenance();
}
