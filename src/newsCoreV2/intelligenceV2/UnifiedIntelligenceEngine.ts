import { NewsArticleV2 } from "../domain/NewsArticle.ts";
import { IntelligenceEntityResolver } from "./IntelligenceEntityResolver.ts";
import { IntelligenceMetricResolver } from "./IntelligenceMetricResolver.ts";
import { IntelligenceStore } from "./IntelligenceStore.ts";
import { IntelligenceRecord, SentimentType, UrgencyType } from "./IntelligenceTypes.ts";

export class UnifiedIntelligenceEngine {
  public static readonly VERSION = "27.3";

  /**
   * Builds or retrieves the canonical IntelligenceRecord for a News Core V2 article.
   */
  public static build(article: NewsArticleV2): IntelligenceRecord {
    if (!article || !article.id) {
      throw new Error("[UnifiedIntelligenceEngine] Cannot build intelligence for invalid article");
    }

    const store = IntelligenceStore.getInstance();
    const cached = store.get(article.id, this.VERSION);
    if (cached) {
      return cached;
    }

    const headline = (article.headline || "").trim();
    const body = (article.body || "").trim();
    const separator = headline && !/[.?!]$/.test(headline) ? ". " : " ";
    const text = `${headline}${separator}${body}`.trim();

    // 1. Entity Resolution
    const entity = IntelligenceEntityResolver.resolve(article);

    // 2. Financial Metrics Resolution
    const resolvedMetrics = IntelligenceMetricResolver.resolve(headline, body, article.keyMetrics);

    // 3. Category & Event Resolution
    const primaryCategory = article.primaryCategory || article.category || "Other";
    const eventType = article.eventType || article.category || "OTHER";

    // 4. Classification & Scoring
    const sentiment: SentimentType = (article.sentiment as SentimentType) || "NEUTRAL";
    const relevanceScore = article.relevanceScore || (entity.fnoEligible ? 85 : 70);

    let materialityScore = 60;
    if (resolvedMetrics.metrics.length > 0) materialityScore += 25;
    if (entity.fnoEligible) materialityScore += 15;
    if (/resignation|fraud|sebi|raid|ban|merger|acquisition/i.test(text)) materialityScore += 20;
    materialityScore = Math.min(100, Math.max(20, materialityScore));

    let urgency: UrgencyType = "LOW";
    if (materialityScore >= 85 || relevanceScore >= 90) urgency = "CRITICAL";
    else if (materialityScore >= 70 || relevanceScore >= 80) urgency = "HIGH";
    else if (materialityScore >= 50 || relevanceScore >= 60) urgency = "MEDIUM";

    // 5. Source-Grounded Executive Summary Construction
    const executiveSummary = this.buildExecutiveSummary(article, entity.companyName, resolvedMetrics.metrics, primaryCategory, eventType);

    // 6. Key Facts Extraction
    const keyFacts = this.extractKeyFacts(article, resolvedMetrics.metrics);

    // 7. Event-First Why It Matters (Evidence-grounded explanation)
    const whyItMatters = this.buildWhyItMatters(article, entity, resolvedMetrics.metrics, primaryCategory, eventType);

    // 8. Options Seller Impact (Strictly conservative and factual)
    const optionsSellerImpact = this.buildOptionsSellerImpact(article, entity, resolvedMetrics.metrics, primaryCategory, eventType);

    // 9. Risk Watchpoints
    const risk = this.buildRiskWatchpoints(article, resolvedMetrics.metrics);

    // 10. Event-First Market Impact
    const marketImpact = this.buildMarketImpact(article, sentiment, urgency, eventType);

    // 11. Traceability & Evidence
    const sourceEvidence = resolvedMetrics.metrics
      .map(m => m.sourceSentence)
      .filter(Boolean) as string[];

    const firstSentence = body.split(/(?<=[.?!])\s+/).find(s => s.trim().length > 15);
    const evidenceSpans = [headline];
    if (firstSentence) evidenceSpans.push(firstSentence.trim());

    const record: IntelligenceRecord = {
      articleId: article.id,
      canonicalUrl: article.canonicalUrl || article.source?.url || "",
      headline,
      source: article.source?.publisher || "Market Wire",
      publishedAt: article.publishedAt || article.collectedAt || new Date().toISOString(),

      companyName: entity.companyName,
      symbol: entity.symbol,
      entityType: entity.entityType,
      entityConfidence: entity.entityConfidence,
      fnoEligible: entity.fnoEligible,
      fnoConfidence: entity.fnoConfidence,

      category: primaryCategory,
      eventType: eventType,
      sentiment,
      materialityScore,
      relevanceScore,
      urgency,

      metricConsistencyStatus: resolvedMetrics.metricConsistencyStatus,
      financialMetrics: resolvedMetrics.metrics,
      pat: resolvedMetrics.pat,
      revenue: resolvedMetrics.revenue,
      ebitda: resolvedMetrics.ebitda,
      eps: resolvedMetrics.eps,
      nii: resolvedMetrics.nii,
      debt: resolvedMetrics.debt,
      margin: resolvedMetrics.margin,
      orderBook: resolvedMetrics.orderBook,

      executiveSummary,
      keyFacts,
      whyItMatters,
      marketImpact,
      risk,
      optionsSellerImpact,

      sourceEvidence,
      evidenceSpans,
      intelligenceVersion: this.VERSION,
      generatedAt: new Date().toISOString()
    };

    // Cache the deterministic record
    store.set(record);

    return record;
  }

