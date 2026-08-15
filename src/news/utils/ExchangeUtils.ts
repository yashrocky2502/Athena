export const SUPPORTED_EXCHANGE_DOMAINS = [
  'nseindia.com',
  'nsearchives.nseindia.com',
  'bseindia.com',
  'bseindia.com/xml-data',
  'listing.bseindia.com'
];

/**
 * Checks if a URL or host belongs to supported exchange domains.
 */
export function isExchangeDocumentUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return SUPPORTED_EXCHANGE_DOMAINS.some(domain => lower.includes(domain));
}

/**
 * Checks if an article or news item is an official exchange filing.
 */
export function isExchangeArticle(item?: any): boolean {
  if (!item) return false;
  if (item.isExchangeDocument || item.isExchangeFiling) return true;
  if (isExchangeDocumentUrl(item.url) || isExchangeDocumentUrl(item.finalUrl) || isExchangeDocumentUrl(item.originalUrl) || isExchangeDocumentUrl(item.canonicalUrl)) {
    return true;
  }
  const pub = (item.publisher || item.source || '').toLowerCase();
  if (pub === 'nse india' || pub === 'bse india' || pub === 'nse' || pub === 'bse' || pub.includes('nseindia') || pub.includes('bseindia')) {
    return true;
  }
  if (item.isExchange && (pub.includes('nse') || pub.includes('bse'))) {
    return true;
  }
  return false;
}

/**
 * Returns the official exchange name ('NSE India' or 'BSE India').
 */
export function getExchangeName(urlOrPublisher?: string): 'NSE India' | 'BSE India' {
  const lower = (urlOrPublisher || '').toLowerCase();
  if (lower.includes('bse')) return 'BSE India';
  return 'NSE India';
}

/**
 * Detects the official exchange document type from headline or URL.
 */
export function getExchangeDocumentType(titleOrUrl?: string): string {
  const lower = (titleOrUrl || '').toLowerCase();
  if (lower.includes('board meeting')) return 'Board Meeting Outcome';
  if (lower.includes('financial result') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('audited') || lower.includes('unaudited')) return 'Financial Results';
  if (lower.includes('investor presentation')) return 'Investor Presentation';
  if (lower.includes('press release')) return 'Press Release';
  if (lower.includes('acquisition') || lower.includes('merger') || lower.includes('amalgamation')) return 'Corporate Action / M&A';
  if (lower.includes('dividend') || lower.includes('bonus')) return 'Dividend / Corporate Action';
  if (lower.includes('circular') || lower.includes('notification')) return 'Circular / Notification';
  if (lower.includes('transcript') || lower.includes('call')) return 'Conference Call Transcript';
  return 'Corporate Filing';
}
