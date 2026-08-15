import { ProviderAdapter } from './ProviderAdapter';

export class InvestingAdapter implements ProviderAdapter {
  id = 'investing';
  name = 'Investing.com';

  getHeaders(url: string): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
  }
}
