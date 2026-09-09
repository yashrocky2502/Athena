/**
 * ATHENA — Phase 21: Digest Telegram Formatter
 * DigestTelegramFormatter.ts
 * 
 * Formats Morning, Afternoon, Evening, and Full Day digests into high-signal Telegram HTML messages.
 * Ensures 100% numerical and factual parity between UI and Telegram notifications.
 */

import {
  MorningDigestData,
  AfternoonDigestData,
  EveningDigestData,
  FullDayDigestData
} from './DigestTypes.ts';

export class DigestTelegramFormatter {
  public static escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Format 🌅 Morning Brief for Telegram
   */
  public static formatMorning(data: MorningDigestData): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let msg = `${divider}\n`;
    msg += `🌅 <b>ATHENA MORNING MARKET BRIEF</b>\n`;
    msg += `📅 ${data.date} | Pre-Market Edition\n`;
    msg += `${divider}\n\n`;

    // Key Indices
    msg += `📊 <b>MARKET SNAPSHOT &amp; CUES</b>\n`;
    msg += `• NIFTY 50: <b>${data.marketSnapshot.nifty.price.toLocaleString()}</b> (${data.marketSnapshot.nifty.changePct >= 0 ? '+' : ''}${data.marketSnapshot.nifty.changePct}%)\n`;
    msg += `• BANK NIFTY: <b>${data.marketSnapshot.bankNifty.price.toLocaleString()}</b> (${data.marketSnapshot.bankNifty.changePct >= 0 ? '+' : ''}${data.marketSnapshot.bankNifty.changePct}%)\n`;
    msg += `• GIFT NIFTY: <b>${data.marketSnapshot.giftNifty.price.toLocaleString()}</b> (${data.marketSnapshot.giftNifty.changePct >= 0 ? '+' : ''}${data.marketSnapshot.giftNifty.changePct}%)\n`;
    msg += `• INDIA VIX: <b>${data.marketSnapshot.indiaVix.value}</b> (${data.marketSnapshot.indiaVix.changePct >= 0 ? '+' : ''}${data.marketSnapshot.indiaVix.changePct}%)\n\n`;

    // Global & Macro
    msg += `🌍 <b>GLOBAL &amp; MACRO ENVIRONMENT</b>\n`;
    data.macroCommodities.slice(0, 3).forEach(item => {
      msg += `• ${this.escapeHtml(item.name)}: <b>${item.value}</b> (${item.changePct >= 0 ? '+' : ''}${item.changePct}%)\n`;
    });
    msg += `\n`;

    // Institutional Flows
    msg += `🏦 <b>INSTITUTIONAL FLOWS</b>\n`;
    data.institutionalFlows.slice(0, 2).forEach(f => {
      msg += `• ${f.label}: <b>₹${f.netValueCr >= 0 ? '+' : ''}${f.netValueCr.toLocaleString()} Cr</b>\n`;
    });
    msg += `\n`;

    // Top Stocks in Focus
    msg += `🎯 <b>STOCKS IN FOCUS</b>\n`;
    data.stocksInFocus.slice(0, 3).forEach(stk => {
      const icon = stk.classification === 'POSITIVE' ? '🟢' : stk.classification === 'NEGATIVE' ? '🔴' : '🟡';
      msg += `${icon} <b>${stk.symbol}</b> (₹${stk.price}): ${this.escapeHtml(stk.driver)}\n`;
    });
    msg += `\n`;

    // ATHENA Assessment
    msg += `${divider}\n`;
    msg += `🧠 <b>ATHENA STRATEGIC ASSESSMENT</b>\n`;
    msg += `Bias: <b>${data.athenaAssessment.bias}</b> (Confidence: ${data.athenaAssessment.confidenceScore}%)\n\n`;
    msg += `<i>${this.escapeHtml(data.athenaAssessment.institutionalConclusion)}</i>\n`;
    msg += `${divider}`;

