import https from 'https';
import http from 'http';
import { URL } from 'url';
import { GoogleDecoder } from 'google-news-url-decoder';

export interface ResolveResult {
  originalUrl: string;
  finalUrl: string;
  redirects: string[];
  contentType: string;
}

export class UrlResolver {
  private static instance: UrlResolver;
  
  // Domains to always try resolving, even if they don't look like shortlink redirects.
  // We'll just resolve everything, but for special Google News redirects, we definitely need this.
  private specialDomains = [
    'news.google.com',
    'nsearchives.nseindia.com',
    'www.nseindia.com',
    'www.bseindia.com',
    'www.sebi.gov.in',
    'rbi.org.in',
    'mca.gov.in',
    'pib.gov.in',
    'egazette.nic.in'
  ];

  
  public metrics = {
    resolvedRedirects: 0,
    resolvedPDFs: 0,
    googleNewsResolved: 0
  };

  private constructor() {}

  public static getInstance(): UrlResolver {
    if (!UrlResolver.instance) {
      UrlResolver.instance = new UrlResolver();
    }
    return UrlResolver.instance;
  }

  public async resolveFinalUrl(originalUrl: string, maxDepth: number = 10, timeoutMs: number = 10000): Promise<ResolveResult> {
    const redirects: string[] = [];
    let currentUrl = originalUrl;
    let cookies: string[] = [];
    let depth = 0;

    // Decode Google News URLs immediately at Stage 1
    if (currentUrl.includes('news.google.com')) {
      try {
        const decoder = new GoogleDecoder();
        const decoded = await decoder.decode(currentUrl);
        if (decoded && decoded.status && decoded.decoded_url) {
          this.metrics.googleNewsResolved++;
          redirects.push(currentUrl);
          currentUrl = decoded.decoded_url;
        }
      } catch (err) {
        console.error('[UrlResolver] Google News decoder failed:', err);
      }
    }
    
    while (depth < maxDepth) {
      depth++;
      try {
        const urlObj = new URL(currentUrl);
        const requestModule = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {})
          },
          timeout: timeoutMs
        };

        const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
          const req = requestModule.request(currentUrl, options, (res) => resolve(res));
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout resolving URL'));
          });
          req.end();
        });

        // Save new cookies
        if (response.headers['set-cookie']) {
          response.headers['set-cookie'].forEach(cookie => {
            cookies.push(cookie.split(';')[0]);
          });
        }

        
        const statusCode = response.statusCode || 200;
        const location = response.headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          if (currentUrl.includes('news.google.com')) {
            this.metrics.googleNewsResolved++;
          }
          this.metrics.resolvedRedirects++;

          redirects.push(currentUrl);
          
          // Handle relative redirects
          if (location.startsWith('/')) {
            currentUrl = new URL(location, currentUrl).href;
          } else {
            currentUrl = location;
          }
          continue;
        }

        // Check if we hit a Javascript or Meta Refresh redirect we might not be handling here...
        // But for HEAD, if it's 200, we stop.
        
        const contentType = response.headers['content-type'] || '';
        
        if (currentUrl.toLowerCase().endsWith('.pdf') || contentType.toLowerCase().includes('application/pdf')) {
          this.metrics.resolvedPDFs++;
        }

        return {

          originalUrl,
          finalUrl: currentUrl,
          redirects,
          contentType: contentType.toLowerCase()
        };

      } catch (err) {
        // If we fail during resolution (e.g. timeout), just return what we have so far
        console.error(`Error resolving ${currentUrl}:`, err);
        return {
          originalUrl,
          finalUrl: currentUrl,
          redirects,
          contentType: ''
        };
      }
    }

    // Max depth reached
    return {
      originalUrl,
      finalUrl: currentUrl,
      redirects,
      contentType: ''
    };
  }
}
