/**
 * ATHENA NEWS ENGINE V3 — MONEYCONTROL COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class MoneycontrolCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'MONEYCONTROL';
  public readonly name = 'Moneycontrol';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const urls = [
      'https://www.moneycontrol.com/rss/marketreports.xml',
      'https://www.moneycontrol.com/rss/latestnews.xml',
      'https://news.google.com/rss/search?q=site:moneycontrol.com+stock+market&hl=en-IN&gl=IN&ceid=IN:en'
    ];

    for (const url of urls) {
      try {
        const feed = await this.parser.parseURL(url);
        if (feed && feed.items && feed.items.length > 0) {
          return feed.items.slice(0, 15).map((item, idx) => ({
            id: V3Utils.generateId(`RAW_MC_${idx}`),
            publisherId: this.id,
            sourceUrl: item.link || url,
            title: item.title || 'Moneycontrol Market News',
            rawBody: item.contentSnippet || item.content || item.title || '',
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
            fetchedAt: now,
            rawMetadata: { wire: 'Moneycontrol Wire' }
          }));
        }
      } catch (err) {
        // Try fallback
      }
    }

    return [];
  }
}
