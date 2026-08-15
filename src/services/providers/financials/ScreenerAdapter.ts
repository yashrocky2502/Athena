import { FinancialProvider, NormalizedFinancialMetrics } from "./types";
import { YahooFetcher } from "./YahooFetcher";

export class ScreenerAdapter implements FinancialProvider {
  public readonly name = "Screener";

  public async fetchMetrics(symbol: string): Promise<NormalizedFinancialMetrics | null> {
    const isIndian = symbol.toUpperCase().includes(".NS") || symbol.toUpperCase().includes(".BO") || symbol.toUpperCase() === "RELIANCE" || symbol.toUpperCase() === "TCS" || symbol.toUpperCase() === "HDFCBANK" || symbol.toUpperCase() === "INFY" || symbol.toUpperCase() === "TATAMOTORS";
    
    // Screener is an Indian stock analysis platform
    if (!isIndian) {
      return null;
    }

    const cleanPrefix = symbol.split(".")[0].toUpperCase();
    const nseSymbol = `${cleanPrefix}.NS`;

    const fetcher = YahooFetcher.getInstance();
    return fetcher.fetchRaw(nseSymbol);
  }
}
