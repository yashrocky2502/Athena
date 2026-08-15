import { CompanyKnowledge, AiAnalysis } from "../../types";
import { YahooFinanceProvider } from "../YahooFinanceProvider";
import { GoogleGenAI } from "@google/genai";
import { getStories } from "../../lib/storyEngine";
import { ProfilerService } from "../ProfilerService";
import { TruthfulnessAuditEngine } from "./TruthfulnessAuditEngine";
import { IntelligenceRepository } from "../intelligence/IntelligenceRepository";
import { SupabaseRepository } from "../intelligence/SupabaseRepository";
import crypto from "crypto";
import { ConsensusEngine } from "./ConsensusEngine";

import { CompanyIdentityResolver } from "../../lib/CompanyIdentityResolver";

interface CacheEntry {
  knowledge: CompanyKnowledge;
  timestamp: number;
  marketOpenState: boolean;
}

/**
 * Calculates current market status for Indian Stock Exchanges (NSE/BSE).
 * Returns status, description, and open state in Asia/Kolkata timezone.
 */
export function getIndianMarketStatus(): { status: string; isOpen: boolean; description: string } {
  const kolkataTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = kolkataTime.getDay(); // 0 = Sun, 6 = Sat
  const hours = kolkataTime.getHours();
  const minutes = kolkataTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  if (day === 0 || day === 6) {
    return { status: "Weekend", isOpen: false, description: "Market Closed (Weekend)" };
  }

  // Pre-open: 9:00 AM to 9:15 AM IST (540 to 555 minutes)
  if (timeInMinutes >= 540 && timeInMinutes < 555) {
    return { status: "Pre Open", isOpen: false, description: "Exchange in Pre-Open session" };
  }

  // Normal Trading: 9:15 AM to 3:30 PM IST (555 to 930 minutes)
  if (timeInMinutes >= 555 && timeInMinutes < 930) {
    return { status: "Market Open", isOpen: true, description: "Exchange Trading Session Live" };
  }

  // Post-market: 3:30 PM to 4:00 PM IST (930 to 960 minutes)
  if (timeInMinutes >= 930 && timeInMinutes < 960) {
    return { status: "Post Market", isOpen: false, description: "Exchange in Post-Market session" };
  }

  return { status: "Market Closed", isOpen: false, description: "Market Closed (After Hours)" };
}

export class CompanyKnowledgeBuilder {
  private static instance: CompanyKnowledgeBuilder;
  private ai: GoogleGenAI | null = null;
  private repository: IntelligenceRepository;
  
  private readonly CACHE_TTL_OPEN = 60 * 1000;      // 1 minute refresh when market is open
  private readonly CACHE_TTL_CLOSED = 15 * 60 * 1000; // 15 minutes refresh when market is closed

  private constructor() {
    this.repository = new SupabaseRepository();
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY") {
      this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }

  public static getInstance(): CompanyKnowledgeBuilder {
    if (!CompanyKnowledgeBuilder.instance) {
      CompanyKnowledgeBuilder.instance = new CompanyKnowledgeBuilder();
    }
    return CompanyKnowledgeBuilder.instance;
  }

