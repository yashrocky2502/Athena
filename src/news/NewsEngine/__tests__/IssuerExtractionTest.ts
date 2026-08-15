import { FilingIntelligenceEngine } from '../FilingIntelligenceEngine';

// Automated Test Suite for CQ4.3 TRUE ISSUER EXTRACTION

interface TestCase {
  id: string;
  exchange: 'NSE' | 'BSE';
  headline: string;
  body: string;
  expectedIssuer: string;
  expectedAnnouncementType: string;
}

const nseFilings: TestCase[] = [
  {
    id: 'NSE-1',
    exchange: 'NSE',
    headline: 'Zen Technologies Limited - Outcome of Board Meeting',
    body: `
To,
Listing Department,
National Stock Exchange of India Limited,
Exchange Plaza, Bandra Kurla Complex,
Bandra (E), Mumbai - 400051

Ref: Symbol: ZENTEC / Scrip Code: 533333 / ISIN: INE251B01027
CIN: L72200TG1993PLC015401

Dear Sir/Madam,

For and on behalf of Zen Technologies Limited,
We wish to inform you that the Board of Directors at its meeting held today has approved un-audited financial results for Q3 FY26.
Revenue from operations stood at ₹150.5 Crore and PAT was ₹35.2 Crore.

Yours faithfully,
For Zen Technologies Limited
Mr. Satish Kumar
Company Secretary & Compliance Officer
    `,
    expectedIssuer: 'Zen Technologies Limited',
    expectedAnnouncementType: 'Outcome of Board Meeting'
  },
  {
    id: 'NSE-2',
    exchange: 'NSE',
    headline: 'Larsen & Toubro Limited bagged mega order worth ₹2,500 Crore',
    body: `
To,
National Stock Exchange of India Limited
Exchange Plaza, C-1, Block G, Bandra Kurla Complex
Mumbai - 400051

Ref: Symbol: LT / Scrip Code: 500510

Press Release:
Larsen & Toubro Limited construction arm bagged a significant order worth ₹2,500 Crore from Ministry of Defence for supply of advanced radar systems.

For Larsen & Toubro Limited,
Dr. C.P. Gurnani
Managing Director
    `,
    expectedIssuer: 'Larsen & Toubro Limited',
    expectedAnnouncementType: 'Order Win'
  },
  {
    id: 'NSE-3',
    exchange: 'NSE',
    headline: 'Tata Consultancy Services Limited - Trading Window Closure Intimation',
    body: `
To,
Listing Department
National Stock Exchange of India Limited
Bandra Kurla Complex, Mumbai

CIN: L72200MH1995PLC084781
ISIN: INE467B01029

Intimation regarding Closure of Trading Window:
This is to inform that the Trading Window for dealing in equity shares of Tata Consultancy Services Limited shall remain closed from July 1, 2026 till 48 hours after declaration of financial results.

For Tata Consultancy Services Limited
Mr. Rajesh Gopinathan
Compliance Officer
    `,
    expectedIssuer: 'Tata Consultancy Services Limited',
    expectedAnnouncementType: 'Trading Window Closure'
  },
  {
    id: 'NSE-4',
    exchange: 'NSE',
    headline: 'Reliance Industries Limited - Dividend Declaration',
    body: `
National Stock Exchange of India Limited
Exchange Plaza, Mumbai

Symbol: RELIANCE / ISIN: INE002A01018

Sub: Recommendation of Final Dividend of ₹10 per share for FY26.

For Reliance Industries Limited,
Registered Office: Maker Chambers IV, 222 Nariman Point, Mumbai 400021
    `,
    expectedIssuer: 'Reliance Industries Limited',
    expectedAnnouncementType: 'Dividend'
  },
  {
    id: 'NSE-5',
    exchange: 'NSE',
    headline: 'Infosys Limited - Credit Rating Reaffirmation',
    body: `
To,
National Stock Exchange
Exchange Plaza, Bandra (E)

Symbol: INFY

CRISIL Ratings has reaffirmed AAA rating for credit facilities of Infosys Limited.

For Infosys Limited
www.infosys.com
secretarial@infosys.com
    `,
    expectedIssuer: 'Infosys Limited',
    expectedAnnouncementType: 'Credit Rating'
  },
  {
    id: 'NSE-6',
    exchange: 'NSE',
    headline: 'State Bank of India - Investor Presentation Q2 FY26',
    body: `
To,
NSE Listing Department, Exchange Plaza, Mumbai.

Symbol: SBIN

State Bank of India submits herewith the Investor Presentation for Q2 FY26 financial results.
    `,
    expectedIssuer: 'State Bank of India',
    expectedAnnouncementType: 'Investor Presentation'
  },
  {
    id: 'NSE-7',
    exchange: 'NSE',
    headline: 'Bharti Airtel Limited - Resignation of Director',
    body: `
National Stock Exchange of India Ltd

Symbol: BHARTIARTL

Bharti Airtel Limited hereby intimates the resignation of Mr. Sunil Bharti Mittal as Non-Executive Director with effect from August 15, 2026.
    `,
    expectedIssuer: 'Bharti Airtel Limited',
    expectedAnnouncementType: 'Resignation'
  },
  {
    id: 'NSE-8',
    exchange: 'NSE',
    headline: 'HDFC Bank Limited - Shareholding Pattern for Q1 FY26',
    body: `
NSE Exchange Plaza, Mumbai
Symbol: HDFCBANK

HDFC Bank Limited submits the Shareholding Pattern for the quarter ended June 30, 2026 pursuant to Regulation 31 of SEBI LODR.
    `,
    expectedIssuer: 'HDFC Bank Limited',
    expectedAnnouncementType: 'Shareholding Pattern'
  },
  {
    id: 'NSE-9',
    exchange: 'NSE',
    headline: 'Bharat Electronics Limited - Bagged order worth ₹850 Crore from Indian Navy',
    body: `
To,
Exchange Plaza, NSE, Mumbai

Symbol: BEL

Bharat Electronics Limited has secured a fresh defense export order worth ₹850 Crore from Indian Navy for naval sonar systems.
    `,
    expectedIssuer: 'Bharat Electronics Limited',
    expectedAnnouncementType: 'Order Win'
  },
  {
    id: 'NSE-10',
    exchange: 'NSE',
    headline: 'Hindustan Aeronautics Limited - Appointment of KMP',
    body: `
National Stock Exchange of India Limited

Symbol: HAL / ISIN: INE066F01012

Hindustan Aeronautics Limited intimates the appointment of Ms. Priya Sharma as Chief Financial Officer.
    `,
    expectedIssuer: 'Hindustan Aeronautics Limited',
    expectedAnnouncementType: 'Appointment'
  }
];

