import { ProviderAdapter } from './ProviderAdapter';

export class MarketWatchAdapter implements ProviderAdapter {
  id = 'marketwatch';
  name = 'MarketWatch';

  getHeaders(url: string): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.marketwatch.com/',
    };
  }
}
