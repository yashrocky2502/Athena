/**
 * ATHENA NEWS ENGINE V3 — CNBC TV18 COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class CnbcTv18Collector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'CNBC_TV18';
  public readonly name = 'CNBC TV18';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const urls = [
      'https://www.cnbctv18.com/common/rss/market.xml',
      'https://news.google.com/rss/search?q=site:cnbctv18.com+market&hl=en-IN&gl=IN&ceid=IN:en'
    ];

    for (const url of urls) {
      try {
        const feed = await this.parser.parseURL(url);
        if (feed && feed.items && feed.items.length > 0) {
          return feed.items.slice(0, 15).map((item, idx) => ({
            id: V3Utils.generateId(`RAW_CNBC_${idx}`),
            publisherId: this.id,
            sourceUrl: item.link || url,
            title: item.title || 'CNBC TV18 Market News',
            rawBody: item.contentSnippet || item.content || item.title || '',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
            fetchedAt: now,
            rawMetadata: { wire: 'CNBC TV18 Wire' }
          }));
        }
      } catch (err) {
        // Fallback
      }
    }

    return [];
  }
}
