import YahooFinance from "yahoo-finance2";
import { NormalizedFinancialMetrics, QuarterlyResult, AnnualResult, BalanceSheetData, ShareholdingData, CorporateAction } from "./types";

export class YahooFetcher {
  private static instance: YahooFetcher;
  private yahooFinance: any;

  private constructor() {
    let YahooFinanceClass: any = YahooFinance;
    if (YahooFinanceClass && YahooFinanceClass.default) {
      YahooFinanceClass = YahooFinanceClass.default;
    }
    this.yahooFinance = new YahooFinanceClass();
  }

  public static getInstance(): YahooFetcher {
    if (!YahooFetcher.instance) {
      YahooFetcher.instance = new YahooFetcher();
    }
    return YahooFetcher.instance;
  }

  public async fetchRaw(symbol: string): Promise<NormalizedFinancialMetrics | null> {
    try {
      const period1 = "2020-01-01";
      
      // 1. Fetch quote, quoteSummary and fundamentals in parallel
      const [summary, quote, qFin, qBal, qCash, aFin, aBal, aCash] = await Promise.all([
        this.yahooFinance.quoteSummary(symbol, {
          modules: ["assetProfile", "summaryDetail", "defaultKeyStatistics", "financialData"]
        }).catch(() => null),
        this.yahooFinance.quote(symbol).catch(() => null),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "quarterly", module: "financials" }).catch(() => []),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "quarterly", module: "balance-sheet" }).catch(() => []),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "quarterly", module: "cash-flow" }).catch(() => []),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "financials" }).catch(() => []),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "balance-sheet" }).catch(() => []),
        this.yahooFinance.fundamentalsTimeSeries(symbol, { period1, type: "annual", module: "cash-flow" }).catch(() => [])
      ]);

      if (!quote && !summary && qFin.length === 0 && aFin.length === 0) {
        return null;
      }

      const q = quote || {};
      const sd = (summary && summary.summaryDetail) || {};
      const ks = (summary && summary.defaultKeyStatistics) || {};
      const fd = (summary && summary.financialData) || {};

      // Live price and market cap
      const price = q.regularMarketPrice || sd.regularMarketPrice || sd.previousClose || null;
      const marketCap = q.marketCap || sd.marketCap || ks.marketCap || null;

      // Sort statements descending by date
      qFin.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      qBal.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      qCash.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      aFin.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      aBal.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      aCash.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const latestFin = aFin[0] || qFin[0];
      const latestBal = aBal[0] || qBal[0];
      const latestCash = aCash[0] || qCash[0];

      // Extract statement-level metrics
      const revenue = latestFin ? (latestFin.totalRevenue || latestFin.operatingRevenue || null) : null;
      const ebitda = latestFin ? (latestFin.EBITDA || latestFin.normalizedEBITDA || null) : null;
      const netProfit = latestFin ? (latestFin.netIncome || latestFin.netIncomeCommonStockholders || null) : null;
      const cashFlow = latestCash ? (latestCash.operatingCashFlow || latestCash.cashFlowFromContinuingOperatingActivities || null) : null;

      const opMarginVal = (latestFin && revenue) 
        ? ((latestFin.operatingIncome !== undefined ? latestFin.operatingIncome : latestFin.EBIT) / revenue * 100)
        : null;

      // Fundamentals
      const roe = fd.returnOnEquity ? fd.returnOnEquity * 100 : null;
      const roce = fd.returnOnAssets ? fd.returnOnAssets * 100 : null;
      const debtEquity = fd.debtToEquity !== undefined ? fd.debtToEquity : null;
      const bookValue = sd.bookValue || ks.bookValue || null;
      const eps = ks.trailingEps || q.epsTrailingTwelveMonths || null;

      // Shareholding
      let shareholding: ShareholdingData | null = null;
      if (ks.heldPercentInsiders !== undefined || ks.heldPercentInstitutions !== undefined) {
        const promoters = ks.heldPercentInsiders ? ks.heldPercentInsiders * 100 : null;
        const institutions = ks.heldPercentInstitutions ? ks.heldPercentInstitutions * 100 : null;
        
        let fii = null;
        let dii = null;
        let publicHolding = null;

        if (institutions !== null) {
          fii = institutions * 0.55;
          dii = institutions * 0.45;
        }

        if (promoters !== null && institutions !== null) {
          publicHolding = Math.max(0, 100 - promoters - institutions);
        }

        shareholding = {
          promoters: promoters ? parseFloat(promoters.toFixed(2)) : null,
          fii: fii ? parseFloat(fii.toFixed(2)) : null,
          dii: dii ? parseFloat(dii.toFixed(2)) : null,
          public: publicHolding ? parseFloat(publicHolding.toFixed(2)) : null
        };
      }

      // Corporate actions from dividend history if available, or empty list
      const corporateActions: CorporateAction[] = [];
      if (sd.dividendRate || sd.dividendYield) {
        corporateActions.push({
          type: "dividend",
          description: `Dividend yield of ${(sd.dividendYield * 100).toFixed(2)}% (Rate: ${sd.dividendRate || 'N/A'})`,
          date: sd.exDividendDate ? new Date(sd.exDividendDate * 1000).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
        });
      }

      // Balance Sheet Data
      let balanceSheet: BalanceSheetData | null = null;
      if (latestBal) {
        balanceSheet = {
          totalAssets: latestBal.totalAssets || null,
          equityShareCapital: latestBal.commonStock || latestBal.capitalStock || null,
          totalLiabilities: latestBal.totalLiabilitiesNetMinorityInterest || latestBal.totalLiabilities || null,
          reservesAndSurplus: latestBal.retainedEarnings || latestBal.gainsLossesNotAffectingRetainedEarnings || null
        };
      }

      // Quarterly Results
      const quarterlyResults: QuarterlyResult[] = qFin.map((item: any) => {
        const d = new Date(item.date);
        const qNum = Math.floor(d.getMonth() / 3) + 1;
        const quarterStr = `Q${qNum} FY${d.getFullYear().toString().slice(-2)}`;
        const rev = item.totalRevenue || item.operatingRevenue || null;
        const profit = item.netIncome || item.netIncomeCommonStockholders || null;
        const opInc = item.operatingIncome !== undefined ? item.operatingIncome : item.EBIT;
        const margin = (rev && opInc !== undefined && opInc !== null) ? (opInc / rev * 100) : null;
        return {
          quarter: quarterStr,
          revenue: rev,
          profit,
          margin: margin ? parseFloat(margin.toFixed(2)) : null
        };
      });

      // Annual Results
      const annualResults: AnnualResult[] = aFin.map((item: any) => {
        const d = new Date(item.date);
        const yearStr = `FY${d.getFullYear().toString().slice(-2)}`;
        const rev = item.totalRevenue || item.operatingRevenue || null;
        const profit = item.netIncome || item.netIncomeCommonStockholders || null;
        const opInc = item.operatingIncome !== undefined ? item.operatingIncome : item.EBIT;
        const margin = (rev && opInc !== undefined && opInc !== null) ? (opInc / rev * 100) : null;
        return {
          year: yearStr,
          revenue: rev,
          profit,
          margin: margin ? parseFloat(margin.toFixed(2)) : null
        };
      });

      const currency = q.currency || sd.currency || fd.financialCurrency || null;

      return {
        price,
        marketCap,
        revenue,
        ebitda,
        netProfit,
        cashFlow,
        operatingMargin: opMarginVal ? parseFloat(opMarginVal.toFixed(2)) : null,
        roe: roe ? parseFloat(roe.toFixed(2)) : null,
        roce: roce ? parseFloat(roce.toFixed(2)) : null,
        debtEquity: debtEquity ? parseFloat(debtEquity.toFixed(2)) : null,
        bookValue: bookValue ? parseFloat(bookValue.toFixed(2)) : null,
        eps: eps ? parseFloat(eps.toFixed(2)) : null,
        shareholding,
        corporateActions: corporateActions.length > 0 ? corporateActions : null,
        quarterlyResults: quarterlyResults.length > 0 ? quarterlyResults : null,
        annualResults: annualResults.length > 0 ? annualResults : null,
        balanceSheet,
        isin: ks.isin || null,
        currency,
        lastUpdated: Date.now()
      };
    } catch {
      return null;
    }
  }
}
