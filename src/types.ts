export interface MarketIndex {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  prevClose: number;
}

export interface TrendingStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  pe: number;
  cap: string;
  recommendation: string;
  sentiment: 'Bullish' | 'Highly Bullish' | 'Neutral' | 'Bearish' | 'Highly Bearish';
}

export interface PersonalAlert {
  id: string;
  timestamp: string;
  isRead: boolean;
  title: string;
  description: string;
  type?: 'info' | 'warning' | 'critical' | 'alert' | 'Story Change' | 'Institutional' | string;
  severity?: 'High' | 'Medium' | 'Low' | string;
  message?: string;
  symbol?: string;
}

export interface Headline {
  text: string;
  tag: string;
}

export interface MorningBrief {
  date: string;
  time: string;
  globalCues: string;
  headlines: Headline[];
  strategyNote: string;
}

export interface TimelineEvent {
  time: string;
  type: string;
  title: string;
  description: string;
  indexImpact?: string;
}

export interface MarketStory {
  id: string;
  title: string;
  summary: string;
  readTime: string;
  author: string;
  tags: string[];
  bullets: string[];
  
  // Athena Macro Narrative Fields
  compilationDate?: string;
  narrative?: string;
  mood?: 'CAUTIOUSLY OPTIMISTIC' | 'BULLISH' | 'CONSOLIDATING' | 'BEARISH';
  moodDescription?: string;
  keyDrivers?: string[];
  winningSectors?: { name: string; changePercent: string }[];
  weakSectors?: { name: string; changePercent: string }[];
  biggestSurprise?: string;
  thingsToWatchTomorrow?: string[];
  timeline?: TimelineEvent[];
  hiddenStory?: string;
  globalContext?: string;
}

export interface AiAnalysis {
  status: "available" | "unavailable";
  reason?: string;
}

export interface CompanyKnowledge {
  symbol: string;
  name: string;
  profile: {
    businessSummary: string;
    sector: string;
    marketCap: string;
    industry?: string;
    exchange?: string;
  };
  marketData: {
    price: number;
    change: number;
    changePercent: number;
    previousClose?: number;
    regularMarketTime?: number;
    marketState?: string;
  };
  story: {
    storyStatus: "Strengthening" | "Stable" | "Weakening" | "Uncertain";
    storyConfidence: number;
    previousStory?: string;
    currentStory?: string;
    reasonForChange?: string;
    firstSeen?: string;
    lastUpdated?: string;
    storyTimeline?: TimelineRecord[];
  };
  timeline: {
    id: string;
    company: string;
    event: string;
    status: string;
    confidence: number;
    timestamp: string;
  }[];
  risks: { title: string; desc: string }[];
  opportunities: string[];
  aiSummary: {
    facts: string[];
    interpretation: string;
  };
  aiAnalysis: AiAnalysis;
  sources: { title: string; uri: string }[];
  confidence: number;
  lastUpdated: string;
  financials?: {
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    volume?: number;
    averageVolume?: number;
    pe?: number;
    bookValue?: number;
    dividendYield?: number;
    roe?: number;
    roce?: number;
    debtEquity?: number;
    eps?: number;
    faceValue?: number;
    beta?: number;
    freeFloat?: number;
    promoterHolding?: number;
    fiiHolding?: number;
    diiHolding?: number;
    publicHolding?: number;
  };
  diagnostics?: {
    sourceUsed: string;
    symbolResolved: string;
    canonicalId?: string;
    resolutionMethod?: string;
    exchange: string;
    sectorSource: string;
    lastRefreshTime: string;
    cacheStatus: string;
    apiResponseTimestamp: string;
    latencyBreakdown?: Record<string, number>;
  };
  liveFinancials?: any;
  consensusRecord?: any;
}

export interface SectorStory {
  sector: string;
  storyStatus: string;
  confidence: number;
  keyDrivers: string[];
  recentEvents: string[];
  trend: "strong_up" | "up" | "flat" | "down";
}

