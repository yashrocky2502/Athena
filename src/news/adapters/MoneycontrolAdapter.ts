import { ProviderAdapter } from './ProviderAdapter';

export class MoneycontrolAdapter implements ProviderAdapter {
  id = 'moneycontrol';
  name = 'Moneycontrol';

  getHeaders(url: string): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.moneycontrol.com/',
    };
  }

  handleQuirks(html: string, url: string): string {
    // Standardize Moneycontrol specific formatting quirks if needed
    return html;
  }
}
