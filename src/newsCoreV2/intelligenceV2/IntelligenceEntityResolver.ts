import { NewsArticleV2 } from "../domain/NewsArticle.ts";
import { FNO_UNIVERSE, findFNOEntityInHeadline } from "../fno/FNOUniverse.ts";
import { EntityConfidence, EntityType } from "./IntelligenceTypes.ts";

export interface ResolvedEntity {
  companyName: string;
  symbol: string | null;
  entityType: EntityType;
  entityConfidence: EntityConfidence;
  fnoEligible: boolean;
  fnoConfidence: EntityConfidence;
  reason: string;
}

const COMMODITY_REGEX = /\b(crude oil|brent|wti|oil prices?|oil falls|oil rises|gold prices?|silver|copper|natural gas|bullion|base metals|oil drops|oil surges)\b/i;
const MACRO_REGEX = /\b(gdp|inflation|cpi|wpi|us fed|federal reserve|fomc|interest rates?|repo rate|forex(?: reserves?)?|rupee\b|dollar index|dxy|usd\/inr|trade deficit|fiscal deficit|macroeconomic|rbi intervention|rbi action)\b/i;
const POLICY_REGEX = /\b(sebi circular|rbi monetary policy|rbi norm|gst council|cabinet approves|union budget|finance ministry|fmcg policy|tariff policy)\b/i;
const SECTOR_REGEX = /\b(it sector|auto sales overview|banking sector|pharma stocks|metal index|realty sector|defense sector|psu bank index)\b/i;
const BROAD_MARKET_REGEX = /\b(sensex|d-street|market closes?|market opens?|dalal street|stock markets?|stock market today|indices|equities rally|market wrap|morning bell|closing bell|global markets|asian markets|wall street)\b/i;
const EARNINGS_CALENDAR_REGEX = /\b(earnings calendar|bse calendar|nse calendar|companies to report results|companies to announce|firms to announce|board meetings today|earnings preview)\b/i;

// Words indicating macro oil rather than Indian Oil Corporation (IOC)
const GENERIC_OIL_CONTEXT = /\b(demand|imports?|exports?|consumption|refiners?|prices?|slump|rally|output|opec)\b/i;

