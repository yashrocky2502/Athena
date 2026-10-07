/**
 * ATHENA NEWS ENGINE — F&O TWO-DEFECT SIGNAL REMEDIATION REGRESSION SUITE
 * 
 * Tests:
 * 1. MCX GST Notice -> MCX + REGULATORY_ACTION
 * 2. MCX GST Demand -> MCX + REGULATORY_ACTION
 * 3. MCX Tax Penalty -> MCX + REGULATORY_ACTION
 * 4. MCX Show-Cause Tax Notice -> MCX + REGULATORY_ACTION
 * 5. Unrelated GST Macro Article -> No inappropriate F&O alert (MACRO_DATA / POLICY_CHANGE)
 * 6. Unrelated Tax Policy Article -> No inappropriate F&O alert (POLICY_CHANGE)
 * 7. "Sun TV" -> SUNTV
 * 8. "Sun Television" -> SUNTV
 * 9. "SUNTV" -> SUNTV
 * 10. Sun TV + BSE in same article -> SUNTV, not BSE (Collision Prevention)
 * 11. Genuine BSE Exchange Article -> BSE (Preservation)
 * 12. Generic "sun" / "television" text -> Not SUNTV (Zero Contamination)
 * 13. Audit Case 1: MCX ₹103 Cr Notice -> Entity MCX, REGULATORY_ACTION, Natural Score, Quality Gate Passed
 * 14. Audit Case 2: Sun TV 20% Intraday Rally -> Entity SUNTV, Natural Score Calculation
 */

import { describe, test, expect } from 'vitest';
import { TelegramAlertEligibilityEngine } from '../telegram/TelegramAlertEligibilityEngine';
import { TelegramQualityGate } from '../telegram/TelegramQualityGate';