  public async build(query: string): Promise<CompanyKnowledge> {
    const totalStart = Date.now();
    const breakdown: Record<string, number> = {};
    const yahoo = new YahooFinanceProvider();
    let symbol = query.toUpperCase().trim();
    let resolvedSymbol = symbol;
    let resolvedName = query;
    let resolutionMethod = "Direct Symbol";

    // PHASE 1: CANONICAL COMPANY RESOLUTION
    const resolutionStart = Date.now();
    const identityResolver = CompanyIdentityResolver.getInstance();
    const canonical = identityResolver.resolve(query);

    if (canonical && canonical.officialName) {
      resolvedSymbol = canonical.canonicalSymbol;
      resolvedName = canonical.officialName;
      resolutionMethod = "Canonical Identity Engine (CompanyIdentityResolver)";
      console.log(`[CompanyResolution] Canonical identity matched: "${query}" -> ${resolvedSymbol} (${resolvedName})`);
    } else if (!symbol.includes(".") || query.includes(" ")) {
      console.log(`[CompanyResolution] Attempting to resolve ambiguous query via Yahoo search: "${query}"`);
      const searchResults = await yahoo.searchSymbols(query);
      
      if (searchResults && searchResults.length > 0) {
        const bestMatch = searchResults[0];
        resolvedSymbol = bestMatch.symbol;
        resolvedName = bestMatch.name;
        resolutionMethod = `Search Resolve (Confidence: High)`;
        console.log(`[CompanyResolution] Resolved "${query}" to ${resolvedSymbol} (${resolvedName})`);
      } else {
        if (query.includes(" ")) {
          throw new Error(`Company Resolution Failed: Could not resolve "${query}" to a verified NSE/BSE listing. Rejecting ambiguous match.`);
        }
      }
    }
    const resolutionLatency = Date.now() - resolutionStart;
    breakdown["Company Resolver"] = resolutionLatency;
    ProfilerService.getInstance().record("Company Resolver", resolutionLatency);

    const currentMarket = getIndianMarketStatus();
    const cacheKey = resolvedSymbol.toUpperCase();
    
    // Check Cache with custom invalidation criteria
    const cached = await this.repository.get(cacheKey);
    if (cached) {
      console.log(`[Cache Read] Found cached intelligence for symbol: ${resolvedSymbol}`);
      const age = Date.now() - cached.timestamp;
      const ttl = currentMarket.isOpen ? this.CACHE_TTL_OPEN : this.CACHE_TTL_CLOSED;
      
      const isTtlValid = age < ttl;
      // Invalidate if cached during closed market hours, but market is currently open
      const marketStateChanged = !cached.marketOpenState && currentMarket.isOpen;
      // Invalidate if cached object has legacy/outdated corporate metadata
      const identityMismatch = cached.knowledge.name !== canonical.officialName || cached.knowledge.symbol !== canonical.canonicalSymbol;
      
      if (isTtlValid && !marketStateChanged && !identityMismatch) {
        console.log(`[Cache Hit] Serving cached company intelligence for: ${symbol}`);
        
        // Update cache status to indicate cached serve in diagnostics
        const updatedKnowledge = {
          ...cached.knowledge,
          name: canonical.officialName,
          symbol: canonical.canonicalSymbol,
          diagnostics: cached.knowledge.diagnostics ? {
            ...cached.knowledge.diagnostics,
            cacheStatus: "HIT (Cached Output)",
            lastRefreshTime: new Date(cached.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
            latencyBreakdown: { "Cache Lookup": Date.now() - totalStart }
          } : undefined
        };
        return updatedKnowledge;
      } else {
        console.log(`[Cache Invalidation] Invalidation triggered for: ${symbol}. (Reason: ${identityMismatch ? 'Canonical Identity/Corporate Action Update' : !isTtlValid ? 'TTL Expired' : 'Market Opened'})`);
      }
    }

    console.log(`[Cache Miss] Fetching live financial details for: ${resolvedSymbol}`);
    
    let details: any = null;
    let fetchError: string | null = null;
    const apiStartTime = Date.now();
    
    try {
      details = await yahoo.getCompanyDetails(resolvedSymbol);
      const yahooLatency = Date.now() - apiStartTime;
      breakdown["Yahoo Finance"] = yahooLatency;
      ProfilerService.getInstance().record("Yahoo Finance", yahooLatency);
    } catch (e: any) {
      fetchError = e.message || "Failed to query live Yahoo Finance provider.";
      console.error(`[YahooFinanceProvider] Failed for ${resolvedSymbol}:`, fetchError);
    }

    if (!details) {
      throw new Error(`Failed to resolve company data for symbol ${resolvedSymbol}. Provider output is unavailable.`);
    }

    // Isolate & Filter timeline events strictly matching this company canonical ID
    const allStories = getStories();
    
    // Group and merge stories by deterministic Event ID
    const mergedStories = allStories
      .filter(story => {
        if (!story || !story.company || !details || !details.name) return false;
        const q = (resolvedSymbol.split('.')[0] || "").toLowerCase();
        const sName = story.company.toLowerCase();
        const detailsName = details.name.toLowerCase();
        
        // Match by symbol prefix or exact name
        return sName === q || sName === detailsName ||
               (sName.includes(q) && q.length > 3) || 
               (detailsName.includes(sName) && sName.length > 5);
      })
      .reduce((acc, story) => {
        const eventId = this.generateEventId(story.event, story.company, "General", story.timestamp);
        if (!acc[eventId]) {
          acc[eventId] = {
            ...story,
            id: eventId,
            sources: [...story.sources]
          };
        } else {
          // Merge sources
          const newSources = story.sources.filter(s => !acc[eventId].sources.some(existing => existing.uri === s.uri));
          acc[eventId].sources.push(...newSources);
          
          // Update confidence (weighted average or simply max)
          acc[eventId].confidence = Math.max(acc[eventId].confidence, story.confidence);
        }
        return acc;
      }, {} as Record<string, any>);

    const isolatedTimeline = Object.values(mergedStories).map(story => ({
        id: story.id,
        company: story.company,
        event: story.event,
        status: story.status,
        confidence: story.confidence,
        timestamp: story.timestamp
    }));

    // AI Analysis status & Strategic inputs
    let aiAnalysis: AiAnalysis = { status: "available" };
    let aiSummary = {
      facts: [
        `${details.name} is classified under the ${details.sector} sector within the ${details.industry} industry.`,
        `The stock is currently trading at ₹${details.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })} on the ${details.exchange} exchange.`,
        `The company maintains a total live market capitalization of ${details.marketCap}.`,
        `52-week trading bounds are recorded between ₹${details.fiftyTwoWeekLow} (low) and ₹${details.fiftyTwoWeekHigh} (high).`
      ],
      interpretation: `${details.name} presents standard operations inside the ${details.industry} industry. Investment sentiment is currently ${details.changePercent >= 0 ? "positive" : "consolidating"} based on current price changes.`
    };

    let generatedStory = `**Company Overview:** ${details.name} operates in the ${details.sector} sector.\n**Market Cap:** ${details.marketCap} | **Current Price:** ₹${details.price} (${details.changePercent >= 0 ? "+" : ""}${details.changePercent}%)\n**Trend:** ${details.changePercent >= 0 ? "Bullish momentum" : "Bearish pressure"} observed today.\n**Recent Events:** Live exchange telemetry active.\n**Key Factors:** Watch for ${details.industry} sector movements.\n**Risks:** Volatility in prevailing market conditions.`;
    let generatedRisks = [{ title: "Unavailable", desc: "No specific risks found in live provider feed." }];
    let generatedOpportunities = ["Catalysts Unavailable"];
    let storyStatus: "Strengthening" | "Stable" | "Weakening" | "Uncertain" = details.changePercent > 1.5 ? "Strengthening" : details.changePercent < -1.5 ? "Weakening" : "Stable";
    let storyConfidence = 85;

    // Decoupled AI Layer: Automatic synthesis on page load is disabled to optimize Gemini API usage.
    // Opening a company page now triggers zero Gemini API calls. Reports are generated on-demand.
    aiAnalysis = { status: "unavailable", reason: "AI insights available via premium report. Click 'Generate Intelligence' below." };
    console.log(`[CompanyKnowledgeBuilder] Decoupled AI mode: skipping automatic load-time Gemini synthesis for: ${resolvedSymbol}`);

    const lastUpdatedString = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    }) + " IST";