export class IntelligenceEntityResolver {
  public static resolve(article: NewsArticleV2): ResolvedEntity {
    const headline = (article.headline || "").trim();

    // 1. Authoritative News Core V2 F&O classification takes absolute precedence if valid
    if (article.fno && article.fno.eligible && article.fno.decision === "INCLUDE" && article.fno.symbol) {
      const fnoSymbol = article.fno.symbol.toUpperCase();
      
      // Index Underlyings
      if (fnoSymbol === "BANKNIFTY") {
        return {
          companyName: "Bank Nifty",
          symbol: "BANKNIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Authoritative News Core V2 Index: BANKNIFTY"
        };
      }
      if (fnoSymbol === "NIFTY") {
        return {
          companyName: "Nifty 50",
          symbol: "NIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Authoritative News Core V2 Index: NIFTY"
        };
      }
      if (fnoSymbol === "FINNIFTY") {
        return {
          companyName: "Nifty Financial Services",
          symbol: "FINNIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Authoritative News Core V2 Index: FINNIFTY"
        };
      }
      if (fnoSymbol === "MIDCPNIFTY") {
        return {
          companyName: "Nifty Midcap Select",
          symbol: "MIDCPNIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Authoritative News Core V2 Index: MIDCPNIFTY"
        };
      }

      // Equity Underlying
      const fnoCompany = FNO_UNIVERSE.find(c => c.symbol === fnoSymbol);
      const companyName = fnoCompany ? fnoCompany.name : fnoSymbol;

      return {
        companyName,
        symbol: fnoSymbol,
        entityType: "EQUITY",
        entityConfidence: "HIGH",
        fnoEligible: true,
        fnoConfidence: "HIGH",
        reason: `Authoritative News Core V2 F&O Entity: ${fnoSymbol}`
      };
    }

    // 2. Check Generic Earnings Calendar FIRST (e.g. "BSE earnings calendar" is calendar, not BSE stock)
    if (EARNINGS_CALENDAR_REGEX.test(headline)) {
      return {
        companyName: "Earnings Calendar",
        symbol: null,
        entityType: "BROAD_MARKET",
        entityConfidence: "MEDIUM",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Generic earnings calendar announcement"
      };
    }

    // 3. Strict Headline Entity Resolution
    const headlineMatch = findFNOEntityInHeadline(headline);
    if (headlineMatch) {
      const sym = headlineMatch.company.symbol.toUpperCase();

      // Special Check for IOC: ensure "Indian oil imports/demand" doesn't falsely match IOC
      if (sym === "IOC") {
        const isGenericOil = GENERIC_OIL_CONTEXT.test(headline) && !/\b(corp|corporation|q[1-4]|pat|profit|dividend|shares?|results?)\b/i.test(headline);
        if (isGenericOil) {
          return {
            companyName: "Commodities & Energy",
            symbol: null,
            entityType: "COMMODITY",
            entityConfidence: "HIGH",
            fnoEligible: false,
            fnoConfidence: "NONE",
            reason: "Headline refers to Indian oil commodity demand/imports, not Indian Oil Corporation"
          };
        }
      }

      // Special Check for Bank Nifty vs NIFTY
      if (/\bbank\s*nifty\b/i.test(headline)) {
        return {
          companyName: "Bank Nifty",
          symbol: "BANKNIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Headline matched Bank Nifty index"
        };
      }

      if (sym === "NIFTY") {
        return {
          companyName: "Nifty 50",
          symbol: "NIFTY",
          entityType: "BROAD_MARKET",
          entityConfidence: "HIGH",
          fnoEligible: true,
          fnoConfidence: "HIGH",
          reason: "Headline matched Nifty 50 index"
        };
      }

      return {
        companyName: headlineMatch.company.name,
        symbol: sym,
        entityType: "EQUITY",
        entityConfidence: "HIGH",
        fnoEligible: true,
        fnoConfidence: "HIGH",
        reason: `Headline alias matched ${sym}`
      };
    }

    // 4. Commodity / Macro / Policy / Sector / Broad Market Categorization
    if (COMMODITY_REGEX.test(headline)) {
      let commodityName = "Commodities & Energy";
      if (/\b(crude|brent|wti|oil)\b/i.test(headline)) commodityName = "Crude Oil & Energy";
      else if (/\b(gold|silver|bullion)\b/i.test(headline)) commodityName = "Precious Metals";
      
      return {
        companyName: commodityName,
        symbol: null,
        entityType: "COMMODITY",
        entityConfidence: "HIGH",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Commodity and energy market event"
      };
    }

    if (MACRO_REGEX.test(headline)) {
      return {
        companyName: "Macroeconomy",
        symbol: null,
        entityType: "MACRO",
        entityConfidence: "HIGH",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Macroeconomic / central bank interest rate event"
      };
    }

    if (POLICY_REGEX.test(headline)) {
      return {
        companyName: "Regulatory & Policy",
        symbol: null,
        entityType: "POLICY",
        entityConfidence: "HIGH",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Government / SEBI / RBI policy announcement"
      };
    }

    if (SECTOR_REGEX.test(headline)) {
      return {
        companyName: "Sector Outlook",
        symbol: null,
        entityType: "SECTOR",
        entityConfidence: "MEDIUM",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Broad industry or sector report"
      };
    }

    if (BROAD_MARKET_REGEX.test(headline)) {
      return {
        companyName: "Broad Market",
        symbol: null,
        entityType: "BROAD_MARKET",
        entityConfidence: "HIGH",
        fnoEligible: false,
        fnoConfidence: "NONE",
        reason: "Broad market / benchmark commentary"
      };
    }

    // 5. Default Unresolved (No company invented, no body-only false F&O promotions)
    return {
      companyName: "Market General",
      symbol: null,
      entityType: "UNRESOLVED",
      entityConfidence: "NONE",
      fnoEligible: false,
      fnoConfidence: "NONE",
      reason: "No canonical entity or specific macro topic identified in headline"
    };
  }
}
