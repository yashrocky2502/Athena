import { NewsItem } from '../models/NewsItem';

export interface NewsConnector {
  name: string;
  sourceType?: 'RSS' | 'API' | 'EXCHANGE' | 'GOVERNMENT' | 'SCRAPER' | 'SITEMAP' | 'GOOGLE_DISCOVERY';
  fetchLatest(): Promise<NewsItem[]>;
  fetchByCategory?(category: string): Promise<NewsItem[]>;
  healthCheck?(): Promise<{ ok: boolean; message?: string; itemsFetched?: number }>;
}

export async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}
