import { CompanyMasterDatabase, CompanyMasterRecord } from '../NewsEngine/CompanyMasterDatabase';

export interface CompanyMetadata {
  name: string;
  ticker: string;
  sector: string;
  isFnO: boolean;
  aliases: string[];
  industry?: string;
  isin?: string;
  exchange?: string;
  indices?: string[];
  marketCap?: string;
}

export interface DetectionAuditTrace {
  symbol: string;
  name: string;
  matchedAlias: string;
  matchedLocations: string[];
  confidenceScore: number;
  isFnO: boolean;
  reasonAccepted: string;
}

export interface UniversalDetectionResult {
  detectedCompanies: CompanyMetadata[];
  masterRecords: CompanyMasterRecord[];
  isFnO: boolean;
  highestConfidence: number;
  auditTraces: DetectionAuditTrace[];
  sectorImpacts: string[];
  processingTimeMs: number;
}

// Common English words that collide with 2-3 letter stock symbols
const COMMON_WORD_BLACKLIST = new Set([
  'IT', 'BE', 'AM', 'OR', 'SO', 'CAN', 'IF', 'IN', 'ME', 'NO', 'ON', 'TO', 'UP', 'US', 'HE', 'WE', 'AS', 'AT', 'BY', 'DO', 'GO', 'MY', 'AN', 'OF'
]);

export class CompanyDetector {
  private static cachedAliasPatterns: {
    record: CompanyMasterRecord;
    aliases: { text: string; clean: string; regex: RegExp; isShort: boolean }[];
  }[] | null = null;

  /**
   * Pre-warm compiled regular expressions on module initialization
   */
  public static initWarmup() {
    this.getCompiledPatterns();
  }

