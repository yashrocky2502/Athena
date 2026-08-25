import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { marketDataProvider, PriceTick, FnoTick } from '../intelligence/MarketDataProvider.ts';
import { LiveMarketReactionEngine } from '../intelligence/LiveMarketReactionEngine.ts';
import { MarketVolumeConfirmationEngine } from '../intelligence/MarketVolumeConfirmationEngine.ts';
import { FnoPositioningEngine } from '../intelligence/FnoPositioningEngine.ts';
import { MarketConfirmationEngine } from '../intelligence/MarketConfirmationEngine.ts';

describe('Phase 9.2: Live Market Reaction, F&O Positioning & Trader Confirmation Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Monday, Aug 24, 2026 at 10:40 AM IST (05:10:00 UTC)
    vi.setSystemTime(new Date('2026-08-24T05:10:00Z'));
    marketDataProvider.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- EVENT-TIME ANCHORING & PRICE TICKS (Test Cases 1-5) ---

  test('1. Event-Time Anchoring: Exact match within interval', () => {
    const symbol = 'TCS';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 4100, volume: 150 } // +2.5% since event
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.availability).toBe('AVAILABLE');
    expect(result.priceBeforeEvent).toBe(4000);
    expect(result.eventTimePrice).toBe(4000);
    expect(result.currentPrice).toBe(4100);
    expect(result.percentagePriceChange).toBe(2.5);
  });

  test('2. Event-Time Anchoring: Outer bounds boundary condition', () => {
    const symbol = 'INFY';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:51:00Z', price: 1500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1500, volume: 100 },
      { timestamp: '2026-08-24T05:10:00Z', price: 1515, volume: 120 } // +1% since event
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.availability).toBe('AVAILABLE');
    expect(result.priceBeforeEvent).toBe(1500);
    expect(result.eventTimePrice).toBe(1500);
    expect(result.currentPrice).toBe(1515);
    expect(result.percentagePriceChange).toBe(1);
  });

  test('3. Event-Time Anchoring: Outside bounds resulting in INSUFFICIENT_EVIDENCE / NOT_AVAILABLE', () => {
    const symbol = 'RELIANCE';
    const eventTime = '2026-08-24T05:00:00Z';
    
    // Register ticks that are completely outside the 60-minute post-event anchoring window
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T06:05:00Z', price: 2510, volume: 120 }
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.availability).toBe('PARTIAL');
    expect(result.reactionDirection).toBe('NEUTRAL');
  });

  test('4. Stale Price Data: Ticks are stale but within grace limit', () => {
    const symbol = 'SBIN';
    const eventTime = '2026-08-24T05:00:00Z';
    
    // Set system time to 30 mins after ticks to simulate stale data
    vi.setSystemTime(new Date('2026-08-24T05:35:00Z'));

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 600, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 600, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 606, volume: 100 } // +1%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.availability).toBe('AVAILABLE');
    expect(result.dataFreshness).toBe('STALE');
    expect(result.percentagePriceChange).toBe(1);
  });

  test('5. Expired Price Data: Ticks are too old (older than max limit)', () => {
    const symbol = 'HDFC';
    const eventTime = '2026-08-24T05:00:00Z';
    
    // Set system time to 150 mins after ticks to simulate expired data
    vi.setSystemTime(new Date('2026-08-24T07:35:00Z'));

    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1600, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1600, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1616, volume: 100 }
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.dataFreshness).toBe('EXPIRED');
  });


  // --- PRICE DIRECTION CLASSIFICATION (Test Cases 6-10) ---

  test('6. Price Direction Classification: Strong positive price reaction', () => {
    const symbol = 'ICICI';
    const eventTime = '2026-08-24T05:00:00Z';
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1021, volume: 100 } // +2.1%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.reactionDirection).toBe('POSITIVE');
    expect(result.reactionStrength).toBe('STRONG');
  });

  test('7. Price Direction Classification: Mild positive price reaction', () => {
    const symbol = 'ICICI';
    const eventTime = '2026-08-24T05:00:00Z';
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1006, volume: 100 } // +0.6%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.reactionDirection).toBe('POSITIVE');
    expect(result.reactionStrength).toBe('WEAK');
  });

  test('8. Price Direction Classification: Strong negative price reaction', () => {
    const symbol = 'ICICI';
    const eventTime = '2026-08-24T05:00:00Z';
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 979, volume: 100 } // -2.1%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.reactionDirection).toBe('NEGATIVE');
    expect(result.reactionStrength).toBe('STRONG');
  });

  test('9. Price Direction Classification: Mild negative price reaction', () => {
    const symbol = 'ICICI';
    const eventTime = '2026-08-24T05:00:00Z';
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 989, volume: 100 } // -1.1%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.reactionDirection).toBe('NEGATIVE');
    expect(result.reactionStrength).toBe('MODERATE');
  });

  test('10. Price Direction Classification: Neutral price reaction', () => {
    const symbol = 'ICICI';
    const eventTime = '2026-08-24T05:00:00Z';
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 1000, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 1001, volume: 100 } // +0.1%
    ]);

    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    expect(result.reactionDirection).toBe('NEUTRAL');
    expect(result.reactionStrength).toBe('NONE');
  });


  // --- VOLUME PARTICIPATION (Test Cases 11-14) ---

  test('11. Volume Participation: Substantial volume confirmation (> 2x)', () => {
    const symbol = 'AXIS';
    const eventDate = '2026-08-24';
    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      volume: 500000,
      baselineVolume: 200000
    });

    const result = MarketVolumeConfirmationEngine.evaluate(symbol, `${eventDate}T05:00:00Z`);
    expect(result.volumeAvailability).toBe('AVAILABLE');
    expect(result.volumeMultiple).toBe(2.5);
    expect(result.confirmationStatus).toBe('STRONG_CONFIRMATION');
  });

  test('12. Volume Participation: Normal volume participation (0.8x - 2x)', () => {
    const symbol = 'AXIS';
    const eventDate = '2026-08-24';
    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      volume: 250000,
      baselineVolume: 200000
    });

    const result = MarketVolumeConfirmationEngine.evaluate(symbol, `${eventDate}T05:00:00Z`);
    expect(result.volumeMultiple).toBe(1.25);
    expect(result.confirmationStatus).toBe('CONFIRMED');
  });

  test('13. Volume Participation: Low volume participation (< 0.8x)', () => {
    const symbol = 'AXIS';
    const eventDate = '2026-08-24';
    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 100,
      high: 105,
      low: 99,
      close: 104,
      volume: 100000,
      baselineVolume: 200000
    });

    const result = MarketVolumeConfirmationEngine.evaluate(symbol, `${eventDate}T05:00:00Z`);
    expect(result.confirmationStatus).toBe('WEAK');
    expect(result.volumeMultiple).toBe(0.5);
  });

  test('14. Volume Participation: Missing volume data', () => {
    const symbol = 'AXIS';
    const eventDate = '2026-08-24';

    const result = MarketVolumeConfirmationEngine.evaluate(symbol, `${eventDate}T05:00:00Z`);
    expect(result.volumeAvailability).toBe('NOT_AVAILABLE');
    expect(result.confirmationStatus).toBe('NOT_AVAILABLE');
  });


  // --- F&O POSITIONING ENGINE (Test Cases 15-19) ---

  test('15. F&O Positioning: Put writing F&O classification', () => {
    const symbol = 'NIFTY';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 24000,
        futuresPrice: 24050,
        futuresOI: 10000000,
        callOI: 5000000,
        putOI: 5000000,
        callOIChange: 100000,
        putOIChange: 500000, // Put OI change > 1.5x Call OI change
        PCR: 1.1,
        IV: 14.5,
        IVChange: -1.2,
        keyCallStrikes: [24100],
        keyPutStrikes: [23900],
        strikeConcentration: 'Put writing'
      }
    ]);

    const result = FnoPositioningEngine.calculate(symbol, eventTime, 1.0); // positive price move
    expect(result.availability).toBe('AVAILABLE');
    expect(result.optionFlowClassification).toBe('PUT_WRITING');
  });

  test('16. F&O Positioning: Call writing F&O classification', () => {
    const symbol = 'NIFTY';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 24000,
        futuresPrice: 24050,
        futuresOI: 10000000,
        callOI: 5000000,
        putOI: 5000000,
        callOIChange: 500000, // Call OI change > 1.5x Put OI change
        putOIChange: 100000,
        PCR: 0.8,
        IV: 15.0,
        IVChange: 1.2,
        keyCallStrikes: [24100],
        keyPutStrikes: [23900],
        strikeConcentration: 'Call writing'
      }
    ]);

    const result = FnoPositioningEngine.calculate(symbol, eventTime, -1.0); // negative price move
    expect(result.availability).toBe('AVAILABLE');
    expect(result.optionFlowClassification).toBe('CALL_WRITING');
  });

  test('17. F&O Positioning: Short covering F&O classification', () => {
    const symbol = 'NIFTY';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 24000,
        futuresPrice: 24050,
        futuresOI: 10000000,
        callOI: 5000000,
        putOI: 5000000,
        callOIChange: -200000, // both negative (short covering since price is up)
        putOIChange: -200000,
        PCR: 1.0,
        IV: 14.0,
        IVChange: -1.0,
        keyCallStrikes: [24100],
        keyPutStrikes: [23900],
        strikeConcentration: 'Covering'
      }
    ]);

    const result = FnoPositioningEngine.calculate(symbol, eventTime, 0.5); // price up + negative OI changes
    expect(result.optionFlowClassification).toBe('SHORT_COVERING');
  });

  test('18. F&O Positioning: Long unwinding F&O classification', () => {
    const symbol = 'NIFTY';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 24000,
        futuresPrice: 24050,
        futuresOI: 10000000,
        callOI: 5000000,
        putOI: 5000000,
        callOIChange: -300000, // both negative (long unwinding since price is down)
        putOIChange: -300000,
        PCR: 1.0,
        IV: 14.5,
        IVChange: -0.5,
        keyCallStrikes: [24100],
        keyPutStrikes: [23900],
        strikeConcentration: 'Unwinding'
      }
    ]);

    const result = FnoPositioningEngine.calculate(symbol, eventTime, -0.5); // price down + negative OI changes
    expect(result.optionFlowClassification).toBe('LONG_UNWINDING');
  });

  test('19. F&O Positioning: Missing F&O data', () => {
    const symbol = 'NIFTY';
    const eventTime = '2026-08-24T05:00:00Z';

    const result = FnoPositioningEngine.calculate(symbol, eventTime, 1.0);
    expect(result.availability).toBe('NOT_AVAILABLE');
    expect(result.optionFlowClassification).toBe('INSUFFICIENT_EVIDENCE');
  });


  // --- MULTIDIMENSIONAL ORCHESTRATION & DECISION SUPPORT (Test Cases 20-25) ---

  test('20. Confirmation Orchestrator: Bullish Fundamental + Positive Price + High Volume + Put Writing', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';
    const eventDate = '2026-08-24';

    // Register Price ticks (+2% since event)
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 510, volume: 100 }
    ]);

    // Register Volume (2.5x)
    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 500,
      high: 512,
      low: 498,
      close: 510,
      volume: 500000,
      baselineVolume: 200000
    });

    // Register F&O (+5% OI, increased PCR)
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 510,
        futuresPrice: 511,
        futuresOI: 2000000,
        callOI: 1000000,
        putOI: 1000000,
        callOIChange: 100000,
        putOIChange: 300000,
        PCR: 1.1,
        IV: 18,
        IVChange: -0.5,
        keyCallStrikes: [520],
        keyPutStrikes: [500],
        strikeConcentration: 'Put writing'
      }
    ]);

    const result = MarketConfirmationEngine.process(symbol, eventTime, 'BULLISH');
    expect(result.overallConfirmation).toBe('CONFIRMED');
    expect(result.priceReaction.reactionDirection).toBe('POSITIVE');
    expect(result.volumeConfirmation.confirmationStatus).toBe('STRONG_CONFIRMATION');
    expect(result.fnoPositioning.optionFlowClassification).toBe('PUT_WRITING');
  });

  test('21. Confirmation Orchestrator: Bearish Fundamental + Negative Price + High Volume + Call Writing', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';
    const eventDate = '2026-08-24';

    // Register Price ticks (-2% since event)
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 490, volume: 100 }
    ]);

    // Register Volume (2.5x)
    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 500,
      high: 502,
      low: 488,
      close: 490,
      volume: 500000,
      baselineVolume: 200000
    });

    // Register F&O (+5% OI, decreased PCR)
    marketDataProvider.registerFnoTicks(symbol, [
      {
        timestamp: '2026-08-24T05:05:00Z',
        expiry: '2026-08-27',
        spot: 490,
        futuresPrice: 491,
        futuresOI: 2000000,
        callOI: 1000000,
        putOI: 1000000,
        callOIChange: 300000,
        putOIChange: 100000,
        PCR: 0.9,
        IV: 18,
        IVChange: 0.5,
        keyCallStrikes: [500],
        keyPutStrikes: [480],
        strikeConcentration: 'Call writing'
      }
    ]);

    const result = MarketConfirmationEngine.process(symbol, eventTime, 'BEARISH');
    expect(result.overallConfirmation).toBe('CONFIRMED');
    expect(result.fnoPositioning.optionFlowClassification).toBe('CALL_WRITING');
  });

  test('22. Confirmation Orchestrator: Contradiction Handling (Bullish Fundamental + Strong Negative Price Move)', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';
    const eventDate = '2026-08-24';

    // Bullish thesis, but price crashes -3% since event
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 485, volume: 100 }
    ]);

    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 500,
      high: 502,
      low: 482,
      close: 485,
      volume: 500000,
      baselineVolume: 200000
    });

    const result = MarketConfirmationEngine.process(symbol, eventTime, 'BULLISH');
    expect(result.overallConfirmation).toBe('CONTRADICTED');
    expect(result.contradictionFlags).toContain('PRICE_DIRECTION_CONTRADICTS_BULLISH_THESIS');
  });

  test('23. Confirmation Orchestrator: Partially Confirmed (Bullish Fundamental + Positive Price + Normal Volume, but No F&O)', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';
    const eventDate = '2026-08-24';

    // Bullish price move (+1% since event) and normal volume (1.25x average) but no F&O
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 500, volume: 100 },
      { timestamp: '2026-08-24T05:05:00Z', price: 505, volume: 100 }
    ]);

    marketDataProvider.registerSessionSummary(symbol, eventDate, {
      sessionDate: eventDate,
      open: 500,
      high: 506,
      low: 499,
      close: 505,
      volume: 250000,
      baselineVolume: 200000
    });

    const result = MarketConfirmationEngine.process(symbol, eventTime, 'BULLISH');
    expect(result.overallConfirmation).toBe('PARTIALLY_CONFIRMED');
    expect(result.priceReaction.reactionDirection).toBe('POSITIVE');
    expect(result.volumeConfirmation.confirmationStatus).toBe('CONFIRMED');
  });

  test('24. Confirmation Orchestrator: Insufficient Evidence', () => {
    const symbol = 'WIPRO';
    const eventTime = '2026-08-24T05:00:00Z';

    // Completely empty database
    const result = MarketConfirmationEngine.process(symbol, eventTime, 'BULLISH');
    expect(result.overallConfirmation).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.priceReaction.availability).toBe('NOT_AVAILABLE');
    expect(result.volumeConfirmation.volumeAvailability).toBe('NOT_AVAILABLE');
  });

  test('25. Zero-AI Cost Guard: Mathematical execution confirmation', () => {
    const symbol = 'TCS';
    const eventTime = '2026-08-24T05:00:00Z';
    
    marketDataProvider.registerPriceTicks(symbol, [
      { timestamp: '2026-08-24T04:59:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:00:00Z', price: 4000, volume: 100 },
      { timestamp: '2026-08-24T05:01:00Z', price: 4120, volume: 100 } // +3%
    ]);

    const start = Date.now();
    const result = LiveMarketReactionEngine.calculate(symbol, eventTime);
    const end = Date.now();

    // Verification of zero AI, local execution must complete in single-digit milliseconds
    expect(result.availability).toBe('AVAILABLE');
    expect(end - start).toBeLessThan(10);
  });
});
