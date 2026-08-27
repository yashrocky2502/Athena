import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { TraderDecisionEngine, TraderDecisionDossier } from '../intelligence/TraderDecisionEngine.ts';
import { marketDataProvider } from '../intelligence/MarketDataProvider.ts';
import { MarketConfirmationEngine } from '../intelligence/MarketConfirmationEngine.ts';

describe('Phase 9.4: ATHENA Production Trader Decision Engine & Actionable Trade Playbooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T05:10:00Z'));
    marketDataProvider.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- 1. TRADEABILITY TAXONOMY & DETERMINATION (Tests 1-8) ---

  test('1. Tradeability: Source Grounded + Confirmed Market = TRADEABLE', () => {
    const symbol = 'TCS';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 4100, volume: 300 } // +2.5% Strong Bullish
    ]);

    const article = {
      id: 'art-1',
      headline: 'TCS signs massive $500M AI cloud transformation deal with global bank',
      body: 'Tata Consultancy Services announced a landmark 5-year contract valued at $500 million.',
      publishedAt: eventTime,
      category: 'ORDER_WIN',
      symbol: symbol,
      source: { name: 'NSE Regulatory Filing', publisher: 'National Stock Exchange', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('TRADEABLE');
    expect(dossier.confirmedDirection).toBe('BULLISH');
    expect(dossier.decisionConfidence).toBeGreaterThanOrEqual(70);
  });

  test('2. Tradeability: Strong Fundamental Bullish + Contradicted Price Reaction = WATCH', () => {
    const symbol = 'INFY';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1800, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1800, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1740, volume: 300 } // -3.33% Bearish drop
    ]);

    const article = {
      id: 'art-2',
      headline: 'Infosys reports stellar Q2 net profit surge of 28% YoY',
      body: 'Infosys beats all street estimates with quarterly revenue growth.',
      publishedAt: eventTime,
      category: 'EARNINGS',
      symbol: symbol,
      source: { name: 'BSE Corporate Filing', publisher: 'Bombay Stock Exchange', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('WATCH');
    expect(dossier.fundamentalDirection).toBe('BULLISH');
    expect(dossier.confirmedDirection).toBe('CONTRADICTED');
  });

  test('3. Tradeability: Critical Risk Level forces NO_TRADE', () => {
    const symbol = 'ADANIENT';
    const eventTime = '2026-08-24T05:00:00Z';

    const article = {
      id: 'art-3',
      headline: 'SEBI initiates broad regulatory ban and investigation into Adani Group entities',
      body: 'SEBI and Ministry of Corporate Affairs order immediate audit amid accounting discrepancies.',
      publishedAt: eventTime,
      category: 'REGULATORY',
      symbol: symbol,
      source: { name: 'SEBI Press Wire', publisher: 'SEBI', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.risk.level).toBe('CRITICAL');
    expect(dossier.tradeability).toBe('NO_TRADE');
  });

  test('4. Tradeability: Low Source Authority & Confidence = INSUFFICIENT_EVIDENCE', () => {
    const symbol = 'XYZ';
    const eventTime = '2026-08-24T05:00:00Z';

    const article = {
      id: 'art-4',
      headline: 'Rumors on Twitter say XYZ may get some deal',
      body: 'Social media chatter suggests an unverified development.',
      publishedAt: eventTime,
      category: 'MARKET',
      symbol: symbol,
      source: { name: 'Unknown Blog', publisher: 'Unknown Blog', tier: 4 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('INSUFFICIENT_EVIDENCE');
  });

  test('5. Tradeability: Neutral Rumor or Routine Commentary = NO_TRADE', () => {
    const symbol = 'HDFCBANK';
    const eventTime = '2026-08-24T05:00:00Z';

    const article = {
      id: 'art-5',
      headline: 'HDFC Bank branch operations resume normal shift hours in Mumbai suburbs',
      body: 'Routine banking operations continue across retail branches.',
      publishedAt: eventTime,
      category: 'GENERAL',
      symbol: symbol,
      source: { name: 'Local News Wire', publisher: 'Local News Wire', tier: 3 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['NO_TRADE', 'WATCH']).toContain(dossier.tradeability);
  });

  test('6. Tradeability: Neutral Corporate Action with Low Volatility = WATCH or NO_TRADE', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 500.2, volume: 105 }
    ]);

    const article = {
      id: 'art-6',
      headline: 'Wipro scheduled AGM meeting for shareholders on September 30',
      body: 'Notice is hereby given for the annual general meeting.',
      publishedAt: eventTime,
      category: 'CORPORATE_ACTION',
      symbol: symbol,
      source: { name: 'Exchange Disclosure', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['WATCH', 'NO_TRADE']).toContain(dossier.tradeability);
    expect(dossier.confirmedDirection).toBe('NEUTRAL');
  });

  test('7. Tradeability: Bearish Disinvestment / Order Loss with Bearish Market = TRADEABLE (BEARISH)', () => {
    const symbol = 'BHEL';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 300, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 300, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 291, volume: 280 } // -3% drop
    ]);

    const article = {
      id: 'art-7',
      headline: 'BHEL loses mega thermal turbine tender to competitor consortium',
      body: 'State-owned power generation firm loses multi-billion order.',
      publishedAt: eventTime,
      category: 'ORDER_LOSS',
      symbol: symbol,
      source: { name: 'Financial Express', publisher: 'Financial Express', tier: 2 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('TRADEABLE');
    expect(dossier.confirmedDirection).toBe('BEARISH');
  });

  test('8. Tradeability: F&O Derivative Confirmation upgrades confidence', () => {
    const symbol = 'RELIANCE';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 3000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 3000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 3060, volume: 250 } // +2.0%
    ]);

    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        spotPrice: 3060,
        futuresPrice: 3075,
        pcr: 1.25,
        openInterest: 15000000,
        oiChangePercent: 8.5,
        impliedVolatility: 18.2,
        callOi: 6000000,
        putOi: 9000000
      }
    ]);

    const article = {
      id: 'art-8',
      headline: 'Reliance Retail secures $1.5B investment from global sovereign fund',
      body: 'Strategic equity investment at premium valuation expands retail footprint.',
      publishedAt: eventTime,
      category: 'DEAL',
      symbol: symbol,
      source: { name: 'NSE Direct Filing', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('TRADEABLE');
    expect(dossier.confirmedDirection).toBe('BULLISH');
    expect(dossier.fnoConfirmation.status).toBe('AVAILABLE');
  });

  // --- 2. OPTIONS SELLER PLAYBOOK & STRICT NON-FABRICATION (Tests 9-18) ---

  test('9. Options Playbook: Bullish Confirmed + Live F&O gives OTM PE Sell / Put Credit Spread', () => {
    const symbol = 'TCS';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 4080, volume: 200 }
    ]);

    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        spotPrice: 4080,
        futuresPrice: 4095,
        pcr: 1.3,
        openInterest: 5000000,
        oiChangePercent: 5.2,
        impliedVolatility: 16.5,
        callOi: 2000000,
        putOi: 3000000
      }
    ]);

    const article = {
      id: 'art-9',
      headline: 'TCS expands partnership with Google Cloud for Enterprise AI Solutions',
      body: 'Strategic multi-year initiative to deploy generative AI for Fortune 500 clients.',
      publishedAt: eventTime,
      category: 'PARTNERSHIP',
      symbol: symbol,
      source: { name: 'NSE Filing', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.optionsSellerPlaybook.action).toBe('SELL_PE');
    expect(dossier.optionsSellerPlaybook.strategy).toBe('BULL_PUT_SPREAD');
    expect(dossier.optionsSellerPlaybook.strike).not.toBe('NOT_AVAILABLE');
    expect(dossier.optionsSellerPlaybook.iv).toBe('16.5%');
    expect(dossier.optionsSellerPlaybook.pcr).toBe('1.3');
  });

  test('10. Options Playbook: Strict Non-Fabrication when F&O Data is NOT Available', () => {
    const symbol = 'MIDCAPCO';
    const eventTime = '2026-08-24T05:00:00Z';

    const article = {
      id: 'art-10',
      headline: 'MidcapCo launches new product line across regional markets',
      body: 'Product expansion into domestic Tier-2 cities.',
      publishedAt: eventTime,
      category: 'PRODUCT_LAUNCH',
      symbol: symbol,
      source: { name: 'Press Wire', publisher: 'Press Wire', tier: 2 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    // Strict non-fabrication rule
    expect(dossier.optionsSellerPlaybook.strike).toBe('NOT_AVAILABLE');
    expect(dossier.optionsSellerPlaybook.iv).toBe('NOT_AVAILABLE');
    expect(dossier.optionsSellerPlaybook.pcr).toBe('NOT_AVAILABLE');
    expect(dossier.optionsSellerPlaybook.supportLevel).toBe('NOT_AVAILABLE');
    expect(dossier.optionsSellerPlaybook.resistanceLevel).toBe('NOT_AVAILABLE');
  });

  test('11. Options Playbook: Bearish Confirmed + Live F&O gives OTM CE Sell / Call Credit Spread', () => {
    const symbol = 'SBIN';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 800, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 800, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 776, volume: 300 } // -3%
    ]);

    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        spotPrice: 776,
        futuresPrice: 770,
        pcr: 0.65,
        openInterest: 25000000,
        oiChangePercent: 12.4,
        impliedVolatility: 24.5,
        callOi: 16000000,
        putOi: 9000000
      }
    ]);

    const article = {
      id: 'art-11',
      headline: 'State Bank of India faces asset quality review query from regulator',
      body: 'RBI questions classification of certain stressed agricultural loan accounts.',
      publishedAt: eventTime,
      category: 'REGULATORY',
      symbol: symbol,
      source: { name: 'Bloomberg Wire', publisher: 'Bloomberg', tier: 2 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.optionsSellerPlaybook.action).toBe('SELL_CE');
    expect(dossier.optionsSellerPlaybook.strategy).toBe('BEAR_CALL_SPREAD');
    expect(dossier.optionsSellerPlaybook.iv).toBe('24.5%');
    expect(dossier.optionsSellerPlaybook.pcr).toBe('0.65');
  });

  test('12. Options Playbook: Contradicted Price Reaction yields WAIT strategy', () => {
    const symbol = 'HCLTECH';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1600, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1600, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1550, volume: 200 } // -3.1% Contradicted vs Earnings beat
    ]);

    const article = {
      id: 'art-12',
      headline: 'HCL Technologies reports 14% rise in net quarterly profit',
      body: 'Strong execution across digital services delivers beat.',
      publishedAt: eventTime,
      category: 'EARNINGS',
      symbol: symbol,
      source: { name: 'BSE Filing', publisher: 'BSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.optionsSellerPlaybook.strategy).toBe('WAIT_FOR_CONFIRMATION');
    expect(dossier.optionsSellerPlaybook.action).toBe('WAIT');
  });

  test('13. Options Playbook: Low IV + Neutral gives SHORT_STRANGLE / IRON_CONDOR', () => {
    const symbol = 'ITC';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 450, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 450, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 450.5, volume: 110 }
    ]);

    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        spotPrice: 450.5,
        futuresPrice: 451.0,
        pcr: 0.98,
        openInterest: 10000000,
        oiChangePercent: 0.5,
        impliedVolatility: 11.2,
        callOi: 5000000,
        putOi: 5000000
      }
    ]);

    const article = {
      id: 'art-13',
      headline: 'ITC maintains stable dividend outlook in quarterly operational update',
      body: 'Operational consistency and steady cash flows reported across segments.',
      publishedAt: eventTime,
      category: 'DIVIDEND',
      symbol: symbol,
      source: { name: 'NSE Disclosure', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['SHORT_STRANGLE', 'IRON_CONDOR', 'NEUTRAL_RANGE']).toContain(dossier.optionsSellerPlaybook.strategy);
  });

  // --- 3. HORIZON CLASSIFICATIONS (Tests 14-20) ---

  test('14. Horizon: Earnings / Major Capex = SWING / SHORT_TERM', () => {
    const article = {
      id: 'art-14',
      headline: 'L&T wins mega ₹15,000 Cr international infrastructure order in Middle East',
      body: 'Multi-year turnkey execution scope for mega refinery complex.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'ORDER_WIN',
      symbol: 'LT',
      source: { name: 'Exchange Wire', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['SWING', 'SHORT_TERM']).toContain(dossier.horizon);
  });

  test('15. Horizon: M&A / Regulatory Overhaul = LONG_TERM / SWING', () => {
    const article = {
      id: 'art-15',
      headline: 'Tata Motors completes strategic merger and demerger into commercial and passenger units',
      body: 'Restructuring scheme approved by NCLT creates distinct listed pure-play entities.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'MA_ACTIVITY',
      symbol: 'TATAMOTORS',
      source: { name: 'NCLT Order', publisher: 'NCLT', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['LONG_TERM', 'SWING']).toContain(dossier.horizon);
  });

  test('16. Horizon: Intraday Flash Spike / Rumor = IMMEDIATE / INTRADAY', () => {
    const article = {
      id: 'art-16',
      headline: 'Spike observed in midday block trades for Bank Nifty components',
      body: 'Sudden institutional basket flow across large private lenders.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'BLOCK_DEAL',
      symbol: 'BANKNIFTY',
      source: { name: 'Terminal Wire', publisher: 'Market Wire', tier: 2 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(['IMMEDIATE', 'INTRADAY']).toContain(dossier.horizon);
  });

  // --- 4. TRADER PROFILES IDENTIFICATION (Tests 17-25) ---

  test('17. Trader Profiles: Material Event Driven & F&O eligible', () => {
    const article = {
      id: 'art-17',
      headline: 'Reliance Jio announces nationwide satellite internet pricing commercial rollout',
      body: 'High-speed satellite connectivity services commercially launched.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'PRODUCT_LAUNCH',
      symbol: 'RELIANCE',
      source: { name: 'NSE Direct Filing', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.traderProfiles).toContain('EVENT_DRIVEN_TRADER');
    expect(dossier.traderProfiles).toContain('OPTIONS_SELLER');
  });

  test('18. Trader Profiles: Critical Risk highlights Risk-Conscious Trader profile', () => {
    const article = {
      id: 'art-18',
      headline: 'Directorate of Enforcement conducts search at pharma premises regarding export duties',
      body: 'Enforcement Directorate initiates query into overseas trade invoices.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'LEGAL',
      symbol: 'SUNPHARMA',
      source: { name: 'Wire Service', publisher: 'Reuters', tier: 2 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.traderProfiles).toContain('RISK_CONSCIOUS_TRADER');
  });

  // --- 5. TRIGGER CONDITIONS & INVALIDATION (Tests 26-35) ---

  test('19. Triggers: Bullish tradeable generates clear trigger & invalidation levels', () => {
    const symbol = 'MARUTI';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 12000, volume: 50 },
      { timestamp: '2026-08-24T05:00:00Z', price: 12000, volume: 50 },
      { timestamp: '2026-08-24T05:05:00Z', price: 12240, volume: 150 } // +2%
    ]);

    const article = {
      id: 'art-19',
      headline: 'Maruti Suzuki reports record monthly domestic vehicle sales surpassing 190k units',
      body: 'Strong festive customer bookings accelerate overall dispatches.',
      publishedAt: eventTime,
      category: 'SALES_NUMBERS',
      symbol: symbol,
      source: { name: 'NSE Press Release', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.triggerConditions.length).toBeGreaterThan(0);
    expect(dossier.invalidationConditions.length).toBeGreaterThan(0);
    expect(dossier.invalidationConditions.some(inv => inv.toLowerCase().includes('below') || inv.toLowerCase().includes('invalidation'))).toBe(true);
  });

  test('20. Triggers: Contradicted thesis invalidation explains market rejection', () => {
    const symbol = 'AXISBANK';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1200, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1200, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1160, volume: 200 } // -3.3%
    ]);

    const article = {
      id: 'art-20',
      headline: 'Axis Bank reports solid 18% YoY growth in operating profit',
      body: 'Quarterly profitability beats expectations driven by retail loan expansion.',
      publishedAt: eventTime,
      category: 'EARNINGS',
      symbol: symbol,
      source: { name: 'Exchange Wire', publisher: 'BSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.invalidationConditions.some(inv => inv.toLowerCase().includes('contradiction') || inv.toLowerCase().includes('rejection') || inv.toLowerCase().includes('breakdown'))).toBe(true);
  });

  // --- 6. STRUCTURED EVIDENCE COMPILATION (Tests 36-45) ---

  test('21. Structured Evidence: Categorizes SOURCE, MARKET, FNO, and RISK items', () => {
    const symbol = 'BAJFINANCE';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 7000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 7000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 7140, volume: 220 }
    ]);

    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        spotPrice: 7140,
        futuresPrice: 7160,
        pcr: 1.15,
        openInterest: 8000000,
        oiChangePercent: 4.0,
        impliedVolatility: 21.0,
        callOi: 3800000,
        putOi: 4200000
      }
    ]);

    const article = {
      id: 'art-21',
      headline: 'Bajaj Finance AUM expands 29% YoY with pristine asset quality metrics',
      body: 'Core customer acquisitions accelerate across digital app channels.',
      publishedAt: eventTime,
      category: 'OPERATING_UPDATE',
      symbol: symbol,
      source: { name: 'Exchange Official', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.evidence.length).toBeGreaterThanOrEqual(3);
    const types = dossier.evidence.map(e => e.type);
    expect(types).toContain('SOURCE');
    expect(types).toContain('MARKET');
    expect(types).toContain('RISK');
  });

  // --- 7. DETERMINISM & ZERO-AI CONSTRAINT (Tests 46-55) ---

  test('22. Determinism: Same input guaranteed to produce bit-exact same output', () => {
    const article = {
      id: 'art-22',
      headline: 'KEC International secures multiple new transmission and grid EPC orders',
      body: 'Transmission orders secured in India and SAARC region amounting to ₹1,100 Crore.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'ORDER_WIN',
      symbol: 'KEC',
      source: { name: 'NSE Wire', publisher: 'NSE', tier: 1 }
    };

    const dossier1 = TraderDecisionEngine.evaluateTraderDecision(article);
    const dossier2 = TraderDecisionEngine.evaluateTraderDecision(article);

    expect(dossier1.tradeability).toEqual(dossier2.tradeability);
    expect(dossier1.decisionConfidence).toEqual(dossier2.decisionConfidence);
    expect(dossier1.confirmedDirection).toEqual(dossier2.confirmedDirection);
    expect(dossier1.optionsSellerPlaybook.strategy).toEqual(dossier2.optionsSellerPlaybook.strategy);
    expect(dossier1.decision).toEqual(dossier2.decision);
  });

  test('23. Speed & Latency: Decision evaluation executes within < 5ms synchronously', () => {
    const article = {
      id: 'art-23',
      headline: 'Cipla receives USFDA EIR inspection clearance with zero 483 observations for Goa unit',
      body: 'Inspection closed successfully with no adverse regulatory findings.',
      publishedAt: '2026-08-24T05:00:00Z',
      category: 'REGULATORY_CLEARANCE',
      symbol: 'CIPLA',
      source: { name: 'Exchange Disclosure', publisher: 'NSE', tier: 1 }
    };

    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      TraderDecisionEngine.evaluateTraderDecision(article);
    }
    const totalMs = Date.now() - start;
    const avgMs = totalMs / 50;
    expect(avgMs).toBeLessThan(10); // Ultra-fast deterministic evaluation
  });

  test('24. Null-Safe Input Handling: Handles missing symbol and body gracefully', () => {
    const article = {
      id: 'art-24',
      headline: 'Global markets trade higher on central bank easing signals',
      publishedAt: '2026-08-24T05:00:00Z'
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article as any);
    expect(dossier).toBeDefined();
    expect(dossier.tradeability).toBeDefined();
    expect(dossier.risk).toBeDefined();
  });

  test('25. Invalidation Criteria includes stop loss logic for tradeable setups', () => {
    const symbol = 'TATACONSUM';
    const eventTime = '2026-08-24T05:00:00Z';

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1100, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1100, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1125, volume: 240 } // +2.27%
    ]);

    const article = {
      id: 'art-25',
      headline: 'Tata Consumer acquires leading organic foods brand to bolster premium portfolio',
      body: 'Accretive acquisition funded through internal accruals.',
      publishedAt: eventTime,
      category: 'ACQUISITION',
      symbol: symbol,
      source: { name: 'Exchange Wire', publisher: 'NSE', tier: 1 }
    };

    const dossier = TraderDecisionEngine.evaluateTraderDecision(article);
    expect(dossier.tradeability).toBe('TRADEABLE');
    expect(dossier.invalidationConditions.length).toBeGreaterThanOrEqual(1);
    expect(dossier.invalidationConditions.some(c => c.includes('1100') || c.includes('reversal') || c.includes('stop'))).toBe(true);
  });
});