export interface UndervaluedStock {
  symbol: string;
  name: string;
  sector: string;
  pe: number;
  peerPe: number;
  dividendYield: string;
  momentum: string;
  thesis: string;
}

export interface BreakoutSector {
  sector: string;
  growthRate: string;
  keyDrivers: string;
  stocks: string[];
}

export interface OpportunityExplorer {
  undervaluedGrowth: UndervaluedStock[];
  breakoutSectors: BreakoutSector[];
}

export interface MacroRisk {
  title: string;
  level: 'Low' | 'Medium' | 'Medium-High' | 'High';
  impact: string;
  mitigation: string;
}

export interface RegulatoryWarning {
  symbol: string;
  warning: string;
  impact: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface RiskRadar {
  macroRisks: MacroRisk[];
  regulatoryWarnings: RegulatoryWarning[];
}

export interface MarketDataResponse {
  indices: MarketIndex[];
  trendingStocks: TrendingStock[];
  morningBrief: MorningBrief;
  marketStories: MarketStory[];
  opportunityExplorer: OpportunityExplorer;
  riskRadar: RiskRadar;
}

export interface SearchSource {
  title: string;
  uri: string;
  trustRating?: string;
  publicationTime?: string;
}

export interface StoryEngineRecord {
  id: string;
  company: string;
  event: string;
  status: 'Draft' | 'Published' | 'Archived' | 'Pending';
  confidence: number;
  timestamp: string;
  sources: SearchSource[];
}

export interface SearchResponse {
  text: string;
  sources: SearchSource[];
  plan?: any;
  executionTime?: number;
  confidenceScore?: number;
  geminiTokens?: number;
  cacheHit?: boolean;
  reasoningGraph?: ReasoningGraph;
  detectedContradictions?: ConflictRecord[];
}

export enum AlertCategory {
  UserIntelligence = "UserIntelligence",
  SystemHealth = "SystemHealth"
}

export enum EventType {
  Earnings = "Earnings",
  CorporateAction = "Corporate Action",
  OrderWin = "Order Win / Contract",
  MA = "M&A",
  RegulatoryFiling = "Regulatory Filing",
  ManagementCommentary = "Management Commentary",
  CreditRating = "Credit Rating",
  Dividend = "Dividend",
  Buyback = "Buyback",
  PromoterActivity = "Promoter Activity",
  BlockBulkDeal = "Block/Bulk Deal",
  FIIDIIFlow = "FII/DII Flow",
  InsiderTrading = "Insider Trading",
  IndexInclusionRemoval = "Index Inclusion/Removal",
  SectorRotation = "Sector Rotation",
  MacroEconomy = "Macro Economy",
  RBIPolicy = "RBI Policy",
  GovernmentPolicy = "Government Policy",
  CommodityImpact = "Commodity Impact",
  ForexImpact = "Forex Impact",
  TechnicalBreakout = "Technical Breakout",
  UnusualVolume = "Unusual Volume",
  MarketWideRisk = "Market Wide Risk"
}

export enum StoryImpact {
  Positive = "Positive",
  Neutral = "Neutral",
  Negative = "Negative",
  Unknown = "Unknown"
}

export enum Severity {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical"
}

export interface AthenaEvent {
  id: string;
  timestamp: string;
  source: string;
  eventType: EventType;
  title: string;
  description: string;
  companies: string[];
  sectors: string[];
  confidence: number;
  status: string;
  evidence: string;
  impact?: StoryImpact;
  severity?: Severity;
}

export type NodeType = 
  | "Company"
  | "Sector"
  | "Theme"
  | "Commodity"
  | "Government Policy"
  | "Index"
  | "Country"
  | "Currency"
  | "Event";

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  properties?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  relationship: string; // Relationship label/description
  weight?: number;
  properties?: Record<string, any>;
  history?: { date: string; strength: number }[];
}

export type EvidenceStatus = "Verified" | "Conflicting" | "Unverified";