  private static buildExecutiveSummary(
    article: NewsArticleV2,
    companyName: string,
    metrics: any[],
    primaryCategory: string,
    eventType: string
  ): string {
    const headline = (article.headline || "").trim();
    const body = (article.body || "").trim();
    const evUpper = (eventType || "").toUpperCase();
    const catUpper = (primaryCategory || "").toUpperCase();

    // 1. IPO Executive Summary
    if (evUpper === "IPO" || catUpper === "IPO") {
      const ipoMetric = metrics.find(m => m.name === "IPO");
      if (ipoMetric && ipoMetric.displayText) {
        const comp = companyName && companyName !== "Subject Company" ? `${companyName} ` : "";
        return `${comp}IPO details: ${ipoMetric.displayText}. ${headline}. Primary market participants are monitoring issue subscription metrics.`;
      }
      if (body) {
        const sentences = body
          .split(/(?<=[.?!])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && !s.startsWith("Image:"));
        const distinct = sentences.find(s => !s.toLowerCase().includes(headline.toLowerCase().slice(0, 30)));
        if (distinct) {
          return `${headline}. ${distinct}`;
        }
      }
      return `${headline}. Primary market participants are tracking subscription demand and grey market indications.`;
    }

    // 2. Acquisition Executive Summary
    if (evUpper === "ACQUISITION" || evUpper === "MERGER") {
      if (body) {
        const sentences = body
          .split(/(?<=[.?!])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && !s.startsWith("Image:"));
        const distinct = sentences.find(s => !s.toLowerCase().includes(headline.toLowerCase().slice(0, 30)));
        if (distinct) {
          return `${headline}. ${distinct}`;
        }
      }
      return `${headline}. The strategic corporate transaction impacts consolidated market positioning and operating synergies.`;
    }

    // 3. Earnings / Results Executive Summary (when specific earnings metrics exist)
    if ((evUpper === "EARNINGS" || catUpper === "RESULTS") && metrics.length > 0) {
      const parts: string[] = [];
      const pat = metrics.find(m => m.name === "PAT");
      const rev = metrics.find(m => m.name === "Revenue");
      const ebitda = metrics.find(m => m.name === "EBITDA");
      const vol = metrics.find(m => m.name === "Sales Volume");
      const rating = metrics.find(m => m.name === "Credit Rating");

      if (pat) {
        const sign = pat.changePercent !== null ? (pat.direction === "UP" ? "up " : pat.direction === "DOWN" ? "down " : "") + `${Math.abs(pat.changePercent)}% YoY` : "";
        const val = pat.currentValue !== null ? ` of ₹${Math.abs(pat.currentValue).toLocaleString("en-IN")} ${pat.unit || "Cr"}` : "";
        const isLoss = (pat.currentValue !== null && pat.currentValue < 0) || (pat.direction === "DOWN" && pat.sourceSentence?.toLowerCase().includes("loss"));
        const metricLabel = isLoss ? "net loss" : "net profit";
        parts.push(`${metricLabel}${val}${sign ? `, ${sign}` : ""}`);
      }

      if (rev) {
        const sign = rev.changePercent !== null ? (rev.direction === "UP" ? "increased " : "declined ") + `${Math.abs(rev.changePercent)}%` : "";
        const val = rev.currentValue !== null ? `₹${Math.abs(rev.currentValue).toLocaleString("en-IN")} ${rev.unit || "Cr"}` : "";
        parts.push(`revenue at ${val}${sign ? ` (${sign})` : ""}`);
      } else if (ebitda) {
        const val = ebitda.currentValue !== null ? `₹${Math.abs(ebitda.currentValue).toLocaleString("en-IN")} ${ebitda.unit || "Cr"}` : "";
        parts.push(`EBITDA at ${val}`);
      }

      if (vol) {
        parts.push(`sales volume of ${vol.displayText}`);
      }

      if (rating) {
        parts.push(`credit rating affirmed at ${rating.displayText}`);
      }

      if (parts.length > 0) {
        const subj = companyName && companyName !== "Subject Company" ? companyName : "The company";
        return `${subj} reported ${parts.join(", while ")}. Institutional analysts are assessing operational margin trajectory.`;
      }
    }

    // 4. Order / Contract Win Executive Summary
    if (evUpper === "ORDER_CONTRACT" || /order win|contract win|bags order|awarded order|secures order/i.test(headline)) {
      const orderMetric = metrics.find(m => m.name === "Order Book");
      const orderVal = orderMetric ? orderMetric.displayText : "";
      if (body) {
        const sentences = body
          .split(/(?<=[.?!])\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 15 && !s.startsWith("Image:"));
        const distinct = sentences.find(s => !s.toLowerCase().includes(headline.toLowerCase().slice(0, 30)));
        if (distinct) {
          return `${headline}. ${distinct}`;
        }
      }
      return `${headline}. The commercial contract addition${orderVal ? ` (${orderVal})` : ""} bolsters revenue visibility and operational backlog.`;
    }

    // 5. General fallback using headline + clean distinct body sentence
    if (body) {
      const sentences = body
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 15 && !s.startsWith("Image:") && !s.startsWith("Click here") && !s.startsWith("Subscribe"));
      
      const distinct = sentences.find(s => !s.toLowerCase().includes(headline.toLowerCase().slice(0, 30)));
      if (distinct) {
        return `${headline}. ${distinct}`;
      }
    }