    return msg;
  }

  /**
   * Format ☀️ Afternoon Shift for Telegram
   */
  public static formatAfternoon(data: AfternoonDigestData): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let msg = `${divider}\n`;
    msg += `☀️ <b>ATHENA AFTERNOON SHIFT REPORT</b>\n`;
    msg += `📅 ${data.date} | Mid-Session Delta\n`;
    msg += `${divider}\n\n`;

    msg += `⚡ <b>INTRADAY DELTA SHIFTS</b>\n`;
    msg += `• NIFTY Delta: <b>${data.morningVsCurrentDelta.niftyChangeSinceMorning >= 0 ? '+' : ''}${data.morningVsCurrentDelta.niftyChangeSinceMorning}%</b> since morning\n`;
    msg += `• BANK NIFTY Delta: <b>${data.morningVsCurrentDelta.bankNiftyChangeSinceMorning >= 0 ? '+' : ''}${data.morningVsCurrentDelta.bankNiftyChangeSinceMorning}%</b>\n\n`;

    msg += `🔄 <b>KEY MATERIAL SHIFTS</b>\n`;
    data.morningVsCurrentDelta.deltaItems.slice(0, 4).forEach(item => {
      msg += `• <b>${this.escapeHtml(item.metric)}</b>: ${item.deltaPctOrAbs}\n  ↳ <i>${this.escapeHtml(item.interpretation)}</i>\n`;
    });
    msg += `\n`;

    msg += `${divider}\n`;
    msg += `🧠 <b>ATHENA INTRADAY VERDICT</b>\n`;
    msg += `Forecast Accuracy: <b>${data.morningForecastAccuracy.status}</b>\n\n`;
    msg += `<i>${this.escapeHtml(data.athenaAssessment.institutionalConclusion)}</i>\n`;
    msg += `${divider}`;

    return msg;
  }

  /**
   * Format 🌆 Evening Closing Report for Telegram
   */
  public static formatEvening(data: EveningDigestData): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let msg = `${divider}\n`;
    msg += `🌆 <b>ATHENA EVENING CLOSING REPORT</b>\n`;
    msg += `📅 ${data.date} | Official Market Close\n`;
    msg += `${divider}\n\n`;

    // Final Closes
    msg += `🏁 <b>CLOSING PRICES &amp; BREADTH</b>\n`;
    msg += `• NIFTY 50: <b>${data.closingSnapshot.nifty.price.toLocaleString()}</b> (${data.closingSnapshot.nifty.changePct >= 0 ? '+' : ''}${data.closingSnapshot.nifty.changePct}%)\n`;
    msg += `• BANK NIFTY: <b>${data.closingSnapshot.bankNifty.price.toLocaleString()}</b> (${data.closingSnapshot.bankNifty.changePct >= 0 ? '+' : ''}${data.closingSnapshot.bankNifty.changePct}%)\n`;
    msg += `• Advances: <b>${data.closingSnapshot.advances}</b> | Declines: <b>${data.closingSnapshot.declines}</b>\n\n`;

    // Institutional Cash
    msg += `🏦 <b>INSTITUTIONAL CASH ACTIVITY</b>\n`;
    msg += `• FII Net: <b>₹${data.institutionalCashSummary.fiiNetCr.toLocaleString()} Cr</b>\n`;
    msg += `• DII Net: <b>₹+${data.institutionalCashSummary.diiNetCr.toLocaleString()} Cr</b>\n\n`;

    // Sector Hierarchy
    msg += `🏆 <b>SECTOR RANKINGS</b>\n`;
    data.sectorPerformanceTable.slice(0, 4).forEach(s => {
      msg += `${s.rank}. <b>${s.sector}</b>: ${s.changePct >= 0 ? '+' : ''}${s.changePct}% (Leader: ${s.leader})\n`;
    });
    msg += `\n`;

    // Tomorrow Watchlist
    msg += `🔭 <b>TOMORROW WATCHLIST</b>\n`;
    data.tomorrowWatchlist.slice(0, 3).forEach(tw => {
      msg += `• <b>${this.escapeHtml(tw.title)}</b> (${this.escapeHtml(tw.triggerTimeOrCondition)})\n`;
    });
    msg += `\n`;

    msg += `${divider}\n`;
    msg += `🧠 <b>CLOSING CONCLUSION</b>\n`;
    msg += `<i>${this.escapeHtml(data.athenaAssessment.institutionalConclusion)}</i>\n`;
    msg += `${divider}`;

    return msg;
  }

  /**
   * Format 📚 Full Day Chronicle for Telegram
   */
  public static formatFullDay(data: FullDayDigestData): string {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';
    let msg = `${divider}\n`;
    msg += `📚 <b>ATHENA DAILY MARKET CHRONICLE</b>\n`;
    msg += `📅 ${data.date} | Full Day Reconstruction\n`;
    msg += `${divider}\n\n`;

    msg += `📝 <b>EXECUTIVE SUMMARY</b>\n`;
    msg += `${this.escapeHtml(data.executiveSummary)}\n\n`;

    msg += `🔥 <b>TOP MARKET MOVING CATALYSTS</b>\n`;
    data.top5MarketMovingCatalysts.slice(0, 3).forEach(c => {
      msg += `<b>${c.rank}. ${this.escapeHtml(c.headline)}</b>\n   ↳ ${this.escapeHtml(c.impactDescription)}\n`;
    });
    msg += `\n`;

    msg += `💡 <b>CORE TAKEAWAYS FOR INVESTORS</b>\n`;
    msg += `1️⃣ ${this.escapeHtml(data.athenaDailyConclusion.keyTakeaway1)}\n`;
    msg += `2️⃣ ${this.escapeHtml(data.athenaDailyConclusion.keyTakeaway2)}\n`;
    msg += `3️⃣ ${this.escapeHtml(data.athenaDailyConclusion.keyTakeaway3)}\n\n`;

    msg += `${divider}\n`;
    msg += `Signal Accuracy Scorecard: <b>${data.athenaSignalsScorecard.winRatePct}% Win Rate</b> (${data.athenaSignalsScorecard.signalsConfirmed}/${data.athenaSignalsScorecard.signalsGenerated} confirmed)\n`;
    msg += `${divider}`;

    return msg;
  }
}
