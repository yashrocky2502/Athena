import { FinancialProvider, NormalizedFinancialMetrics } from "./types";
import { YahooFetcher } from "./YahooFetcher";

export class BseAdapter implements FinancialProvider {
  public readonly name = "BSE";

  public async fetchMetrics(symbol: string): Promise<NormalizedFinancialMetrics | null> {
    const isIndian = symbol.toUpperCase().includes(".NS") || symbol.toUpperCase().includes(".BO") || symbol.toUpperCase() === "RELIANCE" || symbol.toUpperCase() === "TCS" || symbol.toUpperCase() === "HDFCBANK" || symbol.toUpperCase() === "INFY" || symbol.toUpperCase() === "TATAMOTORS";
    
    // BSE only lists Indian companies
    if (!isIndian) {
      return null;
    }

    const cleanPrefix = symbol.split(".")[0].toUpperCase();
    const bseSymbol = `${cleanPrefix}.BO`;

    const fetcher = YahooFetcher.getInstance();
    return fetcher.fetchRaw(bseSymbol);
  }
}
