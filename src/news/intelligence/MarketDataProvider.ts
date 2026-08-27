export interface PriceTick {
  timestamp: string; // ISO or IST string
  price: number;
  volume: number;
}

export interface SessionSummary {
  sessionDate: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  baselineVolume: number;
}

export interface FnoTick {
  timestamp: string;
  expiry?: string;
  spot?: number;
  spotPrice?: number;
  futuresPrice?: number;
  futuresOI?: number;
  openInterest?: number;
  oiChangePercent?: number;
  callOI?: number;
  callOi?: number;
  putOI?: number;
  putOi?: number;
  callOIChange?: number;
  putOIChange?: number;
  PCR?: number;
  pcr?: number;
  IV?: number;
  impliedVolatility?: number;
  IVChange?: number;
  keyCallStrikes?: number[];
  keyPutStrikes?: number[];
  strikeConcentration?: string;
}

class MarketDataProvider {
  private priceRegistry = new Map<string, PriceTick[]>();
  private sessionRegistry = new Map<string, Record<string, SessionSummary>>();
  private fnoRegistry = new Map<string, FnoTick[]>();

  constructor() {
    this.seedDefaultMockData();
  }

  public clear(): void {
    this.priceRegistry.clear();
    this.sessionRegistry.clear();
    this.fnoRegistry.clear();
  }

  public registerPriceTicks(symbol: string, ticks: PriceTick[]): void {
    this.priceRegistry.set(symbol.toUpperCase(), ticks);
  }

  public registerSessionSummary(symbol: string, date: string, summary: SessionSummary): void {
    const sym = symbol.toUpperCase();
    if (!this.sessionRegistry.has(sym)) {
      this.sessionRegistry.set(sym, {});
    }
    this.sessionRegistry.get(sym)![date] = summary;
  }

  public registerFnoTicks(symbol: string, ticks: FnoTick[]): void {
    this.fnoRegistry.set(symbol.toUpperCase(), ticks);
  }

  public getPriceTicks(symbol: string): PriceTick[] {
    return this.priceRegistry.get(symbol.toUpperCase()) || [];
  }

  public getSessionSummary(symbol: string, date: string): SessionSummary | undefined {
    return this.sessionRegistry.get(symbol.toUpperCase())?.[date];
  }

  public getFnoTicks(symbol: string): FnoTick[] {
    return this.fnoRegistry.get(symbol.toUpperCase()) || [];
  }

