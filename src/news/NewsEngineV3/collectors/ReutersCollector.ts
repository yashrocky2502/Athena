/**
 * ATHENA NEWS ENGINE V3 — REUTERS COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class ReutersCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'REUTERS';
  public readonly name = 'Reuters';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const urls = [
      'https://news.google.com/rss/search?q=site:reuters.com+OR+%22Reuters%22+business&hl=en-IN&gl=IN&ceid=IN:en',
      'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best'
    ];

    for (const url of urls) {
      try {
        const feed = await this.parser.parseURL(url);
        if (feed && feed.items && feed.items.length > 0) {
          return feed.items.slice(0, 15).map((item, idx) => ({
            id: V3Utils.generateId(`RAW_REUT_${idx}`),
            publisherId: this.id,
            sourceUrl: item.link || url,
            title: item.title || 'Reuters Market Update',
            rawBody: item.contentSnippet || item.content || item.title || '',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
            fetchedAt: now,
            rawMetadata: { wire: 'Reuters Financial Wire' }
          }));
        }
      } catch (err) {
        // Try next URL fallback
      }
    }

    return [];
  }
}
