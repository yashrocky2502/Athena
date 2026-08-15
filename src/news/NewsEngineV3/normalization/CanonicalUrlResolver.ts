/**
 * ATHENA NEWS ENGINE V3 — CANONICAL URL RESOLVER
 * 
 * Sanitizes URLs, normalizes protocol/domain, and strips tracking query parameters
 * (utm_source, utm_medium, utm_campaign, gclid, fbclid, ref, cmpid, etc.).
 */

export class CanonicalUrlResolver {
  private static readonly TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'gclid',
    'fbclid',
    'ref',
    'ref_',
    'cmpid',
    'tr_id',
    'src',
    'at_medium',
    'mc_cid',
    'mc_eid',
    'oc',
    'hl',
    'gl',
    'ceid',
    'amp',
    'amp_js_v',
    'amp_gsa',
    'feed',
    'rss',
    'source',
    'originalreferrer',
    'gclsrc',
    '_ga',
    '_gl',
    's',
    'ss',
    'm',
    'mc',
    'mail',
    'newsletter',
    'pub',
    'publication',
    '_hsenc',
    '_hsmi',
    'hsctatracking',
    'mkt_tok',
    'yk_s',
    'yk_link',
    'yk_medium',
    'yk_source',
    's_kwcid'
  ]);

  /**
   * Resolves and strips tracking parameters from a URL string.
   */
  public static resolve(rawUrl: string): string {
    if (!rawUrl || !rawUrl.trim()) {
      return 'https://news.example.com';
    }

    let urlStr = rawUrl.trim();

    // Ensure protocol
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = `https://${urlStr}`;
    }

    try {
      const parsed = new URL(urlStr);

      // Force https
      parsed.protocol = 'https:';

      // Lowercase hostname
      parsed.hostname = parsed.hostname.toLowerCase();

      // Clean query search params
      const searchParams = new URLSearchParams(parsed.search);
      const keysToDelete: string[] = [];

      searchParams.forEach((_, key) => {
        if (this.TRACKING_PARAMS.has(key.toLowerCase()) || key.startsWith('utm_')) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(k => searchParams.delete(k));

      parsed.search = searchParams.toString();

      // Clear any hash/fragment identifier
      parsed.hash = '';

      // Remove trailing slash from pathname if path length > 1
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      return parsed.toString();
    } catch {
      // Fallback
      return urlStr.replace(/\?.*$/, '').replace(/\/$/, '');
    }
  }
}
