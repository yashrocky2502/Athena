import { IntelligenceEngine, IntelligenceObject } from './IntelligenceEngine';
import { CompanyMasterDatabase } from './CompanyMasterDatabase';

export type NewsCategoryType = 'EARNINGS' | 'MONETARY_POLICY' | 'CORPORATE_ACTION' | 'COMMODITIES' | 'GLOBAL' | 'FO_NEWS';

export class InstitutionalTelegramFormatter {
  /**
   * Formats an article into ATHENA Universal Market Intelligence Telegram Notification.
   * Universal format for ALL market participants (Investors, Swing, Intraday, Futures, Options, Commodities, Crypto).
   * Consumes single source of truth IntelligenceEngine.
   */
  public static format(article: any): string {
    const intel: IntelligenceObject = IntelligenceEngine.getInstance().generate(article);

    const symbol = this.resolveSymbol(article);
    const companyName = this.resolveCompanyName(symbol, article);
    const categoryName = this.getCategoryDisplayName(article);
    const publisherStr = typeof article.publisher === 'string' ? article.publisher 
                       : (typeof article.source === 'object' && article.source?.publisher) ? article.source.publisher
                       : typeof article.source === 'string' ? article.source 
                       : 'NSE';
    const source = this.cleanText(publisherStr);
    const link = article.url || article.link || 'https://athena.terminal/news';

    let sentimentIcon = '⚪';
    if (intel.marketImpact.direction === 'BULLISH') sentimentIcon = '🟢';
    else if (intel.marketImpact.direction === 'BEARISH') sentimentIcon = '🔴';
    else if (intel.marketImpact.direction === 'MIXED') sentimentIcon = '🟡';

    let text = `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🚨 <b>ATHENA MARKET ALERT</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `${sentimentIcon} <b>${this.escapeHtml(companyName.toUpperCase())}</b>\n\n`;
    text += `<b>Category:</b>\n${this.escapeHtml(categoryName)}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 📰 Summary
    text += `📰 <b>Executive Summary</b>\n\n`;
    text += `${this.escapeHtml(intel.executiveSummary)}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 📊 Market Intelligence
    text += `📊 <b>Market Intelligence</b>\n\n`;
    text += `<b>Direction:</b>\n${intel.marketImpact.direction}\n\n`;
    text += `<b>Reasoning:</b>\n${this.escapeHtml(intel.marketImpact.reasoning)}\n\n`;
    text += `<b>Impact Score:</b>\n${intel.impactScore} / 100\n\n`;
    text += `<b>Confidence:</b>\n${intel.confidence}%\n\n`;
    text += `<b>Urgency:</b>\n${intel.urgency}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 🎯 Who May Benefit
    text += `🎯 <b>Who May Benefit</b>\n\n`;
    if (intel.participants && intel.participants.length > 0) {
      for (const p of intel.participants) {
        text += `✅ ${this.escapeHtml(p)}\n`;
      }
    } else {
      text += `General Market Participants\n`;
    }
    text += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 🧠 Why It Matters
    text += `🧠 <b>Why It Matters</b>\n\n`;
    text += `${this.escapeHtml(intel.whyItMatters)}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Sources
    text += `<b>Sources</b>\n\n`;
    text += `✓ ${this.escapeHtml(source)}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Single Button / Link
    text += `🔗 <a href="${this.escapeHtml(link)}">Open ATHENA</a>`;

    return text;
  }

  private static resolveSymbol(article: any): string {
    if (article.symbol && article.symbol !== 'NONE') return article.symbol.toUpperCase();
    if (article.ticker && article.ticker !== 'NONE') return article.ticker.toUpperCase();

    const text = `${article.headline || ''} ${article.title || ''}`.toUpperCase();
    for (const record of CompanyMasterDatabase.MASTER_RECORDS) {
      if (text.includes(record.symbol.toUpperCase())) return record.symbol;
      for (const alias of record.aliases) {
        if (text.includes(alias.toUpperCase())) return record.symbol;
      }
    }
    
    // Explicit Index checking
    if (text.includes('NIFTY')) return 'NIFTY';
    if (text.includes('BANKNIFTY') || text.includes('BANK NIFTY')) return 'BANKNIFTY';
    if (text.includes('SENSEX')) return 'SENSEX';

    // If it's a general macro/commodity article, don't label it NIFTY
    if (text.includes('OIL') || text.includes('GOLD') || text.includes('COMMODITY')) {
      return 'COMMODITY';
    }

    return 'NONE';
  }

  private static resolveCompanyName(symbol: string, article: any): string {
    if (symbol === 'NONE') return 'Broad Market';
    if (symbol === 'COMMODITY') return 'Commodities & Energy';
    if (symbol === 'MACRO') return 'Macro';

    const record = CompanyMasterDatabase.MASTER_RECORDS.find(r => r.symbol === symbol);
    if (record) return record.name;
    if (article.company && article.company !== 'NONE') return article.company;
    return symbol;
  }

  private static getCategoryDisplayName(article: any): string {
    const cat = `${article.category || ''} ${article.primaryCategory || ''}`.toUpperCase();
    const text = `${article.headline || ''} ${article.title || ''}`.toUpperCase();

    if (cat.includes('RESULT') || text.match(/\b(Q1|Q2|Q3|Q4|EARNINGS|PAT|PROFIT|REVENUE)\b/)) {
      return 'Quarterly Results';
    }
    if (cat.includes('ECONOMY') || text.match(/\b(RBI|FED|REPO RATE|INFLATION|MONETARY POLICY)\b/)) {
      return 'Macro Economic Policy';
    }
    if (cat.includes('CORPORATE') || text.match(/\b(DIVIDEND|BONUS|SPLIT|ACQUISITION|BUYBACK)\b/)) {
      return 'Corporate Action';
    }
    if (text.match(/\b(CRUDE|OIL|GOLD|SILVER|COMMODITY)\b/)) {
      return 'Commodities & Energy';
    }
    if (text.match(/\b(GLOBAL|WALL STREET|NASDAQ|GEOPOLITICAL)\b/)) {
      return 'Global Event';
    }
    return 'Market Intelligence';
  }

  private static cleanText(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static escapeHtml(text: string): string {
    return this.cleanText(text);
  }
}
