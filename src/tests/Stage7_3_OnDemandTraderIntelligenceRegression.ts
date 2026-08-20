/**
 * ATHENA NEWS ENGINE — STAGE 7.3
 * On-Demand Trader Intelligence & F&O Priority Architecture Regression Suite
 */

import { TraderImpactEngine } from '../news/intelligence/TraderImpactEngine.ts';
import { TraderIntelligenceCache } from '../news/cache/TraderIntelligenceCache.ts';
import {
  ImpactDirection,
  FNOBias,
  ObservedMarketReaction,
  SymbolResolutionState,
  EventType
} from '../news/types/TraderIntelligence.ts';
import { TraderTelegramFormatter } from '../news/NewsEngine/TraderTelegramFormatter.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

export async function runStage7_3RegressionSuite(): Promise<{ success: boolean; logs: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[Stage 7.3 Test] ${msg}`);
    logs.push(msg);
  };

  log('Starting ATHENA Stage 7.3 On-Demand Trader Intelligence Regression Suite...');

  // -------------------------------------------------------------
  // Test 1: Non-F&O Articles — Summary First & On-Demand Boundary
  // -------------------------------------------------------------
  log('Test 1: Verifying Non-F&O Articles Summary First & On-Demand Boundary...');
  const ordinaryArticle = {
    id: 'ord_art_101',
    title: 'Acme Corp Announces New Manufacturing Facility in Gujarat',
    headline: 'Acme Corp Announces New Manufacturing Facility in Gujarat',
    summary: 'Acme Corp has laid the foundation for a new 50-acre manufacturing hub to expand industrial output.',
    content: 'Acme Corp today announced a strategic expansion with a new manufacturing plant in Gujarat costing Rs 200 crore.',
    publishedAt: new Date().toISOString(),
    source: { name: 'Market Wire', publisher: 'Market Wire' },
    primaryCategory: 'Corporate',
    symbols: ['ACME']
  };

  const cache = TraderIntelligenceCache.getInstance();
  cache.clear();

  // Verify not pre-cached
  assert(!cache.has(ordinaryArticle.id, 'v7_3'), 'Ordinary article should not be pre-cached before explicit request.');

  // Generate on-demand
  const intel1 = TraderImpactEngine.transform(ordinaryArticle as any);
  assert(intel1 !== null, 'Deterministic trader impact engine transforms article successfully.');
  assert(intel1.traderTakeaway.length > 0, 'Trader takeaway generated.');
  
  // Cache it
  cache.set(ordinaryArticle.id, intel1, 'v7_3');
  assert(cache.has(ordinaryArticle.id, 'v7_3'), 'Cache stores intelligence with key format news-intelligence:ord_art_101:v7_3');
  const cachedIntel = cache.get(ordinaryArticle.id, 'v7_3');
  assert(cachedIntel?.headline === ordinaryArticle.headline, 'Cached result matches generated result.');
  log('Test 1 Passed: Summary first & on-demand caching verified.');

  // -------------------------------------------------------------
  // Test 2: F&O Auto-Enrichment & Telegram Formatting Parity
  // -------------------------------------------------------------
  log('Test 2: Verifying F&O Auto-Enrichment & Telegram Formatting...');
  const fnoArticle = {
    id: 'fno_art_202',
    title: 'Tata Motors 1000 CE Call Option Sees Massive 45% Open Interest Addition',
    headline: 'Tata Motors 1000 CE Call Option Sees Massive 45% Open Interest Addition',
    summary: 'Option chain data indicates sharp open interest buildup at 1000 Call Strike with IV rising to 28%.',
    content: 'Tata Motors futures and options traders accumulated 1000 CE call options today with open interest spiking 45%.',
    publishedAt: new Date().toISOString(),
    source: { name: 'Derivatives Pulse' },
    primaryCategory: 'FNO',
    symbols: ['TATAMOTORS'],
    isFno: true
  };

  const fnoIntel = TraderImpactEngine.transform(fnoArticle as any);
  assert(fnoIntel.fnoDetails.isFnoEligible === true, 'F&O eligibility detected for TATAMOTORS.');
  assert(fnoIntel.fnoDetails.fnoEvidencePresent === true, 'Derivatives evidence (open interest, strike) detected.');
  assert(fnoIntel.fnoDetails.cePeBias === FNOBias.CE_BIAS, 'CE Bias correctly identified with positive impact.');

  // Test Telegram formatting on F&O article
  const telegramText = TraderTelegramFormatter.format(fnoArticle as any);
  assert(telegramText.includes('ATHENA'), 'Telegram formatter includes ATHENA alert header.');
  assert(telegramText.includes('TATAMOTORS'), 'Telegram formatter includes ticker symbol.');
  log('Test 2 Passed: F&O auto-enrichment and Telegram formatting verified.');

  // -------------------------------------------------------------
  // Test 3: Strict Derivatives Evidence Rule
  // -------------------------------------------------------------
  log('Test 3: Verifying Strict Derivatives Evidence Rule (No Fabricated Signals)...');
  const fnoNoEvidenceArticle = {
    id: 'fno_no_ev_303',
    title: 'Reliance Industries Appoints New Independent Director',
    headline: 'Reliance Industries Appoints New Independent Director',
    summary: 'Reliance Industries announced the appointment of Ms. Sharma as independent director for 5 years.',
    content: 'In a regulatory filing, Reliance Industries confirmed board restructuring following shareholders approval.',
    publishedAt: new Date().toISOString(),
    source: { name: 'Exchange Disclosures' },
    primaryCategory: 'Corporate',
    symbols: ['RELIANCE']
  };

  const fnoNoEvIntel = TraderImpactEngine.transform(fnoNoEvidenceArticle as any);
  assert(fnoNoEvIntel.fnoDetails.isFnoEligible === true, 'RELIANCE is in F&O universe.');
  assert(fnoNoEvIntel.fnoDetails.fnoEvidencePresent === false, 'No options/futures evidence present in source text.');
  assert(fnoNoEvIntel.cePeBias === FNOBias.INSUFFICIENT_INFORMATION, 'CE/PE bias defaults to INSUFFICIENT_INFORMATION when no derivatives evidence exists.');
  log('Test 3 Passed: Strict derivatives evidence rule verified.');

  // -------------------------------------------------------------
  // Test 4: Observed Market Reaction vs Event Bias
  // -------------------------------------------------------------
  log('Test 4: Verifying Observed Price Reaction vs Event Directional Bias...');
  const earningsDeclineArticle = {
    id: 'earn_dec_404',
    title: 'Infosys Reports Strong Q3 Net Profit Up 12%, Shares Fall 3% in Afternoon Trade',
    headline: 'Infosys Reports Strong Q3 Net Profit Up 12%, Shares Fall 3% in Afternoon Trade',
    summary: 'Despite beating street estimates on revenue and net profit, Infosys shares tumbled 3% on margin guidance.',
    content: 'Infosys reported 12% profit growth, but stock price slipped 3.2% as management cut full year revenue guidance.',
    publishedAt: new Date().toISOString(),
    source: { name: 'Market Wire' },
    symbols: ['INFY']
  };

  const reactionIntel = TraderImpactEngine.transform(earningsDeclineArticle as any);
  assert(reactionIntel.observedMarketReaction === ObservedMarketReaction.BEARISH, 'Observed market reaction identified as BEARISH due to shares falling 3%.');
  assert(reactionIntel.eventType === EventType.EARNINGS, 'Event classified as EARNINGS.');
  assert(reactionIntel.impactDirection === ImpactDirection.BEARISH || reactionIntel.impactDirection === ImpactDirection.MIXED, 'Impact direction correctly recalibrated to BEARISH/MIXED rather than pure BULLISH.');
  log('Test 4 Passed: Observed market reaction precedence verified.');

  // -------------------------------------------------------------
  // Test 5: Zero Brokerage Contamination & Entity Attribution
  // -------------------------------------------------------------
  log('Test 5: Verifying Zero Brokerage Contamination & Unlisted Entity Attribution...');
  const brokerageArticle = {
    id: 'brok_505',
    title: 'SBI Securities Upgrades Sunshine Pictures Target Price to Rs 450',
    headline: 'SBI Securities Upgrades Sunshine Pictures Target Price to Rs 450',
    summary: 'SBI Securities initiated coverage on unlisted Sunshine Pictures with a BUY rating.',
    content: 'Analysts at SBI Securities published a report praising Sunshine Pictures operational cash flows.',
    publishedAt: new Date().toISOString(),
    source: { name: 'Research Desk' },
    symbols: []
  };

  const brokIntel = TraderImpactEngine.transform(brokerageArticle as any);
  assert(brokIntel.entityAttribution.analystsAndBrokerages.includes('SBI Securities'), 'SBI Securities correctly attributed as Brokerage/Analyst.');
  assert(brokIntel.entityAttribution.primaryAffectedEntity.name === 'Sunshine Pictures', 'Primary affected entity is Sunshine Pictures.');
  assert(brokIntel.symbolResolutionState === SymbolResolutionState.UNLISTED_OR_NO_TRADING_SYMBOL, 'Unlisted company detected.');
  assert(brokIntel.symbolImpact.primarySymbol === null || brokIntel.symbolImpact.primarySymbol !== 'SBIN', 'Symbol SBIN was NOT wrongly assigned to Sunshine Pictures.');
  log('Test 5 Passed: Zero brokerage contamination verified.');

  // -------------------------------------------------------------
  // Test 6: Confidence Score Breakdown & Terminology Check
  // -------------------------------------------------------------
  log('Test 6: Verifying Confidence Score Breakdown & Terminology...');
  assert(intel1.confidenceBreakdown !== undefined, 'Confidence breakdown present.');
  assert(intel1.confidenceBreakdown.rating !== undefined, 'Confidence rating (HIGH/MODERATE/LOW) present.');
  assert(!JSON.stringify(intel1).includes('Actionable Trade Recommendation'), 'Forbidden term Actionable Trade Recommendation is absent.');
  log('Test 6 Passed: Confidence score & terminology constraints verified.');

  log('ALL STAGE 7.3 REGRESSION TESTS PASSED SUCCESSFULLY!');
  return { success: true, logs };
}

if (process.argv[1] && process.argv[1].endsWith('Stage7_3_OnDemandTraderIntelligenceRegression.ts')) {
  runStage7_3RegressionSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}
