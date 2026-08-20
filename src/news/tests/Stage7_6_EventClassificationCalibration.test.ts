/**
 * ATHENA NEWS ENGINE — STAGE 7.6 EVENT CLASSIFICATION CALIBRATION SUITE
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EventTypeDetector } from '../detection/EventTypeDetector';

describe('Stage 7.6: Event Classification Calibration Suite (All 25 Event Types)', () => {

  const fixturePath = path.join(process.cwd(), 'src', 'news', 'tests', 'fixtures', 'stage7_6_real_world_articles.json');
  const articles = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  const testCases: Array<{ headline: string; expected: string }> = [
    { headline: "Company reports Q1 profit up 31% to ₹450 crore", expected: "EARNINGS" },
    { headline: "Sunshine Pictures IPO review: Analysts divided; GMP at 20%", expected: "IPO" },
    { headline: "TCS declares ₹20 special interim dividend per share", expected: "DIVIDEND" },
    { headline: "Infosys board approves ₹9,300 crore share buyback at ₹1,850", expected: "BUYBACK" },
    { headline: "Adani Ports acquires 80% stake in Astro Offshore for $185 million", expected: "M_AND_A" },
    { headline: "L&T Construction bags major ₹2,500 crore solar power project in Middle East", expected: "ORDER_WIN" },
    { headline: "DLF opens ₹3,000 crore QIP at floor price of ₹810 per share", expected: "QIP" },
    { headline: "Block deal: 2.5% equity of Zomato changes hands in early trade", expected: "BLOCK_DEAL" },
    { headline: "Promoter entity sells 4% stake in IndusInd Bank via open market", expected: "STAKE_SALE" },
    { headline: "UBS upgrades Tata Motors to Buy with target price of ₹1,150", expected: "RATING_CHANGE" },
    { headline: "RBI imposes ₹1.2 crore monetary penalty on ICICI Bank for compliance lapses", expected: "REGULATORY_ACTION" },
    { headline: "SEBI passes interim order against IIFL Securities over fund segregation", expected: "SEBI_ACTION" },
    { headline: "RBI Monetary Policy Committee keeps repo rate unchanged at 6.5%", expected: "RBI_POLICY" },
    { headline: "US Federal Reserve signals potential 25 bps rate cut in September meeting", expected: "CENTRAL_BANK" },
    { headline: "India IIP industrial production grows 5.4% in June vs 4.7% expected", expected: "MACRO_DATA" },
    { headline: "SBI hikes MCLR loan rates by 10 bps across tenors", expected: "INTEREST_RATE" },
    { headline: "India CPI retail inflation eases to 3.6% in July, five-month low", expected: "INFLATION" },
    { headline: "Indian Rupee rises 12 paise to 83.82 against US Dollar on FII inflows", expected: "CURRENCY" },
    { headline: "Brent crude oil prices fall below $75 per barrel on China demand worries", expected: "COMMODITY" },
    { headline: "Jio Prime subscription at ₹300 — What is on offer and how it differs from Bharti Airtel", expected: "PRODUCT_LAUNCH" },
    { headline: "NTPC approves ₹21,000 crore capital expenditure for 2,400 MW thermal expansion", expected: "CAPEX" },
    { headline: "Wipro appoints Srini Pallia as Chief Executive Officer following Thierry Delaporte resignation", expected: "MANAGEMENT_CHANGE" },
    { headline: "Promoters pledge 5% additional shares of Vedanta with security trustee", expected: "PROMOTER_ACTION" },
    { headline: "Delhi High Court stays arbitration award against SpiceJet in Kalanithi Maran dispute", expected: "LEGAL_ACTION" },
    { headline: "Random unclassified community general update news article", expected: "OTHER" }
  ];

  testCases.forEach(({ headline, expected }, index) => {
    it(`Test ${index + 1}: Correctly classifies ${expected} for "${headline.substring(0, 45)}..."`, () => {
      const detected = EventTypeDetector.detect(headline, "");
      expect(detected).toBe(expected);
    });
  });

  it('26. Prefers specific event over generic OTHER across all fixtures', () => {
    let genericOtherCount = 0;
    for (const art of articles) {
      const detected = EventTypeDetector.detect(art.headline, art.content);
      if (detected === 'OTHER' && art.categoryKey !== 'CASE_A_PRODUCT') {
        genericOtherCount++;
      }
    }
    expect(genericOtherCount).toBeLessThanOrEqual(2);
  });

});
