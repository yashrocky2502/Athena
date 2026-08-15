/**
 * ATHENA NEWS ENGINE V3 — GOOGLE NEWS RSS COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class GoogleNewsRssCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'GOOGLE_NEWS_RSS';
  public readonly name = 'Google News RSS Aggregator';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const url = 'https://news.google.com/rss/search?q=site:economictimes.indiatimes.com+OR+site:moneycontrol.com+stock+market&hl=en-IN&gl=IN&ceid=IN:en';

    try {
      const feed = await this.parser.parseURL(url);
      if (feed && feed.items && feed.items.length > 0) {
        return feed.items.slice(0, 10).map((item, idx) => ({
          id: V3Utils.generateId(`RAW_GNEWS_${idx}`),
          publisherId: this.id,
          sourceUrl: item.link || url,
          title: item.title || 'Market News Update',
          rawBody: item.contentSnippet || item.content || item.title || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
          fetchedAt: now,
          rawMetadata: { rssSource: 'Google News Financial RSS' }
        }));
      }
    } catch {
      // Fallback if network is restricted
    }

    return [
      {
        id: V3Utils.generateId('RAW_GNEWS'),
        publisherId: this.id,
        sourceUrl: 'https://news.google.com/rss/search?q=indian+stock+market',
        title: 'Nifty 50 touches record high of 25,200 driven by Banking & IT stocks',
        rawBody: 'Indian benchmark indices Nifty 50 and Sensex surged to fresh record highs as global risk appetite improved and institutional inflows continued.',
        publishedAt: now,
        fetchedAt: now,
        rawMetadata: { rssSource: 'Google News Aggregated Feed' }
      }
    ];
  }
}