export interface Evidence {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceType: string;
  sourceCredibility: number; // 0-100
  publishedTime: string;
  retrievedTime: string;
  trustScore: number;
  evidenceType: string;
  relatedCompanies: string[];
  relatedSectors: string[];
  relatedEvents: string[];
  summary: string;
  status: EvidenceStatus;
  category: EventType;
  impact: StoryImpact;
  sentiment: number; // -1 to 1
  confidence: number;
  
  // Deduplication & Merging
  isDuplicate?: boolean;
  mergedIntoId?: string;
  relatedEvidenceIds?: string[];
  
  conflicts?: string[]; // list of issues/conflicting messages
  metadata?: {
    priceMovement?: number;
    volumeSpike?: number;
    marketCap?: number;
    isPromoterActivity?: boolean;
    isEarnings?: boolean;
    isRegulatory?: boolean;
    [key: string]: any;
  };
}

export interface EvidenceSummaryData {
  keyFacts: string[];
  supportingEvidence: string[];
  conflictingEvidence: string[];
  overallConfidence: number;
}

export type ConflictType = 
  | "Numerical Conflict"
  | "Timeline Conflict"
  | "Opinion Conflict"
  | "Source Conflict"
  | "Policy Conflict"
  | "Duplicate Conflict"
  | "Unknown Conflict";

export interface NormalizedEvent {
  id?: string;
  title: string;
  summary: string;
  source: string;
  publishedTime: string;
  retrievedTime: string;
  companies: string[];
  sectors: string[];
  themes: string[];
  confidence: number;
  originalUrl: string;
}

export interface MCPHealth {
  latencyMs: number;
  successRate: number;
  lastSync: string;
  errorCount: number;
  averageResponseTime: number;
}

export interface ConflictResolution {
  resolvedVersion: string;
  alternativeVersion: string;
  reason: string;
  trustScore: number;
}

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  description: string;
  evidenceItems: string[]; // IDs of conflicting evidence
  resolution?: ConflictResolution;
  status: "Detected" | "Resolved" | "Unresolvable";
}

export interface ReasoningStep {
  step: number;
  description: string;
}

export interface ReasoningGraph {
  evidenceUsed: string[]; // Evidence IDs
  knowledgeGraphNodes: string[]; // Node IDs
  supportingSources: SearchSource[];
  conflictingSources: SearchSource[];
  confidenceCalculation: string;
  reasoningSummary: string;
  steps?: ReasoningStep[];
}

export interface StoryEvolution {
  previousStory: string;
  currentStory: string;
  reasonForChange: string;
  storyConfidence: number;
  firstSeen: string;
  lastUpdated: string;
  storyTimeline: TimelineRecord[];
}

export interface QuotaStats {
  dailyRequests: number;
  hourlyRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitErrors: number;
  averageTokens: number;
  averageResponseTime: number;
  remainingCapacity: number;
}

export interface SearchRequest {
  id: string;
  query: string;
  priority: number;
  source: string;
  timestamp: number;
  onSuccess: (data: any) => void;
  onError: (error: any) => void;
}

export interface CoordinatorStatus {
  status: "Online" | "Throttled" | "Standby" | "Offline";
  queueLength: number;
  activeSearches: number;
  cacheHitRatio: number;
  mergedRequestsCount: number;
  callsSavedCount: number;
  estimatedTokenSavings: number;
  apiBudgetRemaining: number;
  averageLatency: number;
  connectors: Record<string, { lastSync: string; status: string; refreshInterval: number }>;
}

export interface TimelineRecord {
  timelineId: string;
  timestamp: string;
  eventId: string;
  company?: string;
  sector?: string;
  theme?: string;
  storyStatus: string;
  confidence: number;
  evidenceIds: string[];
  relatedKnowledgeGraphNodes: string[];
  reason?: string;
  milestone?: string; // e.g., "New Story Started", "Story Confirmed"
}

export interface UserCompanyPreference {
  userId: string;
  companyId: string;
  symbol: string;
  watchlisted: boolean;
  following: boolean;
  createdAt: string;
  alertPreferences: {
    importantNews: boolean;
    earnings: boolean;
    corporateActions: boolean;
    priceMovement: boolean;
    aiUpdates: boolean;
  };
}

