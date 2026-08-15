export class Normalizer {
  /**
   * Cleans HTML tags and decodes common HTML entities
   */
  public static cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes article headlines by stripping redundant trailing publisher names
   */
  public static normalizeHeadline(headline: string): string {
    if (!headline) return '';
    let cleaned = this.cleanText(headline);
    cleaned = cleaned
      .replace(/\s*-\s*(Livemint|Moneycontrol|Economic Times|Business Standard|CNBC-TV18|NDTV|Times of India|Financial Express|Reuters|Bloomberg|Yahoo Finance)\s*$/i, '')
      .replace(/\s*\|\s*(Livemint|Moneycontrol|Economic Times|Business Standard|CNBC-TV18|NDTV|Times of India|Financial Express|Reuters|Bloomberg|Yahoo Finance)\s*$/i, '')
      .trim();
    return cleaned;
  }

  /**
   * Normalizes date input into an ISO date string
   */
  public static normalizeDate(dateInput?: string | Date | number): string {
    if (!dateInput) return new Date().toISOString();
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Normalizes category strings into supported news categories
   */
  public static normalizeCategory(rawCategory?: string): string {
    if (!rawCategory) return 'Markets';
    const cat = rawCategory.trim().toLowerCase();
    if (cat.includes('f&o') || cat.includes('fno') || cat.includes('futures') || cat.includes('option')) return 'F&O';
    if (cat.includes('market') || cat.includes('stock') || cat.includes('equity') || cat.includes('nifty') || cat.includes('sensex')) return 'Markets';
    if (cat.includes('econ') || cat.includes('gdp') || cat.includes('rbi') || cat.includes('inflation') || cat.includes('policy')) return 'Economy';
    if (cat.includes('corp') || cat.includes('company') || cat.includes('earnings') || cat.includes('deal')) return 'Corporate';
    if (cat.includes('ai') || cat.includes('artificial intelligence') || cat.includes('genai')) return 'AI';
    if (cat.includes('tech') || cat.includes('it ') || cat.includes('software')) return 'Technology';
    if (cat.includes('ipo') || cat.includes('listing')) return 'IPO';
    if (cat.includes('result') || cat.includes('q1') || cat.includes('q2') || cat.includes('q3') || cat.includes('q4') || cat.includes('financials')) return 'Results';
    if (cat.includes('exchange') || cat.includes('sebi') || cat.includes('bse') || cat.includes('nse')) return 'Exchange';
    if (cat.includes('gov') || cat.includes('ministry') || cat.includes('pib') || cat.includes('tax')) return 'Government';
    if (cat.includes('global') || cat.includes('world') || cat.includes('us ') || cat.includes('fed')) return 'Global';
    if (cat.includes('crypto') || cat.includes('bitcoin') || cat.includes('web3')) return 'Crypto';
    if (cat.includes('commodit') || cat.includes('gold') || cat.includes('crude') || cat.includes('oil')) return 'Commodities';
    return 'Markets';
  }
}
