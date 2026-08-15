/**
 * ATHENA NEWS ENGINE V3 — BSE COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class BseCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'BSE';
  public readonly name = 'BSE India';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const urls = [
      'https://news.google.com/rss/search?q=site:bseindia.com+OR+%22BSE+Corporate+Announcements%22&hl=en-IN&gl=IN&ceid=IN:en',
      'https://www.bseindia.com/rss/corporate_announcements.rss'
    ];

    for (const url of urls) {
      try {
        const feed = await this.parser.parseURL(url);
        if (feed && feed.items && feed.items.length > 0) {
          return feed.items.slice(0, 15).map((item, idx) => ({
            id: V3Utils.generateId(`RAW_BSE_${idx}`),
            publisherId: this.id,
            sourceUrl: item.link || url,
            title: item.title || 'BSE Corporate Announcement',
            rawBody: item.contentSnippet || item.content || item.title || '',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
            fetchedAt: now,
            rawMetadata: { wire: 'BSE Corporate Feed' }
          }));
        }
      } catch (err) {
        // Fallback
      }
    }

    return [];
  }
}