export interface WatchlistItem {
  symbol: string;
  isPinned: boolean;
  addedAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

export interface FollowedCompany {
  symbol: string;
  followedAt: string;
  notificationsEnabled: boolean;
}

export interface SavedResearch {
  id: string;
  type: "Search" | "Company" | "Story" | "Report";
  title: string;
  data: any;
  savedAt: string;
}

export interface UserPreferences {
  tradingStyle: "Long Term" | "Swing" | "F&O" | "Scalping";
  interests: string[];
  theme: string;
}

export enum EventCategory {
  Earnings = "Earnings",
  CorporateAction = "Corporate Action",
  OrderWin = "Order Win / Contract",
  MA = "M&A",
  RegulatoryFiling = "Regulatory Filing",
  ManagementCommentary = "Management Commentary",
  CreditRating = "Credit Rating",
  Dividend = "Dividend",
  Buyback = "Buyback",
  PromoterActivity = "Promoter Activity",
  BlockBulkDeal = "Block/Bulk Deal",
  FIIDIIFlow = "FII/DII Flow",
  InsiderTrading = "Insider Trading",
  IndexInclusionRemoval = "Index Inclusion/Removal",
  SectorRotation = "Sector Rotation",
  MacroEconomy = "Macro Economy",
  RBIPolicy = "RBI Policy",
  GovernmentPolicy = "Government Policy",
  CommodityImpact = "Commodity Impact",
  ForexImpact = "Forex Impact",
  TechnicalBreakout = "Technical Breakout",
  UnusualVolume = "Unusual Volume",
  MarketWideRisk = "Market Wide Risk"
}

export enum Priority {
  Ignore = "Ignore",
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical"
}

export interface AlertDecision {
  alertId: string;
  timestamp: string;
  title: string;
  company: string;
  category: string;
  priority: Priority;
  impactScore: number;
  detectionConfidence: number;
  score: number;
  decision: "Notify" | "Suppress" | "Merge";
  reason: string;
  evidenceUsed: string[];
  latencyMs: number;
  thresholdUsed: number;
  traceId?: string;
}

export interface AthenaAlert {
  id: string;
  timestamp: string;
  type: EventType;
  title: string;
  description: string;
  source?: string;
  
  // Quick Investor View
  timeHorizon?: 'Short Term' | 'Medium Term' | 'Long Term';
  investorFocus?: string;
  bullCase?: string[];
  bearCase?: string[];
  
  // Evidence & Confidence
  sourceReliabilityScore?: number;
  detectionConfidence?: number;
  impactConfidence?: number;
  
  // Enriched Story Context (Phase 5)
  whatHappened?: string;
  whyNow?: string;
  whyItMatters?: string;
  immediateMarketImpact?: string;
  longTermImpact?: string;
  affectedSector?: string;
  relatedCompanies?: string[];
  historicalComparison?: string;
  investorTakeaway?: string;
  expectedNextCatalyst?: string;
  headline?: string;
  categoryDesc?: string;
  impactReason?: string;
  keyPoints?: string[];
  marketImpactDesc?: string;
  
  // Sector Intelligence (Phase 8)
  peers?: string[];
  sectorETF?: string;
  sectorIndex?: string;
  topBeneficiaries?: string[];
  potentialLosers?: string[];
  
  // Market Context (Phase 9)
  marketContext?: {
    niftyTrend?: string;
    sectorTrend?: string;
    vix?: number;
    usdinr?: number;
    gold?: number;
    crude?: number;
    fiiDiiFlow?: string;
    marketBreadth?: string;
  };
  
  confidence: number;
  evidenceCount?: number;
  originalSources?: string[];
  sourceWeights?: Record<string, number>;
  
  impact?: StoryImpact;
  severityScore?: number; // 0-100 (Phase 2)
  priority: Priority;
  status?: "Delivered" | "Read" | "Dismissed";
  
