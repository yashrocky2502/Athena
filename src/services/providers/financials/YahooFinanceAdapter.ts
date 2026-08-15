import { FinancialProvider, NormalizedFinancialMetrics } from "./types";
import { YahooFetcher } from "./YahooFetcher";

export class YahooFinanceAdapter implements FinancialProvider {
  public readonly name = "Yahoo Finance";

  public async fetchMetrics(symbol: string): Promise<NormalizedFinancialMetrics | null> {
    const fetcher = YahooFetcher.getInstance();
    // Yahoo Finance can fetch any standard symbol directly (e.g. RELIANCE.NS or AAPL)
    return fetcher.fetchRaw(symbol);
  }
}
