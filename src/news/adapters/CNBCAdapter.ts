import { ProviderAdapter } from './ProviderAdapter';

export class CNBCAdapter implements ProviderAdapter {
  id = 'cnbc';
  name = 'CNBC / CNBC TV18';

  getHeaders(url: string): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.cnbctv18.com/',
    };
  }
}
