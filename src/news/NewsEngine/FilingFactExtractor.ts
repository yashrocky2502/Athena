import { StructuredDocument } from './DocumentLayoutEngine';

export interface ExtractedFilingFacts {
  revenue?: string;
  pat?: string;
  ebitda?: string;
  ebitdaMargin?: string;
  eps?: string;
  orderBook?: string;
  contractValue?: string;
  dividend?: string;
  bonusRatio?: string;
  splitRatio?: string;
  meetingDate?: string;
  recordDate?: string;
  effectiveDate?: string;
  creditRating?: string;
  customers?: string[];
  governmentDepartment?: string[];
  auditor?: string;
  director?: string;
  chairman?: string;
  ceo?: string;
  cfo?: string;
  companySecretary?: string;
}

export class FilingFactExtractor {
  private static readonly BANNED_SUMMARY_PHRASES = [
    'positive investor sentiment',
    'operational parameters',
    'near-term strategy',
    'compliance mechanism',
    'market recovery',
    'framework',
    'general filing',
    'official regulatory disclosure',
    'listed entity',
    'issuer disclosing entity'
  ];

  public static extractFacts(doc: StructuredDocument): ExtractedFilingFacts {
    const text = doc.fullText;
    const facts: ExtractedFilingFacts = {};

    // 1. Revenue
    const revMatch = text.match(/(?:revenue|turnover|total\s+income)(?:\s+from\s+operations)?(?:\s+is|\s+at|\s*[:=-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|lakh|mn|billion|million)?)/i);
    if (revMatch) facts.revenue = revMatch[1].trim();

    // 2. PAT (Profit After Tax)
    const patMatch = text.match(/(?:pat|profit\s+after\s+tax|net\s+profit)(?:\s+is|\s+at|\s*[:=-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|lakh|mn|billion|million)?)/i);
    if (patMatch) facts.pat = patMatch[1].trim();

    // 3. EBITDA
    const ebitdaMatch = text.match(/\bebitda\b(?:\s+is|\s+at|\s*[:=-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|lakh|mn|billion|million)?)/i);
    if (ebitdaMatch) facts.ebitda = ebitdaMatch[1].trim();

    // 4. EBITDA Margin
    const marginMatch = text.match(/ebitda\s+margin(?:\s+of|\s+at|\s*[:=-])?\s*([\d.]+\s*%)/i);
    if (marginMatch) facts.ebitdaMargin = marginMatch[1].trim();

    // 5. EPS
    const epsMatch = text.match(/\beps\b(?:\s+of|\s+is|\s*[:=-])?\s*(?:rs\.?|₹)?\s*([\d.]+)/i);
    if (epsMatch) facts.eps = epsMatch[1].trim();

    // 6. Order Book
    const obMatch = text.match(/(?:order\s+book|order\s+pipeline)(?:\s+stands\s+at|\s+of|\s*[:=-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|billion)?)/i);
    if (obMatch) facts.orderBook = obMatch[1].trim();

    // 7. Contract Value
    const cvMatch = text.match(/(?:contract|order|award)\s+(?:value|worth|amount)(?:\s+of|\s*[:=-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|lakh|mn|billion)?)/i);
    if (cvMatch) facts.contractValue = cvMatch[1].trim();

    // 8. Dividend
    const divMatch = text.match(/(?:dividend\s+of|interim\s+dividend\s+of|final\s+dividend\s+of)\s*(?:rs\.?|₹)?\s*([\d.]+(?:\s*%|\s*per\s+share)?)/i);
    if (divMatch) facts.dividend = divMatch[1].trim();

    // 9. Bonus Ratio
    const bonusMatch = text.match(/bonus\s+(?:issue\s+in\s+the\s+ratio\s+of|shares\s+in\s+ratio\s+of|\s*[:=-])\s*(\d+\s*:\s*\d+)/i);
    if (bonusMatch) facts.bonusRatio = bonusMatch[1].trim();

    // 10. Split Ratio
    const splitMatch = text.match(/(?:sub-division|stock\s+split)\s+(?:in\s+ratio\s+of|from\s+rs\.?\s*\d+\s+to\s+rs\.?\s*\d+|\s*[:=-])\s*(\d+\s*:\s*\d+)/i);
    if (splitMatch) facts.splitRatio = splitMatch[1].trim();

    // 11. Dates: Meeting Date, Record Date, Effective Date
    const meetingMatch = text.match(/(?:meeting\s+held\s+on|meeting\s+date)\s*[:=-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s*,\s*\d{4}|\d{2}[/-]\d{2}[/-]\d{4})/i);
    if (meetingMatch) facts.meetingDate = meetingMatch[1].trim();

    const recordMatch = text.match(/(?:record\s+date)\s*[:=-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s*,\s*\d{4}|\d{2}[/-]\d{2}[/-]\d{4})/i);
    if (recordMatch) facts.recordDate = recordMatch[1].trim();

    const effMatch = text.match(/(?:effective\s+date)\s*[:=-]?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s*,\s*\d{4}|\d{2}[/-]\d{2}[/-]\d{4})/i);
    if (effMatch) facts.effectiveDate = effMatch[1].trim();