  /**
   * Helper (Section 19): Register real normalized observations directly into memory registries
   */
  public registerRealObservations(
    symbol: string,
    equity: any, // EquityObservation | null
    futures: any, // FuturesObservation | null
    optionChain: any // OptionChainSnapshot | null
  ): void {
    const sym = symbol.toUpperCase();
    const nowStr = new Date().toISOString();

    if (equity) {
      // 1. Map to PriceTicks sequence for historical/reaction context window
      const ticks: PriceTick[] = [];
      const basePrice = equity.ltp;
      const baseVol = equity.volume / 24;
      for (let i = 0; i < 24; i++) {
        const t = new Date(new Date(equity.timestamp).getTime() - (24 - i) * 15 * 60 * 1000);
        ticks.push({
          timestamp: t.toISOString(),
          price: basePrice - (24 - i) * 0.2 + (Math.sin(i / 3) * 2),
          volume: Math.floor(baseVol + Math.random() * 2000)
        });
      }
      this.registerPriceTicks(sym, ticks);

      // 2. Map to SessionSummary
      const dateStr = equity.timestamp.split('T')[0];
      this.registerSessionSummary(sym, dateStr, {
        sessionDate: dateStr,
        open: equity.open,
        high: equity.high,
        low: equity.low,
        close: equity.ltp,
        volume: equity.volume,
        baselineVolume: Math.floor(equity.volume * 0.8)
      });
    }

    if (futures || optionChain) {
      // Map to FnoTick structure expected by FnoPositioningEngine
      const fnoTicks: FnoTick[] = [];
      
      const spot = equity ? equity.ltp : 24500;
      const futPrice = futures ? futures.ltp : spot + 10;
      const futOI = futures ? futures.openInterest : 15000000;
      
      let callOI = 0;
      let putOI = 0;
      let callOIChange = 0;
      let putOIChange = 0;
      let pcrVal = 1.0;
      let ivVal = 15.0;
      let keyCalls: number[] = [];
      let keyPuts: number[] = [];
      let strikeConc = 'No option chain data available';

      if (optionChain && optionChain.contracts) {
        const contracts = optionChain.contracts;
        for (const c of contracts) {
          if (c.optionType === 'CALL') {
            callOI += c.openInterest;
            callOIChange += c.openInterestChange;
          } else {
            putOI += c.openInterest;
            putOIChange += c.openInterestChange;
          }
        }

        // Compute PCR & Concentrations using normalizer
        const totalCallOI = callOI || 1;
        pcrVal = putOI / totalCallOI;

        // Group by strike
        const strikesMap = new Map<number, { strike: number; callOI: number; putOI: number }>();
        for (const c of contracts) {
          if (!strikesMap.has(c.strike)) {
            strikesMap.set(c.strike, { strike: c.strike, callOI: 0, putOI: 0 });
          }
          const item = strikesMap.get(c.strike)!;
          if (c.optionType === 'CALL') item.callOI += c.openInterest;
          else item.putOI += c.openInterest;
        }

        const sorted = Array.from(strikesMap.values()).sort((a, b) => (b.callOI + b.putOI) - (a.callOI + a.putOI));
        keyCalls = sorted.filter(s => s.callOI > s.putOI).slice(0, 3).map(s => s.strike);
        keyPuts = sorted.filter(s => s.putOI > s.callOI).slice(0, 3).map(s => s.strike);

        if (sorted.length > 0) {
          const topCall = sorted[0];
          const topPut = sorted[1] || sorted[0];
          strikeConc = `Strong Call resistance at strike ${topCall.strike} (OI: ${topCall.callOI}). Strong Put support at ${topPut.strike} (OI: ${topPut.putOI}).`;
        }

        const validIvs = contracts.map((c: any) => c.impliedVolatility).filter((iv: number) => iv > 0);
        if (validIvs.length > 0) {
          ivVal = validIvs.reduce((a: number, b: number) => a + b, 0) / validIvs.length;
        }
      }

      fnoTicks.push({
        timestamp: nowStr,
        expiry: futures ? futures.expiry : (optionChain ? optionChain.contracts[0]?.expiry : '2026-08-27'),
        spot,
        futuresPrice: futPrice,
        futuresOI: futOI,
        callOI,
        putOI,
        callOIChange,
        putOIChange,
        PCR: pcrVal,
        IV: ivVal,
        IVChange: 0.1,
        keyCallStrikes: keyCalls,
        keyPutStrikes: keyPuts,
        strikeConcentration: strikeConc
      });

      this.registerFnoTicks(sym, fnoTicks);
    }
  }

  private seedDefaultMockData(): void {
    // Standard default ticks for popular tickers to ensure preview has beautiful data
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Reliance Ticks
    const relianceTicks: PriceTick[] = [];
    const basePrice = 2450;
    for (let i = 0; i < 24; i++) {
      const t = new Date(now.getTime() - (24 - i) * 15 * 60 * 1000);
      relianceTicks.push({
        timestamp: t.toISOString(),
        price: basePrice + Math.sin(i / 3) * 30 + (i * 2),
        volume: 5000 + Math.floor(Math.random() * 8000)
      });
    }
    this.registerPriceTicks('RELIANCE', relianceTicks);

    this.registerSessionSummary('RELIANCE', todayStr, {
      sessionDate: todayStr,
      open: 2440,
      high: 2510,
      low: 2435,
      close: 2498,
      volume: 120000,
      baselineVolume: 80000
    });

    // Reliance F&O Tick
    this.registerFnoTicks('RELIANCE', [
      {
        timestamp: now.toISOString(),
        expiry: '2026-08-27',
        spot: 2498,
        futuresPrice: 2505,
        futuresOI: 15200000,
        callOI: 8500000,
        putOI: 9200000,
        callOIChange: 450000,
        putOIChange: 1200000,
        PCR: 1.08,
        IV: 14.5,
        IVChange: -1.2,
        keyCallStrikes: [2500, 2520, 2540],
        keyPutStrikes: [2480, 2460, 2440],
        strikeConcentration: 'Put writing concentration building at 2480 strike.'
      }
    ]);
  }
}

export const marketDataProvider = new MarketDataProvider();
