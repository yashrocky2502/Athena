/**
 * ATHENA NEWS ENGINE V3 — PARSER REGISTRY
 *
 * Central registry and router for Phase 6 Institutional Grade Financial Parsers.
 * Purely deterministic routing based on Phase 5 Classification outcomes.
 */

import { BaseFinancialParser } from './BaseFinancialParser';
import { QuarterlyResultsParser } from './QuarterlyResultsParser';
import { BrokerReportParser } from './BrokerReportParser';
import { CorporateActionParser } from './CorporateActionParser';
import { DividendParser } from './DividendParser';
import { BuybackParser } from './BuybackParser';
import { BonusSplitParser } from './BonusSplitParser';
import { ManagementChangeParser } from './ManagementChangeParser';
import { OrderWinParser } from './OrderWinParser';
import { MergersAcquisitionParser } from './MergersAcquisitionParser';
import { IPOParser } from './IPOParser';
import { BlockDealParser } from './BlockDealParser';
import { BulkDealParser } from './BulkDealParser';
import { FundRaiseParser } from './FundRaiseParser';
import { RBIParser } from './RBIParser';
import { SEBIParser } from './SEBIParser';
import { MacroParser } from './MacroParser';
import { CommodityParser } from './CommodityParser';
import { ForexParser } from './ForexParser';
import { GeneralParser } from './GeneralParser';
import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import { ClassificationResult } from '../classification/types/ClassificationTypes';
import { StructuredExtraction } from './types/ParserTypes';

export class ParserRegistry {
  private static instance: ParserRegistry;
  private parsers: Map<string, BaseFinancialParser> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ParserRegistry {
    if (!ParserRegistry.instance) {
      ParserRegistry.instance = new ParserRegistry();
    }
    return ParserRegistry.instance;
  }

  private registerDefaults(): void {
    this.registerParser(new QuarterlyResultsParser());
    this.registerParser(new BrokerReportParser());
    this.registerParser(new CorporateActionParser());
    this.registerParser(new DividendParser());
    this.registerParser(new BuybackParser());
    this.registerParser(new BonusSplitParser());
    this.registerParser(new ManagementChangeParser());
    this.registerParser(new OrderWinParser());
    this.registerParser(new MergersAcquisitionParser());
    this.registerParser(new IPOParser());
    this.registerParser(new BlockDealParser());
    this.registerParser(new BulkDealParser());
    this.registerParser(new FundRaiseParser());
    this.registerParser(new RBIParser());
    this.registerParser(new SEBIParser());
    this.registerParser(new MacroParser());
    this.registerParser(new CommodityParser());
    this.registerParser(new ForexParser());
    this.registerParser(new GeneralParser());
  }

  public registerParser(parser: BaseFinancialParser): void {
    this.parsers.set(parser.parserType, parser);
  }

  public getParser(parserType: string): BaseFinancialParser {
    return this.parsers.get(parserType) || this.parsers.get('GeneralParser')!;
  }

  /**
   * Routes a document to the appropriate parser based on classification
   */
  public async parseDocument(
    doc: NormalizedDocument,
    classification?: ClassificationResult
  ): Promise<StructuredExtraction> {
    const targetParserName = classification?.targetParser?.parserName || 'GeneralParser';
    
    // Map classification route names to parserType names
    let mappedParserType: string = targetParserName;
    if (targetParserName === 'BrokerParser') mappedParserType = 'BrokerReportParser';

    const parser = this.getParser(mappedParserType);
    return await parser.parse(doc, classification);
  }
}
