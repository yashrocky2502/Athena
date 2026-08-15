/**
 * ATHENA NEWS ENGINE V3 — ROUTING ENGINE
 * 
 * Deterministically routes classified financial documents to specialized domain parsers.
 * Guarantees that no parser ever receives an incompatible story category.
 */

import { ClassificationCategory, ParserRoute } from './types/ClassificationTypes';

export class RoutingEngine {
  /**
   * Determines the optimal parser route for a primary category and secondary categories.
   */
  public static determineRoute(primaryCategory: ClassificationCategory): ParserRoute {
    switch (primaryCategory) {
      case 'QUARTERLY_RESULTS':
      case 'RESULT_PREVIEW':
      case 'RESULT_REACTION':
      case 'GUIDANCE':
        return {
          parserName: 'QuarterlyResultsParser',
          priority: 1,
          handlerName: 'parseQuarterlyFinancials'
        };

      case 'BROKER_REPORT':
        return {
          parserName: 'BrokerParser',
          priority: 1,
          handlerName: 'parseBrokerRecommendation'
        };

      case 'DIVIDEND':
        return {
          parserName: 'DividendParser',
          priority: 1,
          handlerName: 'parseDividendDeclaration'
        };

      case 'CORPORATE_ACTION':
      case 'BONUS':
      case 'SPLIT':
      case 'BUYBACK':
      case 'MERGER':
      case 'ACQUISITION':
      case 'QIP':
      case 'RIGHTS_ISSUE':
      case 'BLOCK_DEAL':
      case 'BULK_DEAL':
      case 'PROMOTER_ACTION':
      case 'BOARD_MEETING':
      case 'CAPEX':
        return {
          parserName: 'CorporateActionParser',
          priority: 1,
          handlerName: 'parseCorporateEvent'
        };

      case 'MANAGEMENT_CHANGE':
      case 'CEO_CHANGE':
      case 'CFO_CHANGE':
      case 'RESIGNATION':
        return {
          parserName: 'ManagementChangeParser',
          priority: 1,
          handlerName: 'parseExecutiveChange'
        };

      case 'IPO':
        return {
          parserName: 'IPOParser',
          priority: 1,
          handlerName: 'parseIPODetails'
        };

      case 'ORDER_WIN':
      case 'ORDER_LOSS':
        return {
          parserName: 'OrderWinParser',
          priority: 1,
          handlerName: 'parseOrderWinLoss'
        };

      case 'SEBI_ACTION':
        return {
          parserName: 'SEBIParser',
          priority: 1,
          handlerName: 'parseSEBIOrder'
        };

      case 'RBI_POLICY':
        return {
          parserName: 'RBIParser',
          priority: 1,
          handlerName: 'parseRBIPolicy'
        };

      case 'COMMODITY':
      case 'CRYPTO':
        return {
          parserName: 'CommodityParser',
          priority: 2,
          handlerName: 'parseCommodityPrices'
        };

      case 'FOREX':
        return {
          parserName: 'ForexParser',
          priority: 2,
          handlerName: 'parseCurrencyMovements'
        };

      case 'MACRO':
      case 'GDP':
      case 'CPI':
      case 'WPI':
      case 'IIP':
      case 'TRADE':
      case 'GLOBAL_MARKETS':
      case 'DOMESTIC_MARKETS':
        return {
          parserName: 'MacroParser',
          priority: 2,
          handlerName: 'parseMacroIndicators'
        };

      case 'GENERAL_MARKET':
      case 'UNKNOWN':
      default:
        return {
          parserName: 'GeneralParser',
          priority: 3,
          handlerName: 'parseGeneralNews'
        };
    }
  }
}