    const targetSubj = companyName && companyName !== "Subject Company" && companyName !== "Market" ? companyName : "the entity";
    return `${headline}. Institutional market participants are evaluating the immediate operational and financial implications for ${targetSubj}.`;
  }

  private static extractKeyFacts(article: NewsArticleV2, metrics: any[]): string[] {
    const facts: string[] = [];

    for (const m of metrics) {
      if (m.displayText) {
        facts.push(m.displayText);
      }
    }

    const sentences = (article.body || "").split(/(?<=[.?!])\s+/);
    for (const s of sentences) {
      const clean = s.trim();
      if (clean.length > 20 && clean.length < 180) {
        if (/reported|approved|ordered|announced|received|filed|acquired|resigned|proposed|consultation|partnered|launched|subscribed|gmp|issue/i.test(clean)) {
          if (!facts.some(f => f.toLowerCase().includes(clean.toLowerCase().slice(0, 30)))) {
            facts.push(clean);
            if (facts.length >= 4) break;
          }
        }
      }
    }

    if (facts.length === 0 && article.headline) {
      facts.push(article.headline);
    }

    return facts.slice(0, 4);
  }

  private static buildWhyItMatters(
    article: NewsArticleV2,
    entity: any,
    metrics: any[],
    primaryCategory: string,
    eventType: string
  ): string {
    const headline = (article.headline || "").trim();
    const body = (article.body || "").trim();
    const lowerHeadline = headline.toLowerCase();
    const text = `${headline} ${body}`.trim();
    const lowerText = text.toLowerCase();

    const evUpper = (eventType || "").toUpperCase();
    const catUpper = (primaryCategory || "").toUpperCase();

    // 1. IPO
    if (evUpper === "IPO" || catUpper === "IPO" || /\bipo\b|grey market|gmp|price band|listing gain/i.test(lowerHeadline)) {
      const gmpMatch = lowerText.match(/\bgmp\b\s*(?:of|at|hints|at)?\s*(?:₹|rs\.?)?\s*([\d,]+)/i) ||
                       lowerText.match(/(?:grey|gray)\s+market\s+premium\s*(?:of|at|stands\s+at)?\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
      const bandMatch = lowerText.match(/price\s+band\s+(?:of\s+)?(?:₹|rs\.?)?\s*([\d,]+)\s*(?:to|-|and)\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
      const subMatch = lowerText.match(/\b([\d\.]+)\s*x\s*(?:subscribed|subscription)/i) ||
                      lowerText.match(/subscription\s+(?:of\s+)?([\d\.]+)\s*x/i) ||
                      lowerText.match(/subscribed\s+([\d\.]+)\s*x/i);

      const ipoFacts: string[] = [];
      if (subMatch) ipoFacts.push(`subscription demand of ${subMatch[1]}x`);
      if (bandMatch) ipoFacts.push(`price band of ₹${bandMatch[1]}–₹${bandMatch[2]}`);
      if (gmpMatch) ipoFacts.push(`grey market premium (GMP) of ₹${gmpMatch[1]}`);

      if (ipoFacts.length > 0) {
        const factsStr = ipoFacts.join(", ");
        if (gmpMatch) {
          return `The IPO features ${factsStr}. Grey market premium serves as an informal listing expectation indicator, distinct from fundamental operating performance.`;
        }
        return `The IPO features ${factsStr}, reflecting primary market participation terms.`;
      }
      return "Initial Public Offering development. Key issue parameters guide market expectations and investor participation.";
    }

    // 2. ACQUISITION / MERGER
    if (evUpper === "ACQUISITION" || evUpper === "MERGER" || /\bacquisition|acquired|acquires|merger|buyout|stake purchase\b/i.test(lowerHeadline)) {
      const acqMatch = headline.match(/(.+?)\s+(?:acquires?|acquired|to\s+acquire|buys?)\s+(?:a\s+)?([\d\.]+%?\s+stake\s+in\s+)?(.+?)(?:\s+for|\s+in|\s+at|\.|$)/i) ||
                       body.match(/(.+?)\s+(?:acquired|acquires)\s+(?:a\s+)?([\d\.]+%?\s+stake\s+in\s+)?(.+?)(?:\s+for|\s+in|\s+at|\.|$)/i);

      const valMatch = text.match(/for\s+(?:₹|rs\.?|\$)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|billion|million)?)/i);
      const dealVal = valMatch ? valMatch[1] : null;

      const rationaleMatch = body.match(/\bto\s+(secure[^\.,;]+|expand[^\.,;]+|strengthen[^\.,;]+|build[^\.,;]+|enter[^\.,;]+|accelerate[^\.,;]+)/i);
      const explicitRationale = rationaleMatch ? rationaleMatch[0] : null;

      if (acqMatch && acqMatch[1] && acqMatch[3]) {
        const acquirer = acqMatch[1].trim();
        const stake = acqMatch[2] ? acqMatch[2].trim() : "";
        const target = acqMatch[3].trim().replace(/^a\s+/i, "");

        let statement = `Strategic transaction where ${acquirer} acquires ${stake ? stake + " " : ""}${target}`;
        if (dealVal) statement += ` for ${dealVal.startsWith("₹") || dealVal.startsWith("Rs") ? dealVal : "Rs " + dealVal}`;
        if (explicitRationale) {
          statement += ` ${explicitRationale}`;
        }
        statement += ".";
        return statement;
      }

      if (explicitRationale) {
        return `Strategic corporate transaction ${explicitRationale}.`;
      }
      return `Strategic corporate transaction involving ${headline}.`;
    }

    // 3. REGULATORY / POLICY
    if (evUpper === "REGULATORY" || (catUpper === "ECONOMY" && /\b(sebi|rbi|regulator|circular|show-cause|investigation|penalty|probe|cpi|gdp|monetary policy)\b/i.test(lowerHeadline)) || /\b(sebi|rbi|regulatory|sebi order|court order|interim order|final order|circular)\b/i.test(lowerHeadline)) {
      const isProposed = /\b(proposed|proposal|draft|consultation|seeking comments|discussion paper|recommends)\b/i.test(lowerText);
      if (isProposed) {
        return "Proposed regulatory framework / consultation paper outlines prospective policy parameters for market participants; changes remain draft proposals subject to final notification and effective dates.";
      }
      return `Regulatory directive introduces mandatory compliance parameters and potential operational scrutiny for ${entity.companyName || 'the subject entity'}, with market participants tracking legal filings and potential financial penalties.`;
    }

    // 4. ORDER / CONTRACT
    if (evUpper === "ORDER_CONTRACT" || /\b(order win|contract win|bags order|awarded order|secures order|won order|secures major order|secures contract)\b/i.test(lowerHeadline)) {
      const orderMetric = metrics.find(m => m.name === "Order Book");
      const clientMatch = text.match(/from\s+([A-Z][A-Za-z0-9\s]+?)(?=\s+for|\s+worth|\.|$)/);
      const clientName = clientMatch ? clientMatch[1].trim() : null;

      const orderValMatch = text.match(/(?:worth|valued\s+at|value\s+of)\s+(?:₹|rs\.?|\$)?\s*([\d,]+(?:\.\d+)?\s*(?:crore|cr|billion|million)?)/i);
      const valStr = orderValMatch ? orderValMatch[1] : (orderMetric ? orderMetric.displayText : null);

      if (valStr) {
        return `New order win worth Rs ${valStr.replace(/^(?:₹|rs\.?\s*)/i, "")}${clientName ? ` from ${clientName}` : ""} contributes to order book backlog as per contract execution terms.`;
      }
      return `New commercial contract addition contributes to revenue visibility and order book backlog for ${entity.companyName || 'the company'}.`;
    }

    // 5. PRODUCT / TECHNOLOGY / PARTNERSHIP
    if (evUpper === "PRODUCT_TECHNOLOGY" || evUpper === "PARTNERSHIP" || catUpper === "TECHNOLOGY" || /\b(partnership|collaboration|joins hands|launches|unveils|ai model|cloud|saas)\b/i.test(lowerHeadline)) {
      const partnerMatch = headline.match(/(.+?)\s+(?:partners\s+with|collaborates\s+with|teams\s+up\s+with)\s+(.+?)(?:\s+for|\s+to|\.|$)/i) ||
                           body.match(/(.+?)\s+(?:partnered\s+with|collaborated\s+with|teams\s+up\s+with)\s+(.+?)(?:\s+for|\s+to|\.|$)/i);

      const scopeMatch = headline.match(/(?:for|to\s+launch|to\s+deploy|to\s+deliver)\s+(.+)$/i) ||
                         body.match(/(?:for|to\s+launch|to\s+deploy|to\s+deliver)\s+(.+?)(?:\.|$)/i);

      if (partnerMatch && partnerMatch[1] && partnerMatch[2]) {
        const p1 = partnerMatch[1].trim();
        const p2 = partnerMatch[2].trim();
        const scope = scopeMatch ? scopeMatch[1].trim() : null;
        return `Strategic technology collaboration between ${p1} and ${p2}${scope ? ` to ${scope.replace(/^to\s+/i, "")}` : ""}.`;
      }

      return `Strategic product rollout expands competitive capabilities and addressable enterprise market share for ${entity.companyName || 'the company'}.`;
    }

    // 6. GUIDANCE
    if (evUpper === "GUIDANCE" || /\bguidance|outlook|projects|forecasts|expects revenue|targets\b/i.test(lowerHeadline)) {
      return `Revised forward management guidance recalibrates consensus valuation benchmarks and multi-quarter revenue projections for ${entity.companyName || 'the company'}.`;
    }

    // 7. EARNINGS / RESULTS
    if (evUpper === "EARNINGS" || catUpper === "RESULTS" || /\bq[1-4]\b|net profit|pat|quarterly results|ebitda/i.test(lowerHeadline)) {
      const pat = metrics.find(m => m.name === "PAT");
      const rev = metrics.find(m => m.name === "Revenue");
      const ebitda = metrics.find(m => m.name === "EBITDA");

      const reportedParts: string[] = [];
      if (pat && pat.displayText) reportedParts.push(pat.displayText);
      if (rev && rev.displayText) reportedParts.push(rev.displayText);
      if (ebitda && ebitda.displayText) reportedParts.push(ebitda.displayText);

      if (reportedParts.length > 0) {
        return `Quarterly financial performance: ${reportedParts.join("; ")}. Informs earnings trajectory for the reported period.`;
      }
      return "Quarterly financial performance informs earnings trajectory and institutional margin expectations for the reported period.";
    }

    // 8. MANAGEMENT COMMENTARY
    if (evUpper === "MANAGEMENT_COMMENTARY" || /\b(ceo|cfo|management|resignation|resigns|appoints|appointment)\b/i.test(lowerHeadline)) {
      return `Key leadership transition signals potential strategic realignments and operational focus shifts for ${entity.companyName || 'the organization'}.`;
    }

    // 9. CORPORATE ACTION / DIVIDEND / BUYBACK / FUNDRAISING
    if (["CORPORATE_ACTION", "DIVIDEND", "EX_DIVIDEND", "BUYBACK", "FUNDRAISING"].includes(evUpper) || /\b(dividend|buyback|bonus|rights issue|fundraising|qip)\b/i.test(lowerHeadline)) {
      return `Corporate action and capital distribution directly adjust shareholder returns and equity capitalization for ${entity.companyName || 'the company'}.`;
    }

    // 10. CREDIT RATING / BROKER RATING / PRICE TARGET
    if (["CREDIT_RATING", "BROKER_RATING", "PRICE_TARGET"].includes(evUpper) || /\b(rating|target price|upgrades|downgrades)\b/i.test(lowerHeadline)) {
      return `Institutional analyst rating revision and updated price target recalibrate benchmark valuations and institutional portfolio allocations.`;
    }

    // 11. COMMODITIES
    if (evUpper === "COMMODITY" || catUpper === "COMMODITIES" || entity.entityType === "COMMODITY") {
      return `Commodity price fluctuations influence input cost dynamics and gross margin structures across downstream manufacturing sectors.`;
    }

    // 12. CRYPTO
    if (evUpper === "CRYPTO" || catUpper === "CRYPTO") {
      return `Digital asset price and regulatory trends influence speculative liquidity and alternative investment flows.`;
    }

    // 13. MACRO / FUND FLOW
    if (evUpper === "MACRO" || evUpper === "FUND_FLOW" || catUpper === "GLOBAL" || entity.entityType === "MACRO") {
      return `Macroeconomic data release informs monetary policy expectations, domestic liquidity conditions, and sovereign bond yields.`;
    }

    // 14. EXCHANGE NOTICE / LISTING
    if (evUpper === "EXCHANGE_NOTICE" || evUpper === "LISTING" || catUpper === "EXCHANGE") {
      return `Exchange compliance notification sets operational and reporting requirements for listed market participants.`;
    }

    // 15. MARKET MOVEMENT
    if (evUpper === "MARKET_MOVEMENT" || catUpper === "MARKET" || entity.entityType === "BROAD_MARKET") {
      return `Broader market price action reflects shifting risk sentiment and institutional cash allocations across sectors.`;
    }

    // 16. GENERIC FALLBACK / INSUFFICIENT EVIDENCE
    return "ATHENA established that this development influences market sentiment and valuation expectations based on published disclosure.";
  }

  private static buildOptionsSellerImpact(
    article: NewsArticleV2,
    entity: any,
    metrics: any[],
    primaryCategory: string,
    eventType: string
  ): string {
    if (!entity.fnoEligible || !entity.symbol) {
      return "No actionable F&O setup from this article alone.";
    }

    const text = `${article.headline || ""} ${article.body || ""}`.toLowerCase();
    const evUpper = (eventType || "").toUpperCase();

    // Only discuss volatility or options setup if explicit derivative data or earnings result event risk is present in source text
    const holdsExplicitDerivativeData = /\b(implied volatility|\biv\b|open interest|\boi\b|put-call ratio|\bpcr\b|option chain|straddle|strangle|call writing|put writing|strike price|call options?|put options?|derivatives?)\b/i.test(text);

    if (holdsExplicitDerivativeData) {
      return `Derivative metrics noted in source text for ${entity.symbol}. Option sellers should monitor implied volatility and positioning.`;
    }

    const isEarnings = evUpper === "EARNINGS" || primaryCategory === "Results" || /q[1-4]\s*results|quarterly\s*profit|net\s*profit/i.test(text);
    if (isEarnings && evUpper !== "IPO" && evUpper !== "ACQUISITION") {
      return `Earnings result event for ${entity.symbol}. Option sellers should note event-driven volatility risk surrounding the announcement.`;
    }

    return "No actionable F&O setup from this article alone.";
  }

  private static buildMarketImpact(
    article: NewsArticleV2,
    sentiment: SentimentType,
    urgency: UrgencyType,
    eventType: string
  ): string {
    const text = `${article.headline || ""} ${article.body || ""}`.toLowerCase();
    
    // Observed reaction check
    const observedMatch = text.match(/\b(shares|stock|scrip)\s+(?:surged|rose|jumped|fell|dropped|slumped|gained|lost|rallied)\s+([\d\.]+%\s*(?:in|after|following)[^\.,;]+)/i);
    if (observedMatch) {
      return `Observed market reaction: Shares ${observedMatch[0]}. Further impact depends on trading volume and price discovery.`;
    }

    return "Market reaction depends on post-announcement trading volume and price discovery.";
  }

  private static buildRiskWatchpoints(article: NewsArticleV2, metrics: any[]): string[] {
    const risks: string[] = [];

    // 1. Negative financial metrics / Loss
    for (const m of metrics) {
      if (m.direction === "DOWN" && m.displayText) {
        risks.push(`Decline in ${m.name}: ${m.displayText}`);
      } else if (m.name === "PAT" && m.currentValue !== null && m.currentValue < 0) {
        risks.push(`Loss reported: ${m.displayText}`);
      }
    }

    // 2. Explicit risk factors in text
    const body = article.body || "";
    const text = `${article.headline || ""} ${body}`.toLowerCase();

    if (/\b(penalty|fine|sebi|tax demand|show cause|investigation|probe|raid|fraud|default|lawsuit|litigation)\b/i.test(text)) {
      const match = body.split(/(?<=[.?!])\s+/).find(s => /\b(penalty|fine|sebi|tax demand|show cause|investigation|probe|raid|fraud|default|lawsuit|litigation)\b/i.test(s));
      if (match) risks.push(`Regulatory / Legal watchpoint: "${match.trim().slice(0, 120)}"`);
    }

    if (/\b(raw material|cost inflation|input cost|margin pressure|supply chain)\b/i.test(text)) {
      risks.push("Cost pressures / operational margin sensitivity noted in source.");
    }

    if (risks.length === 0) {
      for (const m of metrics) {
        if (m.sourceSentence) {
          risks.push(`Financial Metric Source: "${m.sourceSentence.slice(0, 100)}..."`);
          break;
        }
      }
    }

    if (risks.length === 0) {
      risks.push("No explicit operational or financial risk factors identified in source text.");
    }

    return risks.slice(0, 3);
  }

  public static async generateAIIntelligence(article: NewsArticleV2): Promise<IntelligenceRecord> {
    const record = this.build(article);
    const store = IntelligenceStore.getInstance();
    const aiVersion = this.VERSION + "_AI";
    const cached = store.get(article.id, aiVersion);
    if (cached) return cached;

    try {
      const { NewsAIService } = await import("../../news/AI/NewsAIService.ts");
      const router = NewsAIService.getInstance();
      
      const metricsList = record.financialMetrics.map(m => m.name + ": " + m.displayText).join(" | ");
      const body = article.body || "";
      
      const prompt = `You are ATHENA, a strict financial AI.
Analyze the following article and extracted metrics.
You MUST synthesize narrative language ONLY from the supplied canonical evidence.
Do not invent revenue, PAT, EBITDA, EPS, or derivatives metrics.
If evidence is unavailable, explicitly return a neutral evidence-grounded statement.

Headline: ${record.headline}
Company: ${record.companyName}
F&O Eligible: ${record.fnoEligible}
Category: ${record.category}
Metrics: ${metricsList}

Respond STRICTLY in valid JSON matching this schema:
{
  "executiveSummary": "1 concise paragraph detailing the core event",
  "whyItMatters": "Business/Strategic implication",
  "marketImpact": "Market/Sector impact",
  "optionsSellerImpact": "Actionable F&O impact OR 'No actionable F&O setup from this article alone.'",
  "riskWatchpoints": ["Risk 1", "Risk 2"]
}`;

      
      const factsMap = record.financialMetrics.reduce((acc, m) => {
         acc[m.name] = m.displayText || m.currentValue;
         return acc;
      }, {});
      factsMap['Symbol'] = record.symbol;
      factsMap['Category'] = record.category;
      factsMap['EventType'] = record.eventType;
      
      const aiResponse = await router.generateSummary({
         category: record.category,
         headline: article.headline,
         body: prompt + "\n\nArticle text:\n" + body,
         facts: factsMap
      });


      let parsed;
      try {
        const cleanText = aiResponse.text.replace(/\x60\x60\x60json/g, "").replace(/\x60\x60\x60/g, "").trim();
        parsed = JSON.parse(cleanText);
      } catch (e) {
        throw new Error("Invalid JSON from LLM: " + e.message);
      }

      
      // Validate AI fields against hallucinations
      const combinedOutput = (parsed.executiveSummary + " " + parsed.whyItMatters + " " + parsed.marketImpact + " " + parsed.optionsSellerImpact + " " + (parsed.riskWatchpoints||[]).join(" ")).toLowerCase();
      
      const mustNotInvent = ["revenue", "pat", "ebitda", "eps", "gmp", "order value", "subscription"];
      for (const term of mustNotInvent) {
        if (combinedOutput.includes(term) && !metricsList.toLowerCase().includes(term) && !body.toLowerCase().includes(term) && !article.headline?.toLowerCase().includes(term)) {
           throw new Error("AI hallucination detected: invented " + term);
        }
      }
      
      const aiRecord: IntelligenceRecord = {
        ...record,
        executiveSummary: parsed.executiveSummary || record.executiveSummary,
        whyItMatters: parsed.whyItMatters || record.whyItMatters,
        marketImpact: parsed.marketImpact || record.marketImpact,
        optionsSellerImpact: parsed.optionsSellerImpact || record.optionsSellerImpact,
        risk: Array.isArray(parsed.riskWatchpoints) ? parsed.riskWatchpoints : record.risk,
        intelligenceVersion: aiVersion,
        generatedAt: new Date().toISOString()
      };
      
      // We do not override primaryCategory, fno, confidence, etc!
      store.set(aiRecord);
      return aiRecord;
    } catch (err) {
      console.warn("[UnifiedIntelligenceEngine] AI generation failed, falling back to deterministic.", err);
      return record;
    }
  }
}
