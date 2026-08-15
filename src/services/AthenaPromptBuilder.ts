import { VerifiedFactCard, ExtractedEntities, StructuredContent } from "../types";

export class AthenaPromptBuilder {
  /**
   * Converts news structured content into an institutional prompt for Athena.
   */
  public static buildNewsPrompt(
    event: any,
    structured: StructuredContent,
    factCards: VerifiedFactCard[],
    entities: ExtractedEntities
  ): string {
    const structuredData = {
      metadata: {
        headline: event.canonicalHeadline,
        publisher: event.sources?.[0]?.name || "Official Distribution",
        category: event.category || "Corporate Action",
        companies: entities.companies || [],
        ticker: event.symbol || (entities.tickers && entities.tickers.join(', ')) || 'N/A',
        sector: entities.sector || 'Financial Markets'
      },
      structuredMetrics: (factCards || []).map(c => ({
        metric: c.label,
        value: c.value,
        growth: c.growth || undefined,
        context: c.context || undefined
      })),
      extractedEntities: {
        regulatoryAgencies: entities.governmentAgencies || [],
        commoditiesAndIndices: [...(entities.commodities || []), ...(entities.indices || [])],
        currenciesAndFinancialMetrics: [...(entities.currencies || []), ...(entities.financialMetrics || [])]
      },
      structuredFactualContent: {
        financialResults: structured.financialResults || [],
        corporateActions: structured.corporateActions || [],
        managementGuidance: structured.managementGuidance || [],
        regulatoryItems: structured.regulatoryItems || [],
        marketImpact: structured.marketImpact || [],
        capacityExpansion: structured.capacityExpansion || [],
        futurePlans: structured.futurePlans || [],
        risks: structured.risks || []
      }
    };

    return `SYSTEM
You are Athena.
You are an institutional financial research analyst.
Below is structured information extracted from a verified news article or exchange filing.
The JSON below is CONTEXT ONLY.
Never repeat JSON.
Never expose JSON.
Never echo field names.

Generate a clean JSON response containing exactly these fields (values must be pure natural language):
1. executiveSummary (Max 120 words synthesizing core institutional takeaways)
2. whyItMatters (Clear explanation of why investors should care)
3. sectorImpact (Broader sector, peer, supply chain, and demand impact)
4. companiesAffected (Array of objects with "symbol" and "impact" fields. Format impact as "Bullish / Bearish / Neutral - short description")
5. institutionalView (Focus on Mutual Funds, FIIs, DIIs, positioning, and capital allocation)
6. keyRisks (Array of crisp risk bullet points)
7. investorWatchlist (Array of key items to watch/monitor)

Ground every statement ONLY in the supplied data. Never invent information.

Structured Data:
${JSON.stringify(structuredData, null, 2)}
`;
  }

  /**
   * Converts structured exchange filing data into an institutional prompt for Athena.
   */
  public static buildFilingPrompt(
    filing: any // StructuredExchangeFiling
  ): string {
    const structuredData = {
      metadata: filing.metadata,
      financialMetrics: filing.financialMetrics || [],
      corporateActions: filing.corporateActions || [],
      boardApprovals: filing.boardApprovals || [],
      fundRaise: filing.fundRaise || [],
      dividend: filing.dividend || [],
      merger: filing.merger || [],
      acquisition: filing.acquisition || [],
      capacityExpansion: filing.capacityExpansion || [],
      managementGuidance: filing.managementGuidance || [],
      timeline: filing.timeline || [],
      regulatoryItems: filing.regulatoryItems || [],
      investorActions: filing.investorActions || [],
      riskFactors: filing.riskFactors || []
    };

    return `SYSTEM
You are Athena.
You are an institutional financial research analyst.
Below is structured information extracted from a verified news article or exchange filing.
The JSON below is CONTEXT ONLY.
Never repeat JSON.
Never expose JSON.
Never echo field names.

Generate a clean JSON response containing exactly these fields (values must be pure natural language):
1. executiveSummary (Max 120 words synthesizing core institutional takeaways)
2. whyItMatters (Clear explanation of why investors should care)
3. sectorImpact (Broader sector, peer, supply chain, and demand impact)
4. companiesAffected (Array of objects with "symbol" and "impact" fields. Format impact as "Bullish / Bearish / Neutral - short description")
5. institutionalView (Focus on Mutual Funds, FIIs, DIIs, positioning, and capital allocation)
6. keyRisks (Array of crisp risk bullet points)
7. investorWatchlist (Array of key items to watch/monitor)

Ground every statement ONLY in the supplied data. Never invent information.

Structured Data:
${JSON.stringify(structuredData, null, 2)}
`;
  }
}
