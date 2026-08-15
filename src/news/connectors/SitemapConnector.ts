import { NewsConnector } from './BaseConnector';
import { NewsItem } from '../models/NewsItem';
import { FeedRegistry, ProviderConfig } from '../registry/FeedRegistry';

export class SitemapConnector implements NewsConnector {
  public name = 'Sitemap Discovery Connector';
  public sourceType: 'SITEMAP' = 'SITEMAP';

  public async fetchLatest(): Promise<NewsItem[]> {
    const providers = FeedRegistry.getInstance().getAllProviders().filter(
      (p) => p.sitemapUrl && p.supportedDiscoveryMethods.includes('SITEMAP')
    );

    const items: NewsItem[] = [];

    const promises = providers.map(async (provider) => {
      try {
        const fetched = await this.fetchSitemapForProvider(provider);
        items.push(...fetched);
      } catch (err: any) {
        console.warn(`[SitemapConnector] Failed to fetch sitemap for ${provider.publisherName}:`, err?.message || err);
      }
    });

    await Promise.allSettled(promises);
    return items;
  }

  private async fetchSitemapForProvider(provider: ProviderConfig): Promise<NewsItem[]> {
    if (!provider.sitemapUrl) return [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(provider.sitemapUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AthenaNewsBot/3.0',
          Accept: 'text/xml,application/xml,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const xmlText = await response.text();
      return this.parseSitemapXml(xmlText, provider);
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  private parseSitemapXml(xmlText: string, provider: ProviderConfig): NewsItem[] {
    const items: NewsItem[] = [];
    const urlMatches = xmlText.match(/<url>([\s\S]*?)<\/url>/gi) || [];

    for (const urlBlock of urlMatches.slice(0, 15)) {
      const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/i);
      const titleMatch = urlBlock.match(/<news:title>(.*?)<\/news:title>/i) || urlBlock.match(/<title>(.*?)<\/title>/i);
      const dateMatch =
        urlBlock.match(/<news:publication_date>(.*?)<\/news:publication_date>/i) ||
        urlBlock.match(/<lastmod>(.*?)<\/lastmod>/i);
      const imageMatch = urlBlock.match(/<image:loc>(.*?)<\/image:loc>/i);

      if (locMatch && locMatch[1]) {
        const rawUrl = locMatch[1].trim();
        const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
        const rawDate = dateMatch ? dateMatch[1].trim() : new Date().toISOString();
        const rawImage = imageMatch ? imageMatch[1].trim() : undefined;

        if (rawTitle && rawTitle.length > 5) {
          items.push({
            id: `sitemap-${provider.id}-${Buffer.from(rawUrl).toString('base64').substring(0, 16)}`,
            headline: rawTitle,
            description: '',
            publisher: provider.publisherName,
            publishedAt: rawDate,
            category: provider.defaultCategory,
            categories: [provider.defaultCategory],
            country: provider.country,
            language: provider.language,
            url: rawUrl,
            publisherUrl: rawUrl,
            canonicalUrl: rawUrl,
            resolutionStatus: 'RESOLVED',
            image: rawImage,
            source: provider.publisherName,
            sourceType: 'SITEMAP',
            discoveryLayer: 'SITEMAP',
            isExchange: provider.priority === 2,
            feedName: `${provider.publisherName} Sitemap`,
            rssSource: provider.sitemapUrl,
          });
        }
      }
    }

    return items;
  }
}