    const totalDuration = Date.now() - totalStart;
    breakdown["Total Request Duration"] = totalDuration;

    // Build diagnostics payload
    const diagnostics = {
      sourceUsed: "Yahoo Finance (Primary)",
      symbolResolved: resolvedSymbol,
      canonicalId: `CAN-${resolvedSymbol.replace('.', '-')}`,
      resolutionMethod,
      exchange: details.exchange,
      sectorSource: details.sector !== "Unknown" ? "Yahoo AssetProfile" : "Unavailable",
      lastRefreshTime: lastUpdatedString,
      cacheStatus: "MISS (Live Resolution)",
      apiResponseTimestamp: new Date(apiStartTime).toISOString(),
      latencyBreakdown: breakdown
    };

    // Live Financial Statements via Multi-Source Consensus Layer (Athena Data Verification Engine)
    let liveFinancials: any = null;
    let consensus: any = null;
    try {
      const consensusEngine = ConsensusEngine.getInstance();
      consensus = await consensusEngine.forceRefresh(resolvedSymbol);

      const isIndian = resolvedSymbol.toUpperCase().includes(".NS") || resolvedSymbol.toUpperCase().includes(".BO");

      const formatValue = (val: number | undefined | null, isCurrency: boolean = true): string => {
        if (val === undefined || val === null || isNaN(val)) {
          return "Data unavailable";
        }
        if (isCurrency) {
          if (isIndian) {
            if (Math.abs(val) >= 10000000) {
              const crVal = val / 10000000;
              return `₹${crVal.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
            } else {
              return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
            }
          } else {
            const absVal = Math.abs(val);
            if (absVal >= 1000000000) {
              return `$${(val / 1000000000).toLocaleString("en-US", { maximumFractionDigits: 2 })} B`;
            } else if (absVal >= 1000000) {
              return `$${(val / 1000000).toLocaleString("en-US", { maximumFractionDigits: 2 })} M`;
            } else {
              return `$${val.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
            }
          }
        } else {
          return `${val.toFixed(1)}%`;
        }
      };

      const formatPercent = (val: number | null): string => {
        if (val === null || val === undefined) return "Data unavailable";
        return `${val.toFixed(1)}%`;
      };

      liveFinancials = {
        revenue: formatValue(consensus.metrics.revenue.value),
        ebitda: formatValue(consensus.metrics.ebitda.value),
        netProfit: formatValue(consensus.metrics.netProfit.value),
        operatingMargin: formatPercent(consensus.metrics.operatingMargin.value),
        cashFlow: formatValue(consensus.metrics.cashFlow.value),
        balanceSheet: {
          totalAssets: formatValue(consensus.metrics.balanceSheet.value?.totalAssets),
          equityShareCapital: formatValue(consensus.metrics.balanceSheet.value?.equityShareCapital),
          totalLiabilities: formatValue(consensus.metrics.balanceSheet.value?.totalLiabilities),
          reservesAndSurplus: formatValue(consensus.metrics.balanceSheet.value?.reservesAndSurplus)
        },
        quarterlyResults: (consensus.metrics.quarterlyResults.value || []).map((r: any) => ({
          quarter: r.quarter,
          revenue: formatValue(r.revenue),
          profit: formatValue(r.profit),
          margin: r.margin !== null ? `${r.margin.toFixed(1)}%` : "Data unavailable"
        })),
        annualResults: (consensus.metrics.annualResults.value || []).map((r: any) => ({
          year: r.year,
          revenue: formatValue(r.revenue),
          profit: formatValue(r.profit),
          margin: r.margin !== null ? `${r.margin.toFixed(1)}%` : "Data unavailable"
        }))
      };
    } catch (err: any) {
      console.warn("[CompanyKnowledgeBuilder] Live financial statement compilation failed:", err.message);
    }

    const companyKnowledge: CompanyKnowledge = {
      symbol: details.symbol,
      name: details.name,
      profile: {
        businessSummary: details.businessSummary,
        sector: details.sector,
        marketCap: details.marketCap,
        industry: details.industry,
        exchange: details.exchange
      },
      marketData: {
        price: details.price,
        change: details.change,
        changePercent: details.changePercent,
        previousClose: details.previousClose,
        regularMarketTime: details.regularMarketTime,
        marketState: details.marketState
      },
      story: {
        storyStatus,
        storyConfidence,
        currentStory: generatedStory,
        previousStory: `Historical narrative baseline for ${details.name} inside ${details.industry}.`,
        reasonForChange: `Monitored price variations on the ${details.exchange} exchange indicating a ${details.changePercent >= 0 ? "bullish momentum" : "minor pullback"}.`,
        firstSeen: "2024-01-10",
        lastUpdated: lastUpdatedString,
        storyTimeline: []
      },
      timeline: isolatedTimeline,
      risks: generatedRisks,
      opportunities: generatedOpportunities,
      aiSummary,
      aiAnalysis,
      sources: [
        { title: `${details.exchange} Official Feed`, uri: `https://finance.yahoo.com/quote/${details.symbol}.${details.exchange}` },
        { title: "Corporate Governance Reports", uri: "https://www.nseindia.com" }
      ],
      confidence: storyConfidence,
      lastUpdated: lastUpdatedString,
      financials: {
        fiftyTwoWeekHigh: details.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: details.fiftyTwoWeekLow,
        volume: details.volume,
        averageVolume: details.averageVolume,
        pe: details.pe,
        bookValue: details.bookValue,
        dividendYield: details.dividendYield,
        roe: details.roe,
        roce: details.roce,
        debtEquity: details.debtEquity,
        eps: details.eps,
        beta: details.beta,
        promoterHolding: details.promoterHolding,
        fiiHolding: details.fiiHolding,
        diiHolding: details.diiHolding,
        publicHolding: details.publicHolding
      },
      diagnostics,
      liveFinancials,
      consensusRecord: consensus
    };

    // Validate with canonical identity engine to guarantee zero legacy metadata leaks
    const validatedKnowledge = {
      ...companyKnowledge,
      name: canonical.officialName,
      officialName: canonical.officialName,
      symbol: canonical.canonicalSymbol,
      canonicalSymbol: canonical.canonicalSymbol,
      profile: {
        ...companyKnowledge.profile,
        officialName: canonical.officialName,
        symbol: canonical.canonicalSymbol,
        sector: canonical.sector || companyKnowledge.profile?.sector,
        industry: canonical.industry || companyKnowledge.profile?.industry,
        businessSummary: canonical.description || companyKnowledge.profile?.businessSummary
      }
    };

    // Save resolved factual data to cache to keep response times sub-millisecond
    console.log(`[Cache Write] Saving resolved intelligence for symbol: ${resolvedSymbol}`);
    await this.repository.set(cacheKey, {
      knowledge: validatedKnowledge,
      timestamp: Date.now(),
      marketOpenState: currentMarket.isOpen
    });

    return validatedKnowledge;
  }

