import { ArticleContent } from './ArticleContent';

export class IntelligenceAnalyzer {
  public static extractEarnings(text: string): any {
    const earnings = {} as any;
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('revenue') || lowerText.includes('sales')) {
      const match = text.match(/(?:revenue|sales)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) earnings.revenue = match[0];
    }
    
    if (lowerText.includes('pat') || lowerText.includes('net profit')) {
      const match = text.match(/(?:pat|net profit)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) earnings.pat = match[0];
    }
    
    if (lowerText.includes('ebitda') || lowerText.includes('operating profit')) {
      const match = text.match(/(?:ebitda|operating profit)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) earnings.ebitda = match[0];
    }
    
    if (lowerText.includes('order book')) {
      const match = text.match(/(?:order book)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) earnings.orderBook = match[0];
    }
    
    if (lowerText.includes('guidance')) {
      const match = text.match(/guidance[\s\w\.\,\%]*?(?:₹|\$|Rs\.?|\d+%)/i);
      if (match) earnings.guidance = match[0].slice(0, 100);
    }

    return Object.keys(earnings).length > 0 ? earnings : undefined;
  }

  public static extractIPO(text: string): any {
    const ipo = {} as any;
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('issue price') || lowerText.includes('price band')) {
      const match = text.match(/(?:issue price|price band)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)(?:\s?-\s?(?:₹|\$|Rs\.?)?\s?\d+(?:\.\d+)?)?/i);
      if (match) ipo.issuePrice = match[0];
    }
    
    if (lowerText.includes('listing price')) {
      const match = text.match(/(?:listing price|listed at)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)/i);
      if (match) ipo.listingPrice = match[0];
    }
    
    if (lowerText.includes('premium') || lowerText.includes('discount')) {
      const match = text.match(/(?:premium|discount)(?:[\s\w]*?)(?:of\s)?(\d+(?:\.\d+)?%)/i);
      if (match) ipo.premiumDiscount = match[0];
    }
    
    if (lowerText.includes('subscribed') || lowerText.includes('subscription')) {
      const match = text.match(/(?:subscribed|subscription)(?:[\s\w]*?)(\d+(?:\.\d+)?)\s?(?:times|x)/i);
      if (match) ipo.subscription = match[0];
    }
    
    if (lowerText.includes('gmp') || lowerText.includes('grey market premium')) {
      const match = text.match(/(?:gmp|grey market premium)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)/i);
      if (match) ipo.gmp = match[0];
    }
    
    if (lowerText.includes('issue size')) {
      const match = text.match(/(?:issue size)(?:[\s\w]*?)(?:₹|\$|Rs\.?)\s?(\d+(?:\.\d+)?)\s?(?:cr|crore|bn|billion|mn|million)/i);
      if (match) ipo.issueSize = match[0];
    }

    return Object.keys(ipo).length > 0 ? ipo : undefined;
  }

  public static extractRegulatory(text: string): any {
    const reg = {} as any;
    const lowerText = text.toLowerCase();
    
    const regulators = ['sebi', 'rbi', 'cbdt', 'sec', 'cftc', 'fca'];
    for (const r of regulators) {
      if (lowerText.includes(r)) {
        reg.regulator = r.toUpperCase();
        break;
      }
    }
    
    const laws = ['income tax act', 'companies act', 'pmla', 'fema'];
    for (const l of laws) {
      if (lowerText.includes(l)) {
        reg.law = l;
        break;
      }
    }

    return Object.keys(reg).length > 0 ? reg : undefined;
  }

  public static extractQuotes(text: string): any[] {
    const quotes: any[] = [];
    const quoteRegex = /"([^"]+)"\s*(?:-|said|stated|according to|added)\s*([A-Z][a-zA-Z\s]+?)(?:,\s*([^,.]+))?/g;
    
    let match;
    while ((match = quoteRegex.exec(text)) !== null) {
      if (match[1].length > 30) {
        quotes.push({
          quote: match[1].trim(),
          speaker: match[2] ? match[2].trim() : 'Unknown',
          designation: match[3] ? match[3].trim() : 'Executive',
          importance: 'High'
        });
      }
    }
    
    return quotes;
  }
}
