import { V3Story } from '../NewsEngineV3/types/V3Types';
import { NewsArticle } from './NewsArticle';
import { FNORelevanceEngine } from '../FNO/FNORelevanceEngine';
import { isAuthoritativeFNOStory } from '../FNO/FNOAuthoritativeGate';

export function mapV3StoryToNewsArticle(story: V3Story): NewsArticle {
  const primaryCompany = story.structuredData?.primaryCompany;
  const companies = story.structuredData?.mentionedCompanies?.map(c => ({
    name: c.name,
    ticker: c.symbol,
    sector: c.sector || "General",
    isFnO: c.isFO
  })) || [];

  const sentimentMap: Record<string, 'bullish' | 'bearish' | 'neutral' | 'BULLISH' | 'BEARISH' | 'NEUTRAL'> = {
    'STRONG_BULLISH': 'BULLISH',
    'MODERATE_BULLISH': 'BULLISH',
    'STRONG_BEARISH': 'BEARISH',
    'MODERATE_BEARISH': 'BEARISH',
    'NEUTRAL': 'NEUTRAL'
  };

  const sentiment = sentimentMap[story.intelligence?.marketImpact?.sentiment || 'NEUTRAL'] || 'NEUTRAL';

  // Evaluate deterministic F&O Relevance Audit
  const audit = FNORelevanceEngine.evaluateAudit({
    title: story.headline,
    body: story.primaryArticle.cleanBody || '',
    symbol: story.structuredData?.primaryCompany?.symbol,
    ticker: story.structuredData?.primaryCompany?.symbol
  });

  const tempArticle: any = {
    fnoDecision: audit.fnoDecision,
    fnoEligible: audit.fnoEligible,
    fnoSymbol: audit.fnoSymbol,
    fnoRelevance: audit.fnoDecision === 'INCLUDE' ? 'HIGH' : audit.fnoRelevance,
    entityConfidence: audit.entityConfidence,
    entityMatchLocation: audit.entityMatchLocation
  };

  const isAuthoritative = isAuthoritativeFNOStory(tempArticle);
  const isFO = isAuthoritative;

  const summaryParts: string[] = [];
  
  // What Happened?
  if (story.intelligence?.institutionalSummary) {
    summaryParts.push(`WHAT HAPPENED?\n${story.intelligence.institutionalSummary}`);
  } else {
    summaryParts.push(`WHAT HAPPENED?\n${story.headline}`);
  }

  // Why Does It Matter & Market Impact
  const impactSentiment = story.intelligence?.marketImpact?.sentiment || 'NEUTRAL';
  summaryParts.push(`MARKET IMPACT & CATALYSTS:\n• Rating: ${impactSentiment}\n• Impact Score: ${story.intelligence?.marketImpact?.score || 50}/100`);

  // Key Financial / Operating Data
  if (story.structuredData?.financialMetrics && story.structuredData.financialMetrics.length > 0) {
    const metricsStr = story.structuredData.financialMetrics.map(m => `• ${m.metricName}: ${m.currentValue} (${m.direction})`).join('\n');
    summaryParts.push(`KEY FINANCIAL/OPERATING DATA:\n${metricsStr}`);
  }

  // Business Highlights
  if (story.structuredData?.businessEvents && story.structuredData.businessEvents.length > 0) {
    const eventsStr = story.structuredData.businessEvents.map(e => `• ${e.eventType}: ${e.details}`).join('\n');
    summaryParts.push(`BUSINESS EVENTS:\n${eventsStr}`);
  }

  // Management View
  if (story.structuredData?.executiveQuotes && story.structuredData.executiveQuotes.length > 0) {
    const quotesStr = story.structuredData.executiveQuotes.map(q => `"${q.quoteText}" — ${q.speakerName}${q.speakerTitle ? ` (${q.speakerTitle})` : ''}`).join('\n');
    summaryParts.push(`MANAGEMENT VIEW:\n${quotesStr}`);
  } else {
    summaryParts.push(`MANAGEMENT VIEW:\nNo verified management commentary available.`);
  }

  const pubNameMap: Record<string, string> = {
    'REUTERS': 'Reuters',
    'ECONOMIC_TIMES': 'Economic Times',
    'MONEYCONTROL': 'Moneycontrol',
    'LIVEMINT': 'LiveMint',
    'BUSINESS_STANDARD': 'Business Standard',
    'CNBC_TV18': 'CNBC TV18',
    'NSE': 'NSE India',
    'BSE': 'BSE India',
    'SEBI': 'SEBI',
    'RBI': 'RBI',
    'PIB': 'PIB',
    'INVESTOR_RELATIONS': 'Investor Relations',
    'GOOGLE_NEWS_RSS': 'Google News'
  };

  const publisherDisplayName = pubNameMap[story.publisher.id] || 
    (story.publisher.name && story.publisher.name !== 'FINANCIAL_NEWS' ? story.publisher.name : story.publisher.id);

  const rawCanonicalUrl = story.primaryArticle.canonicalUrl || story.publisher.baseUrl || '';
  const isGoogleFallback = rawCanonicalUrl.includes('news.google.com') || story.publisher.id === 'GOOGLE_NEWS_RSS';

  return {
    id: story.storyId,
    correlationId: story.correlationId,
    clusterId: story.clusterId,
    headline: story.headline,
    title: story.headline,
    description: story.primaryArticle.summaryLead || story.headline,
    summary: summaryParts.join('\n\n'),
    publisher: publisherDisplayName,
    publishedAt: story.publishedAt,
    category: story.category as any,
    categories: [story.category],
    country: "India",
    language: story.primaryArticle.language || "English",
    url: rawCanonicalUrl,
    originalPublisherUrl: rawCanonicalUrl,
    collectionUrl: story.publisher.baseUrl || rawCanonicalUrl,
    collectionMethod: isGoogleFallback ? 'GOOGLE_RSS_FALLBACK' : 'DIRECT',
    image: undefined,
    source: "NewsEngineV3",
    sourceType: "RSS",
    isExchange: story.publisher.isOfficialExchange,
    isExchangeDocument: story.publisher.isOfficialExchange,
    feedName: publisherDisplayName,
    companies,
    tickers: story.structuredData?.mentionedCompanies?.map(c => c.symbol) || [],
    sectors: story.structuredData?.mentionedCompanies?.map(c => c.sector || "General") || [],
    isFO: isFO,
    isFnO: isFO,
    fnoDecision: isFO ? 'INCLUDE' : 'EXCLUDE',
    fnoEligible: audit.fnoEligible,
    fnoSymbol: audit.fnoSymbol,
    matchedEntity: audit.matchedEntity,
    entityMatchLocation: audit.entityMatchLocation,
    entityConfidence: audit.entityConfidence,
    cleanBody: story.primaryArticle.cleanBody,
    fullArticleBody: story.primaryArticle.cleanBody,
    sentiment,
    tags: [story.category, publisherDisplayName, ...(story.structuredData?.mentionedCompanies?.map(c => c.symbol) || [])],
    telegramEligible: isFO,
    telegramDecision: isFO ? 'APPROVED' : 'REJECTED',
    foReason: audit.fnoReasons.join('; '),
    fnoRelevance: isFO,
    fnoRelevanceScore: audit.fnoScore,
    fnoRelevanceTier: audit.fnoRelevance === 'HIGH' ? 'TIER_1' : (audit.fnoRelevance === 'MEDIUM' ? 'TIER_2' : 'TIER_3'),
    fnoReasons: audit.fnoReasons,
    fnoEntities: audit.fnoSymbol ? [audit.fnoSymbol] : [],
    fnoEvidence: [],
    binaryRisk: audit.optionsSellerRelevance === 'VERY_HIGH' ? 'BINARY' : 'LOW',
    volatilityRisk: 'NEUTRAL',
    decisionEligibility: isFO ? 'ELIGIBLE_FOR_FO_ANALYSIS' : 'INELIGIBLE_NOT_TRADE_RELEVANT',
    queueStatus: 'DELIVERED',
    delivered: true,
    qualityScore: story.qualityGate?.score || 95,
    freshnessScore: 100,
    providerRating: story.publisher?.trustScore || 98
  };
}