  private generateEventId(headline: string, company: string, category: string, timestamp: string): string {
    const normalizedHeadline = headline.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const normalizedCompany = company.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const normalizedCategory = category.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const data = `${normalizedHeadline}-${normalizedCompany}-${normalizedCategory}-${timestamp}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private validateAndCorrectIntelligence(parsedJson: any, details: any, indices: any[]): { isValid: boolean; reason: string } {
    const textFields = [
      parsedJson.currentStory || "",
      parsedJson.interpretation || "",
      ...(parsedJson.facts || []),
      ...(parsedJson.opportunities || [])
    ];

    const fullText = textFields.join(" \n ");

    // 1. Fabricated targets / upside predictions check
    // Reject: "Target 25200", "+4% upside expected", etc.
    const targetRegex = /target\s*(?:of\s*)?(?:₹|Rs\.?)?\s*([0-9,.]+)|upside\s*(?:of\s*)?(?:₹|Rs\.?)?\s*([0-9,.]+)|upside\s*(?:of\s*)?([-+]?[0-9.]+)\s*%|\+?\s*([0-9.]+)\s*%\s*upside/gi;
    if (targetRegex.test(fullText)) {
      return {
        isValid: false,
        reason: "Fabricated analyst price target or upside percentage found in generated commentary."
      };
    }

    // 2. Price verification
    // Match any monetary figures: ₹1,620 or Rs. 1620
    const priceRegex = /(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]+)?)/gi;
    let match;
    priceRegex.lastIndex = 0;
    while ((match = priceRegex.exec(fullText)) !== null) {
      const numStr = match[1].replace(/,/g, "");
      const val = parseFloat(numStr);
      if (isNaN(val)) continue;

      // Harmless numbers like low digits
      if (val < 10) continue; 

      // Check if it matches any verified company metric
      const isCloseToPrice = Math.abs(val - details.price) / details.price < 0.02;
      const isCloseToPrevClose = Math.abs(val - details.previousClose) / details.previousClose < 0.02;
      const isCloseToHigh = Math.abs(val - details.fiftyTwoWeekHigh) / details.fiftyTwoWeekHigh < 0.02;
      const isCloseToLow = Math.abs(val - details.fiftyTwoWeekLow) / details.fiftyTwoWeekLow < 0.02;
      const isCloseToAnyIndex = indices.some(idx => Math.abs(val - idx.price) / idx.price < 0.02);

      if (!isCloseToPrice && !isCloseToPrevClose && !isCloseToHigh && !isCloseToLow && !isCloseToAnyIndex) {
        return {
          isValid: false,
          reason: `Unverified price value mentioned: ₹${val}. Sourced values do not match standard boundaries (Current: ₹${details.price}, 52W High: ₹${details.fiftyTwoWeekHigh}).`
        };
      }
    }

    // 3. Percent change and holding verification
    const percentRegex = /([-+]?[0-9]+(?:\.[0-9]+)?)\s*%/g;
    percentRegex.lastIndex = 0;
    while ((match = percentRegex.exec(fullText)) !== null) {
      const val = parseFloat(match[1]);
      if (isNaN(val)) continue;

      // Allow harmless percentages
      if (val === 100 || val === 0 || val === 50 || val === 52) continue;

      const isCloseToChange = Math.abs(val - details.changePercent) < 0.25;
      const isCloseToAnyIndexChange = indices.some(idx => Math.abs(val - idx.changePercent) < 0.25);
      const isHolding = [
        details.promoterHolding,
        details.fiiHolding,
        details.diiHolding,
        details.publicHolding,
        details.roe,
        details.roce,
        details.dividendYield
      ].some(h => h !== undefined && Math.abs(val - h) < 0.5);

      if (!isCloseToChange && !isCloseToAnyIndexChange && !isHolding) {
        return {
          isValid: false,
          reason: `Unverified percentage mentioned: ${val}%. Does not match daily change (${details.changePercent}%) or known corporate fundamentals.`
        };
      }
    }

    return { isValid: true, reason: "" };
  }
}