// Generate 40 additional NSE test cases dynamically
for (let i = 11; i <= 50; i++) {
  const isin = `INE${1000 + i}B010${i % 10}`;
  const cin = `L72200MH20${i % 20 + 10}PLC${100000 + i}`;
  nseFilings.push({
    id: `NSE-${i}`,
    exchange: 'NSE',
    headline: `Company_${i} Limited - Un-audited Financial Results Q${(i % 4) + 1} FY26`,
    body: `
To,
Exchange Plaza, Bandra Kurla Complex, Mumbai
National Stock Exchange of India Limited

Symbol: SYM_${i} / ISIN: ${isin} / CIN: ${cin}

Sub: Outcome of Board Meeting - Financial Results.

For and on behalf of Company_${i} Limited,
Company_${i} Limited reported Revenue from operations of ₹${(i * 12.5).toFixed(1)} Crore and Net Profit of ₹${(i * 2.1).toFixed(1)} Crore for Q${(i % 4) + 1} FY26.

For Company_${i} Limited
Mr. Director Name
    `,
    expectedIssuer: `Company_${i} Limited`,
    expectedAnnouncementType: (i % 2 === 0) ? 'Quarterly Results' : 'Outcome of Board Meeting'
  });
}

const bseFilings: TestCase[] = [
  {
    id: 'BSE-1',
    exchange: 'BSE',
    headline: 'Scrip Code: 500510 - Larsen & Toubro Limited - Conference Call Transcript',
    body: `
To,
Corporate Relationship Department,
BSE Limited,
Phiroze Jeejeebhoy Towers, Dalal Street, Mumbai - 400001

Scrip Code: 500510

Dear Sir,

Larsen & Toubro Limited submits audio recording and transcript of earnings conference call held on July 20, 2026.

For Larsen & Toubro Limited,
Link Intime Registrar
    `,
    expectedIssuer: 'Larsen & Toubro Limited',
    expectedAnnouncementType: 'Conference Call'
  },
  {
    id: 'BSE-2',
    exchange: 'BSE',
    headline: '533333 - Zen Technologies Limited - Acquisition of 51% stake',
    body: `
BSE Limited, Dalal Street, Mumbai

Scrip Code: 533333

Sub: Intimation under Regulation 30 - Acquisition of 51% stake in Alpha Robotics Pvt Ltd.

For Zen Technologies Limited
CIN: L72200TG1993PLC015401
www.zentechnologies.com
    `,
    expectedIssuer: 'Zen Technologies Limited',
    expectedAnnouncementType: 'Acquisition'
  },
  {
    id: 'BSE-3',
    exchange: 'BSE',
    headline: 'BSE Scrip: 500325 - Reliance Industries Limited - Rights Issue Details',
    body: `
To,
Department of Corporate Services,
BSE Limited, Mumbai

Scrip Code: 500325

Reliance Industries Limited announced Rights Issue of ₹10,000 Crore at ratio 1:15.

For Reliance Industries Limited
Registered Office: Nariman Point, Mumbai
    `,
    expectedIssuer: 'Reliance Industries Limited',
    expectedAnnouncementType: 'Rights Issue'
  },
  {
    id: 'BSE-4',
    exchange: 'BSE',
    headline: '500180 - HDFC Bank Limited - ESOP Share Allotment',
    body: `
BSE Limited, Phiroze Jeejeebhoy Towers

Scrip Code: 500180

HDFC Bank Limited has allotted 50,000 equity shares under ESOP Stock Option Scheme.

For HDFC Bank Limited
    `,
    expectedIssuer: 'HDFC Bank Limited',
    expectedAnnouncementType: 'ESOP'
  },
  {
    id: 'BSE-5',
    exchange: 'BSE',
    headline: '532540 - Tata Consultancy Services Limited - Bonus Issue 1:1',
    body: `
To, BSE Limited, Dalal Street, Mumbai.

Scrip Code: 532540

Tata Consultancy Services Limited board recommended Bonus Issue of 1:1 equity shares.
    `,
    expectedIssuer: 'Tata Consultancy Services Limited',
    expectedAnnouncementType: 'Bonus Issue'
  }
];

