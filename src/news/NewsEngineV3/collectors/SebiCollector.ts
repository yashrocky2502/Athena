/**
 * ATHENA NEWS ENGINE V3 — SEBI COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class SebiCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'SEBI';
  public readonly name = 'SEBI';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const url = 'https://news.google.com/rss/search?q=%22SEBI%22+press+release+order+circular&hl=en-IN&gl=IN&ceid=IN:en';

    try {
      const feed = await this.parser.parseURL(url);
      if (feed && feed.items && feed.items.length > 0) {
        return feed.items.slice(0, 15).map((item, idx) => ({
          id: V3Utils.generateId(`RAW_SEBI_${idx}`),
          publisherId: this.id,
          sourceUrl: item.link || url,
          title: item.title || 'SEBI Press Release',
          rawBody: item.contentSnippet || item.content || item.title || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
          fetchedAt: now,
          rawMetadata: { wire: 'SEBI Regulator Feed' }
        }));
      }
    } catch {
      // Fallback
    }

    return [];
  }
}