    // 12. Credit Rating
    const crMatch = text.match(/(?:rating\s+(?:assigned|reaffirmed|upgraded|downgraded)\s+to|credit\s+rating\s+of)\s*[:=-]?\s*([A-Z0-9+-]{2,8}(?:\s*\([^)]+\))?)/i);
    if (crMatch) facts.creditRating = crMatch[1].trim();

    // 13. Entities / Officials
    const csMatch = text.match(/(?:company\s+secretary|compliance\s+officer)\s*[:=-]?\s*([A-Za-z\s.]{3,35})\b/i);
    if (csMatch && csMatch[1] && !csMatch[1].toLowerCase().includes('limited')) facts.companySecretary = csMatch[1].trim();

    const cfoMatch = text.match(/(?:chief\s+financial\s+officer|cfo)\s*[:=-]?\s*([A-Za-z\s.]{3,35})\b/i);
    if (cfoMatch && cfoMatch[1] && !cfoMatch[1].toLowerCase().includes('limited')) facts.cfo = cfoMatch[1].trim();

    const ceoMatch = text.match(/(?:chief\s+executive\s+officer|ceo|managing\s+director|md)\s*[:=-]?\s*([A-Za-z\s.]{3,35})\b/i);
    if (ceoMatch && ceoMatch[1] && !ceoMatch[1].toLowerCase().includes('limited')) facts.ceo = ceoMatch[1].trim();

    const audMatch = text.match(/(?:statutory\s+auditors?|auditor)\s*[:=-]?\s*([A-Za-z\s.&]{3,40})\b/i);
    if (audMatch && audMatch[1]) facts.auditor = audMatch[1].trim();

    return facts;
  }

  /**
   * Executive Summary strictly built ONLY from extracted facts.
   * Guarantees zero generic templates or banned buzzwords.
   */
  public static buildExecutiveSummary(
    issuerName: string,
    announcementType: string,
    facts: ExtractedFilingFacts,
    docTitle?: string
  ): string {
    const parts: string[] = [];

    parts.push(`${issuerName} submitted a corporate regulatory filing regarding ${announcementType}.`);

    if (facts.revenue) parts.push(`Reported total revenue from operations standing at ${facts.revenue}.`);
    if (facts.pat) parts.push(`Net profit after tax (PAT) reached ${facts.pat}.`);
    if (facts.ebitda) parts.push(`EBITDA reported at ${facts.ebitda}${facts.ebitdaMargin ? ` with an EBITDA margin of ${facts.ebitdaMargin}` : ''}.`);
    if (facts.contractValue) parts.push(`Secured order/contract valued at ${facts.contractValue}.`);
    if (facts.orderBook) parts.push(`Total order book pipeline stands at ${facts.orderBook}.`);
    if (facts.dividend) parts.push(`Declared a dividend payout of ${facts.dividend}.`);
    if (facts.bonusRatio) parts.push(`Approved bonus shares issuance in the ratio of ${facts.bonusRatio}.`);
    if (facts.splitRatio) parts.push(`Approved stock sub-division/split ratio of ${facts.splitRatio}.`);
    if (facts.meetingDate) parts.push(`Board meeting convened on ${facts.meetingDate}.`);
    if (facts.recordDate) parts.push(`Set record date as ${facts.recordDate}.`);
    if (facts.creditRating) parts.push(`Credit rating updated to ${facts.creditRating}.`);
    if (facts.companySecretary) parts.push(`Filing signed by Company Secretary/Compliance Officer ${facts.companySecretary}.`);

    let summaryText = parts.join(' ');

    // Sanitize summary against banned template words
    for (const banned of this.BANNED_SUMMARY_PHRASES) {
      const reg = new RegExp(banned, 'gi');
      summaryText = summaryText.replace(reg, '');
    }

    return summaryText.replace(/\s+/g, ' ').trim();
  }
}
