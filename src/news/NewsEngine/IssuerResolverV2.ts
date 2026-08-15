import { StructuredDocument } from './DocumentLayoutEngine';
import { CompanyMasterDatabase, CompanyMasterRecord } from './CompanyMasterDatabase';

export interface IssuerResolutionResult {
  issuerName: string;
  confidence: number; // 0 to 100
  method: string;
  record?: CompanyMasterRecord;
}

export class IssuerResolverV2 {
  private static readonly HUMAN_NAME_PATTERNS = [
    /^(mr\.|mrs\.|ms\.|dr\.|prof\.|shri\.|smt\.)/i,
    /\b(company secretary|compliance officer|managing director|chief financial officer|director|cfo|ceo|whole\s*time\s*director|authorised\s*signatory|authorized\s*signatory|signatory)\b/i,
    /^(sd\/-|sd\/|\[sd\/-\]|yours\s+(faithfully|sincerely)|regards)/i
  ];

  private static readonly EXCHANGE_ADDRESS_PATTERNS = [
    /\b(bse\s+limited|national\s+stock\s+exchange|nse\s+limited|sebi|stock\s+exchange|exchange\s+plaza|dalal\s+street|bandra\s+kurla\s+complex|phiroze\s+jeejeebhoy|mumbai\s*-\s*400001|mumbai\s*-\s*400051)\b/i
  ];

  private static isHumanNameOrTitle(text: string): boolean {
    if (!text || text.trim().length < 3) return true;
    const clean = text.trim();
    if (this.HUMAN_NAME_PATTERNS.some(p => p.test(clean))) return true;
    // Check word count and corporate suffixes: human names rarely contain Limited, Corp, Bank, etc.
    const hasCorpSuffix = /\b(limited|ltd|corporation|corp|bank|industries|technologies|enterprises|pvt|private)\b/i.test(clean);
    if (!hasCorpSuffix) {
      // Check if it looks like a 2-3 word human name without company suffixes
      const words = clean.split(/\s+/);
      if (words.length >= 1 && words.length <= 4 && !/\d/.test(clean)) {
        // If it starts with common first name or has no corporate markers
        if (/^(for|to|from|by|dear)\b/i.test(clean)) return true;
      }
    }
    return false;
  }

  private static isExchangeOrAddress(text: string): boolean {
    if (!text) return false;
    return this.EXCHANGE_ADDRESS_PATTERNS.some(p => p.test(text.trim()));
  }