// Generate 45 additional BSE test cases dynamically
for (let i = 6; i <= 50; i++) {
  const scrip = 500000 + i;
  const isin = `INE${2000 + i}C010${i % 10}`;
  bseFilings.push({
    id: `BSE-${i}`,
    exchange: 'BSE',
    headline: `BSE Scrip Code: ${scrip} - Enterprise_${i} Corporation - Corporate Intimation`,
    body: `
To,
BSE Limited, Phiroze Jeejeebhoy Towers, Dalal Street, Mumbai - 400001
Scrip Code: ${scrip} / ISIN: ${isin}

Enterprise_${i} Corporation has submitted compliance certificate under Regulation 7(3) of SEBI LODR.

For Enterprise_${i} Corporation,
Registered Office: Plot ${i}, Industrial Area, Mumbai
    `,
    expectedIssuer: `Enterprise_${i} Corporation`,
    expectedAnnouncementType: 'Compliance Certificate'
  });
}

export function runIssuerExtractionTestSuite() {
  const engine = FilingIntelligenceEngine.getInstance();
  const allTests = [...nseFilings, ...bseFilings];

  let correctIssuerCount = 0;
  let correctAnnouncementCount = 0;
  let totalTests = allTests.length;
  let reviewList: Array<{ id: string; issuer: string; type: string; confidence: number; reason: string }> = [];

  console.log(`\n=== ATHENA NEWS V4 — AUTOMATED TEST SUITE (CQ4.3 TRUE ISSUER EXTRACTION) ===\n`);
  console.log(`Running against ${nseFilings.length} NSE Filings and ${bseFilings.length} BSE Filings (Total: ${totalTests})\n`);

  for (const test of allTests) {
    const articleContent = {
      headline: test.headline,
      title: test.headline,
      body: test.body,
      cleanText: test.body,
      publisher: test.exchange === 'NSE' ? 'National Stock Exchange' : 'BSE Limited',
      url: `https://${test.exchange.toLowerCase()}india.com/filing/${test.id}`
    };

    const facts = engine.extractFilingFacts(articleContent);
    const summary = engine.processFilingSync(articleContent);
    const intelligence = summary.intelligence;

    const detectedIssuer = facts.companyName;
    const detectedType = facts.announcementType;
    const confidence = intelligence.eventDetection.confidence;

    // Checks
    const isIssuerCorrect = detectedIssuer.toLowerCase().trim() === test.expectedIssuer.toLowerCase().trim() ||
      detectedIssuer.toLowerCase().includes(test.expectedIssuer.toLowerCase()) ||
      test.expectedIssuer.toLowerCase().includes(detectedIssuer.toLowerCase());

    const isTypeCorrect = detectedType.toLowerCase().trim() === test.expectedAnnouncementType.toLowerCase().trim() ||
      (test.expectedAnnouncementType === 'Outcome of Board Meeting' && detectedType === 'Quarterly Results');

    if (isIssuerCorrect) correctIssuerCount++;
    if (isTypeCorrect) correctAnnouncementCount++;

    // Check Blacklist violation
    const blacklistedTerms = ['national stock exchange', 'bse limited', 'exchange plaza', 'corporate services', 'listing department', 'sebi', 'mca', 'kfintech', 'link intime', 'company secretary', 'compliance officer', 'managing director', 'director', 'person', 'unknown', 'issuer'];
    const hasBlacklistViolation = blacklistedTerms.some(b => detectedIssuer.toLowerCase() === b || detectedIssuer.toLowerCase().includes(b));

    if (hasBlacklistViolation || confidence < 90 || !isIssuerCorrect) {
      reviewList.push({
        id: test.id,
        issuer: detectedIssuer,
        type: detectedType,
        confidence,
        reason: hasBlacklistViolation ? 'Blacklist Violation' : (!isIssuerCorrect ? 'Issuer Mismatch' : 'Low Confidence')
      });
    }

    console.log(`[${test.id}] Issuer: "${detectedIssuer}" | Type: "${detectedType}" | Confidence: ${confidence}% | Result: ${isIssuerCorrect ? 'PASS' : 'FAIL'}`);
  }

  const issuerAccuracy = ((correctIssuerCount / totalTests) * 100).toFixed(2);
  const announcementAccuracy = ((correctAnnouncementCount / totalTests) * 100).toFixed(2);

  console.log(`\n================ FINAL TEST RESULTS ================`);
  console.log(`Total Test Filings: ${totalTests}`);
  console.log(`Issuer Extraction Accuracy: ${issuerAccuracy}% (Target >= 99%)`);
  console.log(`Announcement Type Accuracy: ${announcementAccuracy}% (Target >= 98%)`);
  console.log(`Stored for Review (Confidence < 90% or Mismatch): ${reviewList.length} filings`);

  if (reviewList.length > 0) {
    console.log(`\nFilings Stored For Review:`, JSON.stringify(reviewList, null, 2));
  }

  return {
    totalTests,
    issuerAccuracy: Number(issuerAccuracy),
    announcementAccuracy: Number(announcementAccuracy),
    reviewList
  };
}

runIssuerExtractionTestSuite();
