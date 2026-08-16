import { describe, it, expect } from 'vitest';
import { FOIntelligenceEngine } from '../intelligence/FOIntelligenceEngine';
import { OptionSellingContext } from '../intelligence/OptionSellingContext';

describe('Stage 5: F&O Intelligence & Option-Selling Context', () => {
  it('1. Computes CE Bias for earnings beat', () => {
    const res = FOIntelligenceEngine.analyze('Reliance Q1 Profit Up 15% Beat Estimates', 'Strong growth across oil and retail', true, 1);
    expect(res.directionalBias).toBe('CE Bias');
    expect(res.confidence).toBeGreaterThanOrEqual(75);
  });

  it('2. Computes PE Bias for earnings miss', () => {
    const res = FOIntelligenceEngine.analyze('Infosys Profit Down 10% Guidance Missed', 'Revenue missed lower guidance', true, 1);
    expect(res.directionalBias).toBe('PE Bias');
    expect(res.confidence).toBeGreaterThanOrEqual(75);
  });

  it('3. Evaluates Option Selling Context with IV crush warning for earnings', () => {
    const opt = OptionSellingContext.evaluate('TCS Earnings Announcement Q1 Results', 'Results released today', true, 80);
    expect(opt.eventRisk).toBe('HIGH');
    expect(opt.expectedVolatilityImpact).toBe('Moderate IV Crush Expected');
    expect(opt.optionChainDataAvailable).toBe(false);
  });
});