  public static resolveIssuer(
    doc: StructuredDocument,
    metadata?: {
      symbol?: string;
      scripCode?: string;
      isin?: string;
      cin?: string;
      url?: string;
      headline?: string;
    }
  ): IssuerResolutionResult {
    // Priority 1: Official Company Logo / Logo Text
    if (doc.regions.logoText) {
      const match = CompanyMasterDatabase.findByNameOrAlias(doc.regions.logoText);
      if (match) {
        return { issuerName: match.name, confidence: 99, method: 'LOGO_MATCH', record: match };
      }
    }

    // Priority 2: Letterhead
    if (doc.regions.letterhead) {
      const lines = doc.regions.letterhead.split('\n');
      for (const line of lines) {
        if (this.isExchangeOrAddress(line) || this.isHumanNameOrTitle(line)) continue;
        const match = CompanyMasterDatabase.findByNameOrAlias(line);
        if (match) {
          return { issuerName: match.name, confidence: 99, method: 'LETTERHEAD_MASTER_MATCH', record: match };
        }
        // Direct company suffix check in letterhead line
        if (/\b(limited|ltd|corporation|corp|bank|industries|technologies|enterprises)\b/i.test(line)) {
          const cleanName = line.replace(/^(for|from|welcome\s+to|header|letterhead)\s+/i, '').trim();
          if (cleanName.length > 5 && !this.isHumanNameOrTitle(cleanName) && !this.isExchangeOrAddress(cleanName)) {
            return { issuerName: cleanName, confidence: 98, method: 'LETTERHEAD_DIRECT' };
          }
        }
      }
    }

    // Priority 3: Corporate Website
    const urlText = metadata?.url || doc.fullText;
    const websiteMatch = urlText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:com|co\.in|in|org|net))/i);
    if (websiteMatch && websiteMatch[1]) {
      const domain = websiteMatch[1].toLowerCase();
      if (!domain.includes('bseindia') && !domain.includes('nseindia') && !domain.includes('google') && !domain.includes('sec')) {
        const match = CompanyMasterDatabase.findByDomain(domain);
        if (match) {
          return { issuerName: match.name, confidence: 98, method: 'CORPORATE_WEBSITE', record: match };
        }
      }
    }

    // Priority 4: Email Domain
    const emailMatch = doc.fullText.match(/\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
    if (emailMatch && emailMatch[1]) {
      const emailDom = emailMatch[1].toLowerCase();
      if (!emailDom.includes('bseindia') && !emailDom.includes('nseindia') && !emailDom.includes('gmail') && !emailDom.includes('yahoo')) {
        const match = CompanyMasterDatabase.findByDomain(emailDom);
        if (match) {
          return { issuerName: match.name, confidence: 97, method: 'EMAIL_DOMAIN', record: match };
        }
      }
    }

    // Priority 5: CIN (Corporate Identity Number)
    const cinMatch = metadata?.cin || doc.fullText.match(/\b([LU]\d{5}[A-Z]{2}\d{4}(?:PLC|PTC|GOI|SGC|NPL)\d{6})\b/i)?.[1];
    if (cinMatch) {
      const match = CompanyMasterDatabase.findByCin(cinMatch);
      if (match) {
        return { issuerName: match.name, confidence: 99, method: 'CIN_LOOKUP', record: match };
      }
    }

    // Priority 6: ISIN
    const isinMatch = metadata?.isin || doc.fullText.match(/\b(INE[A-Z0-9]{9}\d)\b/i)?.[1];
    if (isinMatch) {
      const match = CompanyMasterDatabase.findByIsin(isinMatch);
      if (match) {
        return { issuerName: match.name, confidence: 99, method: 'ISIN_LOOKUP', record: match };
      }
    }

    // Priority 7: NSE Symbol
    const nseMatch = metadata?.symbol || doc.fullText.match(/\b(NSE|SYMBOL|SCRIP)\s*:\s*([A-Z0-9&-]+)\b/i)?.[2];
    if (nseMatch) {
      const match = CompanyMasterDatabase.findBySymbol(nseMatch);
      if (match) {
        return { issuerName: match.name, confidence: 98, method: 'NSE_SYMBOL', record: match };
      }
    }

    // Priority 8: BSE Scrip Code
    const bseMatch = metadata?.scripCode || doc.fullText.match(/\b(BSE|SCRIP\s*CODE)\s*:\s*(\d{6})\b/i)?.[2];
    if (bseMatch) {
      const match = CompanyMasterDatabase.findByScripCode(bseMatch);
      if (match) {
        return { issuerName: match.name, confidence: 98, method: 'BSE_SCRIP', record: match };
      }
    }

    // Priority 9: Known Company Database in Full Text / Header
    const textHeader = (doc.regions.header + '\n' + doc.regions.body.substring(0, 500));
    const dbMatch = CompanyMasterDatabase.findByNameOrAlias(textHeader);
    if (dbMatch) {
      return { issuerName: dbMatch.name, confidence: 96, method: 'COMPANY_MASTER_TEXT_SEARCH', record: dbMatch };
    }

    // Priority 10: Title / Document Title
    if (doc.regions.title) {
      const match = CompanyMasterDatabase.findByNameOrAlias(doc.regions.title);
      if (match) {
        return { issuerName: match.name, confidence: 95, method: 'TITLE_MATCH', record: match };
      }
      if (/\b(limited|ltd|corporation|corp|bank)\b/i.test(doc.regions.title) && !this.isHumanNameOrTitle(doc.regions.title) && !this.isExchangeOrAddress(doc.regions.title)) {
        return { issuerName: doc.regions.title.trim(), confidence: 95, method: 'TITLE_DIRECT' };
      }
    }

    // Check header text for explicit Company Name
    const headerLines = doc.regions.header.split('\n');
    for (const line of headerLines) {
      if (this.isExchangeOrAddress(line) || this.isHumanNameOrTitle(line)) continue;
      if (/\b(limited|ltd|corporation|corp|bank|industries|technologies|enterprises)\b/i.test(line)) {
        const clean = line.replace(/^(for|from|header)\s+/i, '').trim();
        if (clean.length > 5 && !this.isHumanNameOrTitle(clean) && !this.isExchangeOrAddress(clean)) {
          return { issuerName: clean, confidence: 95, method: 'HEADER_DIRECT' };
        }
      }
    }

    // Confidence Gate: <95% returns UNKNOWN ISSUER
    return { issuerName: 'UNKNOWN ISSUER', confidence: 0, method: 'UNRESOLVED' };
  }
}
