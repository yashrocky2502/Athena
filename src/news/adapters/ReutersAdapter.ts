import { ProviderAdapter } from './ProviderAdapter';

export class ReutersAdapter implements ProviderAdapter {
  id = 'reuters';
  name = 'Reuters';

  getHeaders(url: string): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Referer': 'https://www.reuters.com/',
    };
  }

  getTimeout(): number {
    return 10000;
  }

  handleQuirks(html: string, url: string): string {
    // Remove boilerplate/register wall elements from HTML before extraction if present
    return html.replace(/<div[^>]*class="[^"]*register-wall[^"]*"[\s\S]*?<\/div>/gi, '');
  }
}