  companies: string[];
  sectors: string[];
  score?: number;
  decisionMetadata?: AlertDecision;
  category?: AlertCategory;
  traceId?: string;
}


export interface AlertSettings {
  minPriority: Priority;
  preferredSectors: string[];
  preferredCompanies: string[];
  preferredAlertTypes: string[];
  marketHoursOnly: boolean;
  silentMode: boolean;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramLastTestAt?: string;
}

export interface DailyBriefing {
  date: string;
  mood: string;
  topStoryId: string;
  watchlistUpdates: string[];
  biggestOpportunity: string;
  biggestRisk: string;
  eventsToday: string[];
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  investmentAmount: number;
  sector: string;
  purchaseDate: string;
  notes: string;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: PortfolioHolding[];
  createdAt: string;
}

export interface PortfolioAnalysis {
  overallMood: string;
  diversificationScore: number;
  sectorAllocation: Record<string, number>;
  riskLevel: "Low" | "Medium" | "High";
  storyChanges: string[];
  opportunities: string[];
  emergingRisks: string[];
}

export interface PortfolioReview {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  riskConcentration: string;
  opportunities: string[];
  monitoringItems: string[];
  evidence: string[];
}

export interface PortfolioTimelineEvent {
  id: string;
  timestamp: string;
  type: "STORY" | "SECTOR" | "MACRO" | "FILING" | "CONFIDENCE";
  title: string;
  description: string;
  symbol?: string;
  impact: "Positive" | "Negative" | "Neutral";
}

export interface DataProvider {
  getIndices(): Promise<MarketIndex[]>;
  getStocks(symbols: string[]): Promise<TrendingStock[]>;
}

export enum NotificationChannel {
  Telegram = "Telegram",
  Push = "Push",
  Email = "Email"
}

export enum NotificationStatus {
  Queued = "Queued",
  Processing = "Processing",
  Delivered = "Delivered",
  Failed = "Failed",
  Retrying = "Retrying"
}

export interface NotificationRecord {
  id: string;
  alertId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  createdAt: string;
  deliveredAt?: string;
  retryCount: number;
  errorMessage?: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  traceId?: string;
}

export interface DeliveryResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  telegramMessageId?: string;
  latency?: number;
}

export interface NotificationProvider {
  send(notification: NotificationRecord, alert: AthenaAlert): Promise<DeliveryResult>;
}
export enum PipelineStage {
  Ingestion = "News/API Ingestion",
  MCP = "MCP Connector",
  Evidence = "Evidence Engine",
  AlertDecision = "Alert Decision Engine",
  NotificationQueue = "Notification Delivery Queue",
  ProviderSend = "Provider Dispatch",
  TelegramAPI = "Telegram API",
  Delivered = "Final Delivery"
}

export interface Company {
  symbol: string;
  name: string;
  sector: string;
  industry?: string;
  isNifty200: boolean;
  aliases: string[];
}

export interface ExchangeFilingData {
  isFiling: boolean;
  exchange: "NSE" | "BSE" | "NSE/BSE";
  filingCategory: string;
  companySymbol: string;
  companyName: string;
  filingDate: string;
  subject: string;
  filingUrl?: string;
  description?: string;
  pipelineUsed?: 'Exchange Filing Pipeline' | 'News Pipeline';
  routingConfidence?: number;
  routingReason?: string;
  detectionRuleMatched?: string;
}

export type ParagraphCategory =
  | 'Financial Results'
  | 'Corporate Actions'
  | 'Management Guidance'
  | 'Regulatory Filing'
  | 'Market Impact'
  | 'Capacity Expansion'
  | 'Future Plans'
  | 'Risks'
  | 'Macroeconomics'
  | 'Industry Trends'
  | 'Executive Commentary'
  | 'Analyst Commentary'
  | 'Technical Analysis'
  | 'Disclaimer'
  | 'Advertisement'
  | 'Author Biography'
  | 'Newsletter'
  | 'Related Story'
  | 'Noise';

export interface ClassifiedParagraph {
  text: string;
  category: ParagraphCategory;
}

export interface VerifiedFactCard {
  label: string;
  value: string;
  growth?: string;
  unit?: string;
  context?: string;
}

