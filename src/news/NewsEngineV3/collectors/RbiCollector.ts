/**
 * ATHENA NEWS ENGINE V3 — RBI COLLECTOR
 */

import { BaseCollectorV3 } from './BaseCollectorV3';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { V3Utils } from '../utils/V3Utils';
import Parser from 'rss-parser';

export class RbiCollector extends BaseCollectorV3 {
  public readonly id: V3PublisherId = 'RBI';
  public readonly name = 'RBI';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  protected async onInitialize(): Promise<void> {}

  protected async executeRawFetch(): Promise<V3RawArticle[]> {
    const now = new Date().toISOString();
    const url = 'https://news.google.com/rss/search?q=%22Reserve+Bank+of+India%22+OR+%22RBI%22+monetary+policy+notification&hl=en-IN&gl=IN&ceid=IN:en';

    try {
      const feed = await this.parser.parseURL(url);
      if (feed && feed.items && feed.items.length > 0) {
        return feed.items.slice(0, 15).map((item, idx) => ({
          id: V3Utils.generateId(`RAW_RBI_${idx}`),
          publisherId: this.id,
          sourceUrl: item.link || url,
          title: item.title || 'RBI Policy Notification',
          rawBody: item.contentSnippet || item.content || item.title || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now,
          fetchedAt: now,
          rawMetadata: { wire: 'RBI Official Feed' }
        }));
      }
    } catch {
      // Fallback
    }

    return [];
  }
}
