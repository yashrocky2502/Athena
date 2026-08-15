import { FinancialProvider, NormalizedFinancialMetrics } from "./types";
import { YahooFetcher } from "./YahooFetcher";

export class TickertapeAdapter implements FinancialProvider {
  public readonly name = "Tickertape";

  public async fetchMetrics(symbol: string): Promise<NormalizedFinancialMetrics | null> {
    const isIndian = symbol.toUpperCase().includes(".NS") || symbol.toUpperCase().includes(".BO") || symbol.toUpperCase() === "RELIANCE" || symbol.toUpperCase() === "TCS" || symbol.toUpperCase() === "HDFCBANK" || symbol.toUpperCase() === "INFY" || symbol.toUpperCase() === "TATAMOTORS";
    
    // Tickertape is focused on Indian retail assets
    if (!isIndian) {
      return null;
    }

    const cleanPrefix = symbol.split(".")[0].toUpperCase();
    const nseSymbol = `${cleanPrefix}.NS`;

    const fetcher = YahooFetcher.getInstance();
    return fetcher.fetchRaw(nseSymbol);
  }
}
