export type EventType =
  | 'Quarterly Results'
  | 'Corporate Action'
  | 'Board Meeting'
  | 'Dividend'
  | 'Bonus'
  | 'Split'
  | 'Merger'
  | 'Acquisition'
  | 'Government Policy'
  | 'SEBI'
  | 'RBI'
  | 'FII/DII'
  | 'Block Deal'
  | 'Bulk Deal'
  | 'Order Win'
  | 'Capex'
  | 'Plant Expansion'
  | 'Guidance'
  | 'Promoter Activity'
  | 'Credit Rating'
  | 'Management Change'
  | 'General Market News';

export interface ExtractedFinancialMetric {
  type: string; // e.g., "Net Profit", "Revenue", "Order Value", "Dividend Amount"
  value: string; // e.g., "Rs 180 crore", "Rs 5,000 crore", "Rs 7/share"
  changePercent?: string; // e.g., "+22%"
}

export class EventClassifierEngine {
  /**
   * Classifies an article into one of the 22 ATHENA V19 Event Types
   * and extracts key financial metrics for precise cluster matching.
   */
  public static classifyEvent(title: string, summary: string = ''): { eventType: EventType; metrics: ExtractedFinancialMetric[] } {
    const text = `${title} ${summary}`.toLowerCase();
    let eventType: EventType = 'General Market News';

    if (/\b(q[1-4]|quarterly|net profit|pat|ebitda|revenue surges|revenue grows|revenue expands|results|quarter ended)\b/.test(text)) {
      eventType = 'Quarterly Results';
    } else if (/\b(dividend|interim dividend|final dividend|payout)\b/.test(text)) {
      eventType = 'Dividend';
    } else if (/\b(order win|secures.*order|bags.*contract|wins.*order|awarded.*contract|order book)\b/.test(text)) {
      eventType = 'Order Win';
    } else if (/\b(sebi|security exchange board)\b/.test(text)) {
      eventType = 'SEBI';
    } else if (/\b(rbi|reserve bank|repo rate|monetary policy)\b/.test(text)) {
      eventType = 'RBI';
    } else if (/\b(fii|dii|foreign institutional|domestic institutional|institutional flow)\b/.test(text)) {
      eventType = 'FII/DII';
    } else if (/\b(block deal|bulk deal|promoter stake|promoter sell|promoter buy|insider trading|pledge)\b/.test(text)) {
      if (text.includes('block deal')) eventType = 'Block Deal';
      else if (text.includes('bulk deal')) eventType = 'Bulk Deal';
      else eventType = 'Promoter Activity';
    } else if (/\b(bonus issue|bonus share|1:[0-9]|2:[0-9])\b/.test(text)) {
      eventType = 'Bonus';
    } else if (/\b(stock split|share split|face value split)\b/.test(text)) {
      eventType = 'Split';
    } else if (/\b(merger|amalgamation)\b/.test(text)) {
      eventType = 'Merger';
    } else if (/\b(acquisition|acquires|takeover|buys stake|buys 100%|stake sale)\b/.test(text)) {
      eventType = 'Acquisition';
    } else if (/\b(capex|capital expenditure|plant expansion|greenfield|brownfield|new factory)\b/.test(text)) {
      if (text.includes('expansion') || text.includes('factory') || text.includes('facility')) eventType = 'Plant Expansion';
      else eventType = 'Capex';
    } else if (/\b(guidance|margin outlook|revenue guidance|growth target)\b/.test(text)) {
      eventType = 'Guidance';
    } else if (/\b(credit rating|crisil|icra|care ratings|upgrade|downgrade)\b/.test(text)) {
      eventType = 'Credit Rating';
    } else if (/\b(ceo|cfo|md|managing director|board appoints|resigns|appointment|management change)\b/.test(text)) {
      eventType = 'Management Change';
    } else if (/\b(board meeting|board to consider|board approves)\b/.test(text)) {
      eventType = 'Board Meeting';
    } else if (/\b(government policy|cabinet approves|ministry|plt scheme|duty hike|gst council)\b/.test(text)) {
      eventType = 'Government Policy';
    } else if (/\b(corporate action|rights issue|buyback)\b/.test(text)) {
      eventType = 'Corporate Action';
    }

    const metrics = this.extractFinancialMetrics(text);

    return { eventType, metrics };
  }

  /**
   * Fast Regex extraction of monetary amounts, profit numbers, percentages, dividend per share.
   */
  private static extractFinancialMetrics(text: string): ExtractedFinancialMetric[] {
    const metrics: ExtractedFinancialMetric[] = [];

    // Profit / Revenue amounts (e.g. Rs 180 crore, $500 million)
    const moneyMatch = text.match(/(rs\.?|inr|\$|₹)\s*([\d,]+(\.\d+)?)\s*(crore|cr|billion|million|lakh)/gi);
    if (moneyMatch) {
      moneyMatch.slice(0, 3).forEach(val => {
        metrics.push({ type: 'Amount/Metric', value: val.trim() });
      });
    }

    // Percentage changes (e.g. +22%, up 15%)
    const pctMatch = text.match(/([+-]?\d+(\.\d+)?%|\b(up|down|surges|jumps|falls|slips)\s*by\s*\d+(\.\d+)?%)/gi);
    if (pctMatch) {
      pctMatch.slice(0, 2).forEach(val => {
        metrics.push({ type: 'Growth/Change', value: val.trim(), changePercent: val.trim() });
      });
    }

    // Dividend / Share (e.g. Rs 7 per share)
    const divMatch = text.match(/(rs\.?|₹)\s*\d+(\.\d+)?\s*per\s*share/gi);
    if (divMatch) {
      divMatch.forEach(val => {
        metrics.push({ type: 'Dividend Per Share', value: val.trim() });
      });
    }

    return metrics;
  }
}