describe('F&O Two-Defect Signal Remediation Suite', () => {

  // =========================================================================
  // MCX REGRESSION TESTS (Tests 1 - 6)
  // =========================================================================

  test('1. GST notice -> MCX + REGULATORY_ACTION', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'MCX receives GST notice proposing ₹103 crore tax, interest and penalty for FY23',
      body: 'Multi Commodity Exchange of India has received a formal demand notice from tax authorities.',
      source: { publisher: 'CNBC TV18', name: 'CNBC', url: 'https://cnbctv18.com/mcx-gst', collectionMethod: 'API' }
    });
    expect(res.symbol).toBe('MCX');
    expect(res.companyName).toBe('Multi Commodity Exchange of India Limited');
    expect(res.eventType).toBe('REGULATORY_ACTION');
    expect(res.category).toBe('Regulatory');
    expect(res.isEligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(50);
  });

  test('2. GST demand -> MCX + REGULATORY_ACTION', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'MCX faces fresh GST demand order of Rs 48 crore from state authorities',
      body: 'Multi Commodity Exchange reported receiving an assessment order demanding differential GST.',
      source: { publisher: 'Economic Times', name: 'ET', url: 'https://economictimes.com/mcx-demand', collectionMethod: 'API' }
    });
    expect(res.symbol).toBe('MCX');
    expect(res.eventType).toBe('REGULATORY_ACTION');
    expect(res.isEligible).toBe(true);
  });

  test('3. Tax penalty -> MCX + REGULATORY_ACTION', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'Income Tax department slaps tax penalty on Multi Commodity Exchange',
      body: 'MCX disclosed receipt of a tax penalty order relating to prior assessment years.',
      source: { publisher: 'Moneycontrol', name: 'Moneycontrol', url: 'https://moneycontrol.com/mcx-penalty', collectionMethod: 'API' }
    });
    expect(res.symbol).toBe('MCX');
    expect(res.eventType).toBe('REGULATORY_ACTION');
    expect(res.isEligible).toBe(true);
  });

  test('4. Show-cause tax notice -> MCX + REGULATORY_ACTION', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'Show-cause tax notice issued to MCX over transaction fees deduction',
      body: 'The Multi Commodity Exchange of India confirmed receiving the notice and is seeking legal opinion.',
      source: { publisher: 'Business Standard', name: 'BS', url: 'https://businessstandard.com/mcx-showcause', collectionMethod: 'API' }
    });
    expect(res.symbol).toBe('MCX');
    expect(res.eventType).toBe('REGULATORY_ACTION');
    expect(res.isEligible).toBe(true);
  });

  test('5. Unrelated GST macro article -> No inappropriate F&O alert', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'Gross GST collections surge 11% to ₹1.82 lakh crore in September',
      body: 'The central government announced monthly GST revenue numbers indicating robust domestic consumption.',
      source: { publisher: 'Press Information Bureau', name: 'PIB', url: 'https://pib.gov.in/gst-sept', collectionMethod: 'API' }
    });
    expect(res.symbol).toBeNull();
    expect(res.isEligible).toBe(false);
    expect(res.urgency).toBe('LOW');
  });

  test('6. Unrelated tax policy article -> No inappropriate F&O alert', () => {
    const res = TelegramAlertEligibilityEngine.evaluate({
      headline: 'GST Council considers uniform 5% tax rate on medical equipment and healthcare devices',
      body: 'State finance ministers will review the proposed GST rate rationalization in next month meeting.',
      source: { publisher: 'LiveMint', name: 'LiveMint', url: 'https://livemint.com/gst-council', collectionMethod: 'API' }
    });
    expect(res.symbol).toBeNull();
    expect(res.isEligible).toBe(false);
    expect(res.urgency).toBe('LOW');
  });

  // =========================================================================
  // SUNTV REGRESSION TESTS (Tests 7 - 12)
  // =========================================================================

  test('7. "Sun TV" -> SUNTV', () => {
    const res = TelegramAlertEligibilityEngine.resolveEntity(
      'Sun TV shares hit 52-week high after block deal on NSE',
      'Sun TV Network witnessed heavy trading volumes.'
    );
    expect(res.symbol).toBe('SUNTV');
    expect(res.companyName).toBe('Sun TV Network Limited');
  });

  test('8. "Sun Television" -> SUNTV', () => {
    const res = TelegramAlertEligibilityEngine.resolveEntity(
      'Sun Television reports 14% rise in Q2 subscription revenue',
      'The broadcast media company announced quarterly operational metrics.'
    );
    expect(res.symbol).toBe('SUNTV');
    expect(res.companyName).toBe('Sun TV Network Limited');
  });

  test('9. "SUNTV" -> SUNTV', () => {
    const res = TelegramAlertEligibilityEngine.resolveEntity(
      'SUNTV derivatives witness fresh long buildup in October futures',
      'Open interest in SUNTV jumped 18% as option sellers sold 800 PE strikes.'
    );
    expect(res.symbol).toBe('SUNTV');
    expect(res.companyName).toBe('Sun TV Network Limited');
  });

  test('10. Sun TV + BSE in same article -> SUNTV, not BSE (Collision Prevention)', () => {
    const res = TelegramAlertEligibilityEngine.resolveEntity(
      'Sun TV zooms 20%, sees sharpest intraday rally in 9 years; up 45% in 7 days',
      'Shares of Sun TV Network surged 20% on the BSE in heavy trading volume across exchanges.'
    );
    expect(res.symbol).toBe('SUNTV');
    expect(res.companyName).toBe('Sun TV Network Limited');
    expect(res.symbol).not.toBe('BSE');
  });

  test('11. Genuine BSE exchange article -> BSE (Preservation)', () => {
    const res1 = TelegramAlertEligibilityEngine.resolveEntity(
      'BSE Ltd shares jump 5% on strong Q2 transaction revenue growth',
      'BSE Limited reported robust quarterly earnings driven by rising derivatives volumes.'
    );
    expect(res1.symbol).toBe('BSE');
    expect(res1.companyName).toBe('BSE Limited');

    const res2 = TelegramAlertEligibilityEngine.resolveEntity(
      'BSE Corporate Announcements: Buyback schedule and record date intimation',
      'BSE Limited announced details regarding its upcoming share repurchase program.'
    );
    expect(res2.symbol).toBe('BSE');
    expect(res2.companyName).toBe('BSE Limited');
  });

  test('12. Generic "sun" / "television" text -> Not SUNTV (Zero Contamination)', () => {
    const res1 = TelegramAlertEligibilityEngine.resolveEntity(
      'Solar power firms see bright outlook under new rooftop sun subsidy scheme',
      'Companies across the renewable energy space are expanding solar panel manufacturing.'
    );
    expect(res1.symbol).toBeNull();
    expect(res1.companyName).toBe('Indian Financial Markets');

    const res2 = TelegramAlertEligibilityEngine.resolveEntity(
      'Smart television sales jump 15% during festive season sales across retail chains',
      'Consumer electronics brands reported strong demand for large-screen television sets.'
    );
    expect(res2.symbol).toBeNull();
    expect(res2.companyName).toBe('Indian Financial Markets');
  });

  // =========================================================================
  // MATERIALITY & PIPELINE REGRESSION (Tests 13 - 14)
  // =========================================================================

  test('13. Actual Audit Case 1: MCX GST Notice Materiality & Quality Gate', () => {
    const article = {
      headline: 'MCX receives GST notice proposing ₹103 crore tax, interest and penalty for FY23 - CNBC TV18',
      body: 'Multi Commodity Exchange of India Ltd (MCX) has received a show cause notice from the GST authorities demanding tax, interest and penalty totaling ₹103 crore.',
      source: { publisher: 'CNBC TV18', name: 'CNBC TV18', url: 'https://cnbctv18.com/mcx-notice', collectionMethod: 'API' as const }
    };
    const assessment = TelegramAlertEligibilityEngine.evaluate(article);
    expect(assessment.symbol).toBe('MCX');
    expect(assessment.eventType).toBe('REGULATORY_ACTION');
    expect(assessment.score).toBe(70);
    expect(assessment.urgency).toBe('HIGH');
    expect(assessment.isEligible).toBe(true);

    const qg = TelegramQualityGate.validate(assessment, article as any);
    expect(qg.passed).toBe(true);
    expect(qg.failedChecks).toHaveLength(0);
  });

  test('14. Actual Audit Case 2: Sun TV Rally Entity & Scoring', () => {
    const article = {
      headline: 'Sun TV zooms 20%, sees sharpest intraday rally in 9 years; up 45% in 7 days',
      body: 'Shares of Sun TV Network surged 20% on the BSE in heavy trading volume.',
      source: { publisher: 'Business Standard', name: 'Business Standard', url: 'https://businessstandard.com/suntv-rally', collectionMethod: 'API' as const }
    };
    const assessment = TelegramAlertEligibilityEngine.evaluate(article);
    expect(assessment.symbol).toBe('SUNTV');
    expect(assessment.companyName).toBe('Sun TV Network Limited');
    // Thresholds and scoring remain naturally computed
    expect(assessment.score).toBe(45);
    expect(assessment.urgency).toBe('LOW');
  });

});