export interface ExchangeFilingIntelligence {
  filingSummary: string;
  announcementType: string;
  company: string;
  effectiveDate: string;
  keyDecisions: string[];
  complianceImpact: string;
  requiredInvestorAction: string;
  financialMetrics: VerifiedFactCard[];
}

export interface ExtractedEntities {
  companies: string[];
  tickers: string[];
  sector?: string;
  commodities: string[];
  indices: string[];
  countries: string[];
  governmentAgencies: string[];
  executives: string[];
  currencies: string[];
  financialMetrics: string[];
}

export interface StructuredContent {
  financialResults: string[];
  corporateActions: string[];
  managementGuidance: string[];
  regulatoryItems: string[];
  marketImpact: string[];
  capacityExpansion: string[];
  futurePlans: string[];
  risks: string[];
  analystCommentary: string[];
  technicalAnalysis: string[];
  authorBiography: string[];
  disclaimer: string[];
  ads: string[];
  relatedArticles: string[];
}

export interface AthenaIntelligence {
  executiveSummary: string;
  whyItMatters: string;
  sectorImpact: string;
  companiesAffected: Array<{ symbol: string; impact: string }>;
  institutionalView: string;
  keyRisks: string[];
  catalysts?: string[];
  investorWatchlist: string[];
  confidenceScore: number;
  providerUsed?: string;
  generatedAt?: string;
  isCached?: boolean;
}

export interface IntelligenceReport {
  id: string;
  eventId: string;
  headline: string;
  executiveSummary: string;
  verifiedFacts: string[];
  verifiedFactCards?: VerifiedFactCard[];
  classifiedParagraphs?: ClassifiedParagraph[];
  structuredContent?: StructuredContent;
  exchangeFilingIntelligence?: ExchangeFilingIntelligence;
  entities?: ExtractedEntities;
  articleSummaryBullets?: string[];
  marketCommentary?: string[];
  athenaIntelligence?: AthenaIntelligence | null;
  publisherName?: string;
  trustRating?: number;
  publishedAt?: string;
  whyItMatters: string;
  historicalContext?: string;
  peerComparison?: string;
  sectorImpact?: string;
  marketImpact?: string;
  bullCase?: string;
  bearCase?: string;
  risks?: string[];
  probabilityAssessment?: number; // 0-100
  investorTakeaway: string;
  timeline?: { time: string; event: string }[];
  relatedCompanies?: string[];
  confidence: number;
  sentiment: "Bullish" | "Bearish" | "Neutral";
  sources: { name: string; url?: string }[];
  generatedAt: string;
  contentExtracted?: boolean;
  extractionError?: string;
  rawExtractedText?: string;
  isExchangeFiling?: boolean;
  filingData?: ExchangeFilingData;
  structuredExchangeFiling?: StructuredExchangeFiling;
}

export interface StructuredExchangeFiling {
  metadata: {
    company: string;
    exchange: string;
    filingType: string;
    filingDate: string;
    announcementTitle: string;
  };
  financialMetrics: VerifiedFactCard[];
  corporateActions: string[];
  boardApprovals: string[];
  fundRaise: string[];
  dividend: string[];
  merger: string[];
  acquisition: string[];
  capacityExpansion: string[];
  managementGuidance: string[];
  timeline: { time: string; event: string }[];
  regulatoryItems: string[];
  investorActions: string[];
  riskFactors: string[];
  rawCleanText: string;

  // Summaries requested by PART E
  executiveFilingSummary: string;
  corporateActionSummary: string;
  keyFinancialMetrics: string[];
  boardDecisions: string[];
  importantDates: string[];
  investorActionsRequired: string[];
}

export interface ExtractionAudit {
  newsId: string;
  originalUrl: string;
  redirects: string[];
  resolvedUrl: string;
  statusCode: number;
  contentType: string;
  extractionMethod: 'HTML' | 'PDF' | 'OCR' | 'RAW' | 'NONE';
  htmlTitle?: string;
  pdfPageCount?: number;
  textLength: number;
  timeTakenMs: number;
  failureReason?: string;
  timestamp: string;

