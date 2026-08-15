import { NormalizedMetric } from './FinancialMetricNormalizer';

export class FinancialSummaryBuilder {
  /**
   * Programmatically builds a structured financial summary ONLY from verified extracted metrics.
   * NEVER injects hardcoded or synthetic fallbacks.
   */
  public static build(companyName: string, metrics: NormalizedMetric[]): string {
    if (!metrics || metrics.length === 0) {
      return '';
    }

    const company = companyName || "The company";

    const formatHighlightVal = (m: NormalizedMetric) => {
      let val = m.value.replace(/crore/gi, "Cr").replace(/lakh/gi, "Lakh");
      if (m.change) {
        return `${val} (${m.change} ${m.comparison || 'YoY'})`;
      }
      return val;
    };

    const highlightsBullets = metrics.map(m => `• ${m.name}: ${formatHighlightVal(m)}`);
    const execSummaryParts = metrics.map(m => `${m.name} stood at ${m.value}${m.change ? ` (${m.change})` : ''}`);

    const execSummary = `${company} financial updates: ${execSummaryParts.join(', ')}.`;
    const highlights = highlightsBullets.join('\n');
    const whyItMatters = `Reported financial figures provide clarity on latest operational performance and balance sheet trajectory.`;
    const investorTakeaway = `Investors will evaluate these reported metrics against market consensus estimates and future management commentary.`;

    return `Executive Summary
${execSummary}

Key Highlights
${highlights}

Why It Matters
${whyItMatters}

Investor Takeaway
${investorTakeaway}`;
  }
}