  public static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Strip diacritics/accents
      .replace(/&/g, ' and ')
      .replace(/\b(ltd|limited|pvt|private|plc|inc|incorporated)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static getCompiledPatterns() {
    if (this.cachedAliasPatterns) return this.cachedAliasPatterns;

    const records = CompanyMasterDatabase.getAllRecords();
    this.cachedAliasPatterns = records.map((record) => {
      const candidateTexts = new Set<string>([
        record.name,
        record.officialName || '',
        record.symbol,
        ...(record.aliases || [])
      ]);

      const aliases = Array.from(candidateTexts)
        .filter(Boolean)
        .map((raw) => {
          const clean = this.normalizeText(raw);
          const isShort = raw.length <= 3 || /^[A-Z0-9&]{2,4}$/.test(raw);
          
          let pattern: string;
          if (isShort) {
            const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pattern = `\\b${escaped}\\b`;
          } else {
            const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pattern = `\\b${escaped}\\b`;
          }

          return {
            text: raw,
            clean,
            regex: new RegExp(pattern, isShort && COMMON_WORD_BLACKLIST.has(raw.toUpperCase()) ? 'g' : 'gi'),
            isShort
          };
        });

      return { record, aliases };
    });

    return this.cachedAliasPatterns;
  }

  public static detectUniversal(input: {
    headline?: string;
    title?: string;
    subheadline?: string;
    description?: string;
    summary?: string;
    articleBody?: string;
    content?: string;
    keywords?: string[];
    metadata?: any;
    filingTitle?: string;
  }): UniversalDetectionResult {
    const startTime = performance.now();

    const headline = input.headline || input.title || '';
    const subheadline = input.subheadline || input.description || '';
    const summary = input.summary || '';
    const articleBody = input.articleBody || input.content || '';
    const filingTitle = input.filingTitle || '';
    const keywordsStr = (input.keywords || []).join(' ');
    const metadataStr = typeof input.metadata === 'string' ? input.metadata : JSON.stringify(input.metadata || {});

    const normHeadline = this.normalizeText(headline);
    const normSubheadline = this.normalizeText(subheadline);
    const normSummary = this.normalizeText(summary);
    const normBody = this.normalizeText(articleBody);
    const normFiling = this.normalizeText(filingTitle);
    const normKeywords = this.normalizeText(keywordsStr);
    const normMetadata = this.normalizeText(metadataStr);

    const fullRawText = `${headline} ${subheadline} ${summary} ${articleBody} ${filingTitle} ${keywordsStr} ${metadataStr}`;

    const patterns = this.getCompiledPatterns();
    const detectedRecords = new Map<string, {
      record: CompanyMasterRecord;
      score: number;
      matchedAlias: string;
      locations: Set<string>;
      reasons: string[];
    }>();

    for (const { record, aliases } of patterns) {
      let score = 0;
      let bestAlias = '';
      const locations = new Set<string>();
      const reasons: string[] = [];

      for (const aliasObj of aliases) {
        const rawAlias = aliasObj.text;
        const upperAlias = rawAlias.toUpperCase();

        if (this.matchInText(aliasObj, headline, normHeadline)) {
          score += 60;
          bestAlias = bestAlias || rawAlias;
          locations.add('headline');
          reasons.push(`Matched alias '${rawAlias}' in headline (+60)`);
        }

        if (this.matchInText(aliasObj, articleBody, normBody) || this.matchInText(aliasObj, summary, normSummary)) {
          score += 20;
          bestAlias = bestAlias || rawAlias;
          locations.add('body');
          reasons.push(`Matched alias '${rawAlias}' in body/summary (+20)`);
        }

        if (
          this.matchInText(aliasObj, subheadline, normSubheadline) ||
          this.matchInText(aliasObj, filingTitle, normFiling) ||
          this.matchInText(aliasObj, keywordsStr, normKeywords) ||
          this.matchInText(aliasObj, metadataStr, normMetadata)
        ) {
          score += 10;
          bestAlias = bestAlias || rawAlias;
          locations.add('metadata');
          reasons.push(`Matched alias '${rawAlias}' in subheadline/metadata (+10)`);
        }

        if (upperAlias === record.symbol.toUpperCase() && (headline.includes(record.symbol) || fullRawText.includes(record.symbol))) {
          score += 10;
          bestAlias = bestAlias || record.symbol;
          locations.add('ticker');
          reasons.push(`Matched symbol '${record.symbol}' (+10)`);
        }

        if (score >= 60) break;
      }

      if (score >= 60) {
        const existing = detectedRecords.get(record.symbol);
        if (!existing || existing.score < score) {
          detectedRecords.set(record.symbol, {
            record,
            score: Math.min(100, score),
            matchedAlias: bestAlias || record.symbol,
            locations,
            reasons
          });
        }
      }
    }

    // Sector Level Detection
    const sectorImpacts = this.detectSectors(fullRawText, detectedRecords);

    // Build Final Audit & Results
    const detectedCompanies: CompanyMetadata[] = [];
    const masterRecords: CompanyMasterRecord[] = [];
    const auditTraces: DetectionAuditTrace[] = [];
    let isFnO = false;
    let highestConfidence = 0;

    for (const [symbol, item] of detectedRecords.entries()) {
      const rec = item.record;
      if (rec.fo) isFnO = true;
      if (item.score > highestConfidence) highestConfidence = item.score;

      masterRecords.push(rec);
      detectedCompanies.push({
        name: rec.officialName || rec.name,
        ticker: rec.symbol,
        sector: rec.sector,
        industry: rec.industry,
        isFnO: rec.fo,
        aliases: rec.aliases,
        isin: rec.isin,
        exchange: rec.exchange || 'NSE',
        indices: rec.indices || [],
        marketCap: rec.marketCap
      });

      auditTraces.push({
        symbol: rec.symbol,
        name: rec.officialName || rec.name,
        matchedAlias: item.matchedAlias,
        matchedLocations: Array.from(item.locations),
        confidenceScore: item.score,
        isFnO: rec.fo,
        reasonAccepted: item.reasons.join('; ')
      });
    }

    const endTime = performance.now();

    return {
      detectedCompanies,
      masterRecords,
      isFnO,
      highestConfidence,
      auditTraces,
      sectorImpacts,
      processingTimeMs: Math.round((endTime - startTime) * 100) / 100
    };
  }

  private static matchInText(
    aliasObj: { text: string; clean: string; regex: RegExp; isShort: boolean },
    rawText: string,
    cleanText: string
  ): boolean {
    if (!rawText && !cleanText) return false;

    if (aliasObj.isShort && COMMON_WORD_BLACKLIST.has(aliasObj.text.toUpperCase())) {
      const match = rawText.match(aliasObj.regex);
      return !!(match && match.some(m => m === aliasObj.text.toUpperCase()));
    }

    return aliasObj.regex.test(cleanText) || aliasObj.regex.test(rawText);
  }

  private static detectSectors(
    text: string,
    detectedMap: Map<string, any>
  ): string[] {
    const lower = text.toLowerCase();
    const sectors: string[] = [];

    const sectorRules: { keywords: string[]; sectorName: string; keySymbols: string[] }[] = [
      {
        keywords: ['it sector', 'it stocks', 'tech stocks', 'software sector', 'nifty it'],
        sectorName: 'Information Technology',
        keySymbols: ['INFY', 'TCS', 'HCLTECH', 'TECHM', 'WIPRO']
      },
      {
        keywords: ['banking sector', 'bank nifty', 'private banks', 'psu banks', 'bank stocks'],
        sectorName: 'Financial Services',
        keySymbols: ['HDFCBANK', 'ICICIBANK', 'AXISBANK', 'KOTAKBANK', 'SBIN']
      },
      {
        keywords: ['defence sector', 'defence stocks', 'defence ministry', 'defense ministry', 'defence equipment', 'defence acquisition'],
        sectorName: 'Defence',
        keySymbols: ['BEL', 'HAL', 'BDL', 'MAZDOCK', 'COCHINSHIP', 'DATAPATTNS']
      },
      {
        keywords: ['auto sector', 'automobile sector', 'auto stocks', 'nifty auto'],
        sectorName: 'Automobile',
        keySymbols: ['TATAMOTORS', 'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'TVSMOTOR']
      },
      {
        keywords: ['pharma sector', 'pharmaceuticals', 'nifty pharma', 'pharma stocks'],
        sectorName: 'Healthcare',
        keySymbols: ['SUNPHARMA', 'CIPLA', 'DRREDDY', 'DIVISLAB', 'LUPIN']
      },
      {
        keywords: ['metal sector', 'metal stocks', 'nifty metal', 'steel sector'],
        sectorName: 'Metals & Mining',
        keySymbols: ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'COALINDIA', 'VEDL']
      }
    ];

    for (const rule of sectorRules) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        sectors.push(rule.sectorName);
        if (detectedMap.size === 0) {
          for (const sym of rule.keySymbols) {
            const rec = CompanyMasterDatabase.findBySymbol(sym);
            if (rec) {
              detectedMap.set(rec.symbol, {
                record: rec,
                score: 70,
                matchedAlias: rule.keywords[0],
                locations: new Set(['sector_keyword']),
                reasons: [`Sector keyword '${rule.keywords[0]}' detected`]
              });
            }
          }
        }
      }
    }

    return sectors;
  }

  public static detect(text: string): CompanyMetadata[] {
    const res = this.detectUniversal({ headline: text, description: text });
    return res.detectedCompanies;
  }

  public static isFnO(text: string, detected: CompanyMetadata[], headline: string = ''): boolean {
    if (detected.some((d) => d.isFnO)) return true;
    const res = this.detectUniversal({ headline, articleBody: text });
    return res.isFnO;
  }
}

// Warm up compiled patterns on module load
CompanyDetector.initWarmup();
