/**
 * ATHENA — Phase 18 Telegram Alert Formatting
 * SurveillanceTelegramSnapshot.ts
 */

import { MarketSurveillanceEvent } from './types.ts';

export class SurveillanceTelegramSnapshot {
  private static instance: SurveillanceTelegramSnapshot;

  private constructor() {}

  public static getInstance(): SurveillanceTelegramSnapshot {
    if (!SurveillanceTelegramSnapshot.instance) {
      SurveillanceTelegramSnapshot.instance = new SurveillanceTelegramSnapshot();
    }
    return SurveillanceTelegramSnapshot.instance;
  }

  /**
   * Formats a canonical surveillance event for Telegram notification.
   */
  public format(event: MarketSurveillanceEvent): string {
    const directionEmoji = event.priceMetrics.percentageChange >= 0 ? '🟢' : '🔴';
    
    return `⚡ ATHENA SURVEILLANCE ALERT

<b>${event.symbol} — Unusual Market Activity Detected</b>

🔴 Priority: ${event.priority.replace('_', ' ')}
📊 Anomaly Score: ${event.anomalyScores.finalScore}/100
⏱ Window: ${event.detectionWindow}

📰 <b>News Correlation</b>
${event.catalystStatus === 'NEWS_CONFIRMED' ? 'Confirmed — recent news catalyst matched.' : 'No correlating news found.'}

📈 <b>Market Evidence</b>
• Price: ${event.priceMetrics.percentageChange >= 0 ? '+' : ''}${event.priceMetrics.percentageChange.toFixed(2)}%
• RVOL: ${event.volumeMetrics.relativeVolume.toFixed(1)}x
• VWAP displacement: ${event.priceMetrics.vwapDisplacementPct >= 0 ? '+' : ''}${event.priceMetrics.vwapDisplacementPct.toFixed(2)}%
• Sector relative strength: ${event.sectorMetrics?.stockVsSectorReturnPct >= 0 ? '+' : ''}${event.sectorMetrics?.stockVsSectorReturnPct.toFixed(2)}%

📊 <b>F&O Evidence</b>
• OI: ${event.openInterestMetrics?.oiChangePct >= 0 ? '+' : ''}${event.openInterestMetrics?.oiChangePct.toFixed(1)}%
• Futures volume: ${event.openInterestMetrics?.futuresVolumeRatio.toFixed(1)}x normal
• Call-side activity elevated

🧠 <b>ATHENA Interpretation</b>
Multi-factor ${event.priceMetrics.percentageChange >= 0 ? 'bullish' : 'bearish'} confirmation detected.

⚠️ <b>Contradictions/Risks</b>
${event.contradictions.length > 0 ? event.contradictions[0] : 'No material contradiction detected.'}

🎯 <b>Actionability</b>
${event.actionability} → Downstream strategy evaluation eligible.

🔗 <b>Event ID</b>
${event.id}`;
  }
}
export const surveillanceTelegramSnapshot = SurveillanceTelegramSnapshot.getInstance();