  // Publisher-Aware Smart Extraction Audit Fields
  publisher?: string;
  strategySelected?: string;
  fallbacksAttempted?: string[];
  winningStrategy?: string;
  charactersExtracted?: number;
  confidence?: number;

  // Extended Content Processing Audit Fields
  cleanedTextLength?: number;
  summarizerInputLength?: number;
  summarizationStatus?:
    | 'Success'
    | 'Failure'
    | 'Skipped'
    | 'Skipped by validation'
    | 'Waiting for Gemini'
    | 'Gemini quota exceeded'
    | 'Gemini request failed'
    | 'Gemini returned empty output'
    | 'Summary generated successfully'
    | string;
  summaryLength?: number;
  intelligenceStatus?: 'Success' | 'Failure' | 'Skipped';
  finalSummary?: string;
  extractedSnippet?: string; // First 500 characters
  extractionStrategy?: string;
  pageTitle?: string;
  processingStage?: 'Extraction' | 'Summarization' | 'Intelligence' | 'Finalization';

  // Final URL Verification Audit Fields
  expectedPublisher?: string;
  finalPublisher?: string;
  expectedHeadline?: string;
  finalHtmlTitle?: string;
  similarityScore?: number;
  validationResult?: string;

  // Summarizer Engine Audit Fields
  wasGeminiCalled?: 'Yes' | 'No';
  geminiResponseStatus?: string;
  llmProviderUsed?: 'Gemini' | 'Grok' | 'Grok Fallback' | string;
  grokResponseStatus?: string;
  promptLength?: number;
  responseLength?: number;
  skipReason?: string;

  // Regression Fix & Runtime Audit Fields
  paragraphsClassified?: number;
  paragraphsDiscarded?: number;
  structuredCategoriesPopulated?: number;
  summarySource?: 'Headline only' | 'Article body' | 'Structured content';
  discardReasons?: Array<{ paragraph: string; reason: string }>;
  pipelineUsed?: 'Exchange Filing Pipeline' | 'News Pipeline';
  routingConfidence?: number;
  routingReason?: string;
  detectionRuleMatched?: string;
  extractionQualityScore?: number;
  sourceCoverage?: {
    financialResults: number;
    corporateActions: number;
    managementGuidance: number;
    risks: number;
    marketCommentary: number;
  };
}

export interface PipelineEvent {
  id: string;
  traceId: string;
  stage: PipelineStage;
  timestamp: string;
  status: "Success" | "Failure" | "Suppressed" | "Retrying";
  details: string;
  latencyMs?: number;
  score?: number;
  priority?: Priority;
  channel?: NotificationChannel;
  retryCount?: number;
  providerResponse?: any;
}

export interface PipelineTrace {
  traceId: string;
  startTime: string;
  endTime?: string;
  status: "In-Progress" | "Completed" | "Failed";
  events: PipelineEvent[];
}

export function isExactArticleUrl(url: string | null | undefined): boolean {
  if (!url || url === "#" || url.includes("system.fallback.local")) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if ((pathname === "" || pathname === "/" || pathname.toLowerCase() === "/index.html") && !parsed.search && !parsed.hash) {
      return false;
    }
    // Also block common homepage-only domains directly if needed
    const homepageDomains = [
      "www.moneycontrol.com", "moneycontrol.com",
      "www.reuters.com", "reuters.com",
      "www.bloomberg.com", "bloomberg.com",
      "www.nseindia.com", "nseindia.com",
      "www.sebi.gov.in", "sebi.gov.in",
      "www.bseindia.com", "bseindia.com",
      "www.rbi.org.in", "rbi.org.in",
      "news.google.com"
    ];
    if (homepageDomains.includes(parsed.hostname.toLowerCase()) && (pathname === "" || pathname === "/")) {
      return false;
    }
    return true;
  } catch (e) {
    // If it is a relative link or has some other structure
    return url.length > 25 && (url.startsWith("http://") || url.startsWith("https://")) && url.split("/").length > 3;
  }
}
