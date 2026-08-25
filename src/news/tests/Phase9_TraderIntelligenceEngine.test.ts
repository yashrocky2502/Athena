import { describe, test, expect } from 'vitest';
import { TraderIntelligenceEngine } from '../intelligence/TraderIntelligenceEngine.ts';
import { FundamentalImpactEngine } from '../intelligence/FundamentalImpactEngine.ts';
import { MarketReactionEngine } from '../intelligence/MarketReactionEngine.ts';
import { FnoEvidenceEngine } from '../intelligence/FnoEvidenceEngine.ts';

describe('Phase 9: ATHENA Evidence-Grounded Trader Intelligence Engine', () => {

  // Test Case 1: Event Classification Determinism
  test('1. Event Classification: Matches correct event category from headlines/body keywords', () => {
    // Buyback classification
    const buybackArticle = {
      id: 'test-art-1',
      headline: 'Infosys board approves share buyback worth Rs 9300 cr',
      body: 'The company announced a buyback of shares from open market.'
    };
    const intel1 = TraderIntelligenceEngine.process(buybackArticle);
    expect(intel1.eventType).toBe('BUYBACK');

    // Earnings classification
    const earningsArticle = {
      id: 'test-art-2',
      headline: 'Reliance Industries Q3 results: Net profit rises 15% to Rs 17,201 crore',
      body: 'The company reported strong sequential growth in net profit.'
    };
    const intel2 = TraderIntelligenceEngine.process(earningsArticle);
    expect(intel2.eventType).toBe('PROFIT_UPDATE');

    // Order win classification
    const orderArticle = {
      id: 'test-art-3',
      headline: 'L&T Secures mega order win worth Rs 5,000 crore from Middle East',
      body: 'The construction arm has bagged a massive contract for infrastructure.'
    };
    const intel3 = TraderIntelligenceEngine.process(orderArticle);
    expect(intel3.eventType).toBe('ORDER_WIN');
  });

  // Test Case 2: Accurate Fundamental Impact and Transmission Mechanisms
  test('2. Fundamental Impact: Correctly maps corporate events to economic transmission mechanisms', () => {
    const mockEvidence = [{
      id: 'mock-1',
      source: 'NSE',
      sourceTier: 'TIER_1' as const,
      evidenceText: 'L&T wins massive order',
      evidenceType: 'SOURCE_FACT' as const
    }];

    // Order Win -> Order-book expansion
    const orderText = 'L&T wins massive order worth Rs 5000 crore';
    const orderAnalysis = FundamentalImpactEngine.analyze('ORDER_WIN', orderText, mockEvidence);
    expect(orderAnalysis.mechanism).toContain('order-book expansion');
    expect(orderAnalysis.status).toBe('VERIFIED');

    // Dividend -> Cash distribution
    const divText = 'ITC announces interim dividend of Rs 9.50 per share with cash outflow of Rs 2000 cr.';
    const divAnalysis = FundamentalImpactEngine.analyze('DIVIDEND', divText, mockEvidence);
    expect(divAnalysis.mechanism).toContain('cash distribution');
    expect(divAnalysis.status).toBe('VERIFIED');

    // Regulatory Action -> Compliance Risk
    const regulatoryText = 'SEBI imposes a fine of Rs 10 lakh for delayed filing and reporting lapses.';
    const regulatoryAnalysis = FundamentalImpactEngine.analyze('REGULATORY_ACTION', regulatoryText, mockEvidence);
    expect(regulatoryAnalysis.mechanism).toContain('compliance cost');
    expect(regulatoryAnalysis.status).toBe('VERIFIED');
  });

  // Test Case 3: Detection of "What Changed" Comparative Transitions
  test('3. What Changed: Accurately parses comparative transitions and extracts previous vs new values', () => {
    const comparativeText = 'Reliance Q3 net profit rose to Rs 17,201 crore compared with Rs 15,201 crore in the previous year.';
    const intel = TraderIntelligenceEngine.process({
      id: 'test-art-4',
      headline: 'Reliance Profit Up',
      body: comparativeText
    });

    expect(intel.whatChanged.status).toBe('REVISION');
    expect(intel.whatChanged.newValue).toBe('17,201');
    expect(intel.whatChanged.previousValue).toBe('15,201');
    expect(intel.whatChanged.changeDirection).toBe('UP');
    expect(intel.whatChanged.details).toContain('Factual adjustment from previous value');
  });

  // Test Case 4: Strict Non-Fabrication Market Reaction parsing
  test('4. Market Reaction: Respects non-fabrication rules, marking unknown when text evidence is missing', () => {
    // Article with zero post-event reaction mentioned
    const quietArticle = {
      id: 'test-art-5',
      headline: 'Wipro acquires SDN technologies for $50M',
      body: 'Wipro announced a strategic acquisition to boost cloud infrastructure.'
    };
    const quietIntel = TraderIntelligenceEngine.process(quietArticle);
    expect(quietIntel.marketReaction.status).toBe('UNKNOWN');
    expect(quietIntel.marketReaction.percentageChange).toBeUndefined();
    expect(quietIntel.uncertainty).toContain('Post-event intraday stock price response and volume spikes not recorded in text.');

    // Article with explicit positive post-event reaction
    const reactiveArticle = {
      id: 'test-art-6',
      headline: 'Wipro shares surged 4.5% to Rs 520 following SDN acquisition announcement',
      body: 'The stock witnessed heavy volume accumulation following the disclosure.'
    };
    const reactiveIntel = TraderIntelligenceEngine.process(reactiveArticle);
    expect(reactiveIntel.marketReaction.status).toBe('VERIFIED');
    expect(reactiveIntel.marketReaction.percentageChange).toBe(4.5);
    expect(reactiveIntel.marketImpact).toBe('BULLISH');
  });

  // Test Case 5: F&O Derivatives Evidence Grounding and Validation
  test('5. F&O Evidence: Validates derivatives metrics (OI, PCR, IV) only against explicit source text evidence', () => {
    // Text lacks F&O details
    const nonFnoText = 'Nifty continues to consolidate near its support boundary of 22,000.';
    const nonFnoAnalysis = FnoEvidenceEngine.analyze(nonFnoText, 'Reuters');
    expect(nonFnoAnalysis.available).toBe(false);
    expect(nonFnoAnalysis.evidence).toBeUndefined();

    // Text has explicit verified F&O metrics
    const fnoText = 'Nifty option chain shows heavy writing. Open interest rose by 12.5% in 22200 CE. Implied Volatility stood at 15.4% while PCR stood at 0.85.';
    const fnoAnalysis = FnoEvidenceEngine.analyze(fnoText, 'Moneycontrol');
    expect(fnoAnalysis.available).toBe(true);

    const oiEvidence = fnoAnalysis.evidence?.find(e => e.type === 'OI_CHANGE');
    const ivEvidence = fnoAnalysis.evidence?.find(e => e.type === 'IV');
    const pcrEvidence = fnoAnalysis.evidence?.find(e => e.type === 'PCR');

    expect(oiEvidence).toBeDefined();
    expect(oiEvidence?.value).toBe('12.5%');

    expect(ivEvidence).toBeDefined();
    expect(ivEvidence?.value).toBe('15.4%');

    expect(pcrEvidence).toBeDefined();
    expect(pcrEvidence?.value).toBe('0.85');
    expect(fnoAnalysis.status).toBe('VERIFIED');
  });

  // Test Case 6: Multi-Factor Explainable Confidence Score calculation
  test('6. Explainable Confidence: Correctly computes scores based on source authority, evidence volume, and age', () => {
    // High confidence: Tier 1 source, multiple numerical evidence items, active F&O derivatives, fresh timestamp
    const highConfidenceArticle = {
      id: 'test-art-7',
      headline: 'NSE Circular: Board approves stock split of 1:5 ratio with record date set',
      body: 'The official circular published on exchange. Implied Volatility remains stable at 12.5%.',
      source: { publisher: 'NSE' }, // Tier 1
      publishedAt: new Date().toISOString() // Fresh
    };
    const intelHigh = TraderIntelligenceEngine.process(highConfidenceArticle);
    expect(intelHigh.confidence.confidenceScore).toBeGreaterThanOrEqual(50); // High Tier baseline + F&O + Freshness

    // Lower confidence: Tier 3 general source, no F&O details, older timestamp
    const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days old
    const lowConfidenceArticle = {
      id: 'test-art-8',
      headline: 'Some blog post: Rumors of merger',
      body: 'Rumors on internet suggest a possible small merger sometime next quarter.',
      source: { publisher: 'Some Random Blog' }, // Tier 3
      publishedAt: oldDate
    };
    const intelLow = TraderIntelligenceEngine.process(lowConfidenceArticle);
    expect(intelLow.confidence.confidenceScore).toBeLessThan(intelHigh.confidence.confidenceScore);
  });
});
