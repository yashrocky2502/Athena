/**
 * ATHENA NEWS ENGINE V3 — METADATA EXTRACTOR
 * 
 * Extracts structured metadata including publisher name, article title, deck/subtitle,
 * byline author, publication date, category, tags, and source/canonical URLs.
 */

import { V3PublisherId } from '../types/V3Types';
import { NormalizedMetadata } from './types/NormalizationTypes';
import { DateNormalizer } from './DateNormalizer';
import { CanonicalUrlResolver } from './CanonicalUrlResolver';

export class MetadataExtractor {
  /**
   * Extracts clean normalized metadata from raw input fields.
   */
  public static extractMetadata(rawInput: {
    title?: string;
    publisher?: string;
    publisherId?: V3PublisherId;
    sourceUrl?: string;
    canonicalUrl?: string;
    publishedAt?: string;
    modifiedAt?: string;
    author?: string;
    subtitle?: string;
    category?: string;
    tags?: string[];
    rawContent?: string;
  }): NormalizedMetadata {
    const title = (rawInput.title || '').trim();
    const publisherId = rawInput.publisherId || 'MONEYCONTROL';
    const publisherNameMap: Record<string, string> = {
      'REUTERS': 'Reuters',
      'ECONOMIC_TIMES': 'Economic Times',
      'MONEYCONTROL': 'Moneycontrol',
      'LIVEMINT': 'LiveMint',
      'BUSINESS_STANDARD': 'Business Standard',
      'CNBC_TV18': 'CNBC TV18',
      'NSE': 'NSE India',
      'BSE': 'BSE India',
      'SEBI': 'SEBI',
      'RBI': 'RBI',
      'PIB': 'PIB',
      'INVESTOR_RELATIONS': 'Investor Relations',
      'GOOGLE_NEWS': 'Google News'
    };
    const publisher = (rawInput.publisher || publisherNameMap[publisherId] || publisherId).trim();
    const sourceUrl = rawInput.sourceUrl || 'https://news.example.com';
    const canonicalUrl = CanonicalUrlResolver.resolve(rawInput.canonicalUrl || sourceUrl);

    // Extract author / byline from raw text or field if missing
    let author = rawInput.author ? rawInput.author.trim() : undefined;
    if (!author && rawInput.rawContent) {
      const bylineMatch = rawInput.rawContent.match(/By\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}|ET\s+Bureau|FE\s+Bureau|Reuters|PTI|Bloomberg)/i);
      if (bylineMatch) {
        author = bylineMatch[1].trim();
      }
    }

    // Normalize date
    const dateNorm = DateNormalizer.normalize(rawInput.publishedAt || new Date().toISOString());

    return {
      publisher,
      publisherId,
      title,
      subtitle: rawInput.subtitle ? rawInput.subtitle.trim() : undefined,
      author,
      publishedAt: dateNorm.isoString,
      modifiedAt: rawInput.modifiedAt ? DateNormalizer.normalize(rawInput.modifiedAt).isoString : undefined,
      displayDate: dateNorm.displayDate,
      category: rawInput.category ? rawInput.category.trim() : 'Markets',
      tags: rawInput.tags ? rawInput.tags.map(t => t.trim()) : [],
      sourceUrl,
      canonicalUrl,
      language: 'en'
    };
  }
}
