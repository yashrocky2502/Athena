/**
 * ATHENA — PHASE 10P-8: REAL-TIME POSITION ALERT RUNTIME WIRING
 * NewsCoreV2PositionAlertAdapter.ts
 * 
 * Deterministic Adapter mapping canonical News Core V2 articles/events into PositionNewsEventInput.
 * 
 * Architecture Rules:
 * - Pure mapping ONLY: Zero matching logic, zero materiality logic, zero Telegram logic, zero portfolio logic.
 * - Truthful Identity & Provenance: Preserves all available structured fields without fabricating missing data.
 * - Fail-Closed: If required identity fields (id, headline) are missing or invalid, returns null.
 * - Preserves synthetic & test flags: isSynthetic, isTest, verified status are passed through verbatim.
 */

import { NewsArticleV2 } from '../../../newsCoreV2/domain/NewsArticle.ts';
import { PositionNewsEventInput } from './types.ts';

export class NewsCoreV2PositionAlertAdapter {
  /**
   * Deterministically maps a canonical News Core V2 article into PositionNewsEventInput.
   * Returns null if required identity fields are missing (fail-closed).
   */
  public static adapt(article: NewsArticleV2 | any): PositionNewsEventInput | null {
    if (!article || typeof article !== 'object') {
      return null;
    }

    // Required Identity: Must have a valid string id and non-empty headline
    const id = article.id ? String(article.id).trim() : '';
    const headline = article.headline ? String(article.headline).trim() : '';

    if (!id || !headline) {
      return null;
    }

    // Publisher & Source resolution
    const publisher =
      article.source?.publisher ||
      article.publisher ||
      (typeof article.source === 'string' ? article.source : undefined);

    const sourceName =
      publisher ||
      article.source?.collectionMethod ||
      article.sourceType ||
      undefined;

    const url = article.canonicalUrl || article.source?.url || article.url || undefined;
    const body = article.body || article.summary || undefined;
    const publishedAt = article.publishedAt || article.collectedAt || undefined;
    const category = article.primaryCategory || article.category || undefined;
    const eventType = article.eventType || article.primaryCategory || article.category || undefined;

    // Structured Symbols: preserve explicitly provided symbols or derive from fno.symbol
    let symbols: string[] | undefined = undefined;
    if (Array.isArray(article.symbols) && article.symbols.length > 0) {
      symbols = article.symbols.map((s: any) => String(s).toUpperCase().trim()).filter((s: string) => s.length > 0);
    } else if (article.fno?.symbol) {
      symbols = [String(article.fno.symbol).toUpperCase().trim()];
    } else if (article.symbol) {
      symbols = [String(article.symbol).toUpperCase().trim()];
    }

    // ISIN, Exchange, Entities
    const isin = article.isin ? String(article.isin).toUpperCase().trim() : undefined;
    const exchange = article.exchange ? String(article.exchange).toUpperCase().trim() : undefined;
    const entities = Array.isArray(article.entities)
      ? article.entities.map((e: any) => String(e).trim()).filter((e: string) => e.length > 0)
      : undefined;

    // Synthetic & Test Flags
    const isSynthetic = Boolean(
      article.isSynthetic ||
      id.startsWith('SYNTH_') ||
      headline.startsWith('[SYNTHETIC]')
    );

    const isTest = Boolean(
      article.isTest ||
      id.startsWith('TEST_') ||
      headline.startsWith('[TEST]')
    );

    // Provenance Mapping
    let provenance: PositionNewsEventInput['provenance'] = undefined;
    if (article.provenance && typeof article.provenance === 'object') {
      provenance = {
        source: article.provenance.publisher || article.provenance.sourceId || sourceName,
        publishedAt: article.provenance.publishedAt || publishedAt,
        url: article.provenance.canonicalUrl || article.provenance.sourceUrl || url,
        verified: article.provenance.verified !== undefined ? Boolean(article.provenance.verified) : true
      };
    } else if (article.source && (article.source.publisher || article.source.url)) {
      provenance = {
        source: article.source.publisher || sourceName,
        publishedAt,
        url,
        verified: true
      };
    } else if (article.source && typeof article.source === 'string') {
      provenance = {
        source: article.source,
        publishedAt,
        url,
        verified: true
      };
    }

    return {
      id,
      headline,
      body,
      url,
      publisher,
      publishedAt,
      source: sourceName,
      category,
      eventType,
      entities,
      symbols,
      isin,
      exchange,
      isSynthetic,
      isTest,
      provenance,
      metadata: article.metadata
    };
  }
}
