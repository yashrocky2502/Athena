import { ArticleContent } from './ArticleContent';
import { CompanyDetector } from '../detection/CompanyDetector';
import { SourcePriorityEngine } from './SourcePriorityEngine';
import { EventClassifierEngine, EventType, ExtractedFinancialMetric } from './EventClassifierEngine';
import { NotificationService } from './NotificationService';

export interface SourceTimelineItem {
  publisher: string;
  timestamp: string;
  rawTime: number;
  headline: string;
  sourceConfidence: number;
}

export interface InternalDebugInfo {
  clusterId: string;
  matchedArticlesCount: number;
  similarityScore: number;
  primarySource: string;
  supportingSources: string[];
  totalConfidence: number;
  mergeDecision: 'CREATED_NEW' | 'MERGED_INTO_EXISTING';
  publisherTimeline: SourceTimelineItem[];
}

export interface StoryCluster {
  id: string;
  title: string;
  summary: string;
  eventCategory: EventType;
  eventType: EventType;
  symbols: string[];
  companyNames: string[];
  isFnO: boolean;
  score: number; // Confidence / Signal Strength
  sourcesCount: number;
  firstPublisher: string;
  latestPublisher: string;
  firstPublisherTime: string;
  latestPublisherTime: string;
  timeDifferenceText: string;
  confirmedBySources: string[];
  sourceTimeline: SourceTimelineItem[];
  verifiedMetrics: ExtractedFinancialMetric[];
  articles: ArticleContent[];
  canonicalArticle: ArticleContent;
  createdAt: number;
  updatedAt: number;
  internalDebug: InternalDebugInfo;

  // Backward compatibility fields for legacy views & filters
  category?: string;
  signalStrength?: number;
  confidence?: number;
  marketImpact?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: 'Breaking' | 'Developing' | 'Cooling' | 'Completed';
  firstSeen?: string;
  sources?: string[];
  affectedAssets?: string[];
  primarySector?: string;
  articleIds?: string[];
}

export class StoryClusterEngine {
  private static instance: StoryClusterEngine;
  private clusters: Map<string, StoryCluster> = new Map();
  // Quick index by ticker symbol to satisfy <2ms entity lookup and <5ms duplicate check
  private symbolClusterIndex: Map<string, Set<string>> = new Map();

  private constructor() {}

  public static getInstance(): StoryClusterEngine {
    if (!StoryClusterEngine.instance) {
      StoryClusterEngine.instance = new StoryClusterEngine();
    }
    return StoryClusterEngine.instance;
  }

  /**
   * Main entry point: Process incoming article, detect duplicates/clusters,
   * calculate source priorities, track timeline, and handle F&O integration.
   */
  public processArticle(article: ArticleContent): { cluster: StoryCluster; relation: 'NEW_CLUSTER' | 'MERGED' } {
    const startTime = performance.now();

    // 1. Universal Entity Detection (Phase 10)
    const entityDetection = CompanyDetector.detectUniversal({
      headline: article.title,
      subheadline: article.description || article.summary,
      summary: article.summary || article.content,
      metadata: article.publisher || article.url
    });

    const detectedSymbols = entityDetection.detectedCompanies.map(c => c.ticker);
    const detectedCompanyNames = entityDetection.detectedCompanies.map(c => c.name);
    const isFnO = entityDetection.isFnO;

    // 2. Source Priority Evaluation (Phase 2)
    const sourceEval = SourcePriorityEngine.evaluateSource(article.publisher, article.url);

    // 3. Event Type & Financial Metric Classification (Phase 8)
    const eventClassification = EventClassifierEngine.classifyEvent(article.title, article.summary || article.description || '');

    // Normalize article timestamp
    const articleTime = article.publishedAt ? new Date(article.publishedAt).getTime() : Date.now();
    const formattedTime = new Date(articleTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

    // 4. Duplicate Detection & Clustering Engine (Phase 3 & 4)
    const clusterMatch = this.findMatchingCluster(
      article.title,
      article.summary || article.description || '',
      detectedSymbols,
      eventClassification.eventType,
      eventClassification.metrics,
      articleTime
    );

    if (clusterMatch.cluster && clusterMatch.similarity >= 0.85) {
      // MERGE INTO EXISTING CLUSTER (Phase 4, Phase 11 Breaking News)
      const targetCluster = clusterMatch.cluster;
      const mergeStartTime = performance.now();

      targetCluster.articles.push(article);
      targetCluster.sourcesCount = targetCluster.articles.length;
      targetCluster.updatedAt = articleTime;

      // Update confirmed sources list
      if (!targetCluster.confirmedBySources.includes(sourceEval.sourceName)) {
        targetCluster.confirmedBySources.push(sourceEval.sourceName);
      }

      // Append to Source Timeline (Phase 6)
      targetCluster.sourceTimeline.push({
        publisher: sourceEval.sourceName,
        timestamp: formattedTime,
        rawTime: articleTime,
        headline: article.title,
        sourceConfidence: sourceEval.confidenceScore
      });

      // Sort timeline chronologically
      targetCluster.sourceTimeline.sort((a, b) => a.rawTime - b.rawTime);

      // Update first and latest publisher stats
      const firstItem = targetCluster.sourceTimeline[0];
      const lastItem = targetCluster.sourceTimeline[targetCluster.sourceTimeline.length - 1];

      targetCluster.firstPublisher = firstItem.publisher;
      targetCluster.firstPublisherTime = firstItem.timestamp;
      targetCluster.latestPublisher = lastItem.publisher;
      targetCluster.latestPublisherTime = lastItem.timestamp;

      // Calculate time difference between first and latest (e.g. +7m apart)
      const diffMinutes = Math.round((lastItem.rawTime - firstItem.rawTime) / (1000 * 60));
      targetCluster.timeDifferenceText = diffMinutes > 0 ? `+${diffMinutes}m span` : 'Instant';

      // Upgrade canonical article if incoming article has higher source priority (e.g., NSE Filing > Reuters)
      const currentCanonicalSource = SourcePriorityEngine.evaluateSource(
        targetCluster.canonicalArticle.publisher,
        targetCluster.canonicalArticle.url
      );

      if (sourceEval.confidenceScore > currentCanonicalSource.confidenceScore) {
        targetCluster.canonicalArticle = article;
        targetCluster.title = article.title;
        targetCluster.summary = article.summary || article.description || targetCluster.summary;
      }

      // Merge newly extracted financial metrics
      for (const newMetric of eventClassification.metrics) {
        if (!targetCluster.verifiedMetrics.some(m => m.value === newMetric.value)) {
          targetCluster.verifiedMetrics.push(newMetric);
        }
      }

      // Phase 7: Calculate Source Weight Confidence
      targetCluster.score = this.calculateClusterConfidence(targetCluster);

      // Populate compatibility fields
      targetCluster.signalStrength = targetCluster.score;
      targetCluster.confidence = targetCluster.score;
      targetCluster.category = targetCluster.eventType;
      targetCluster.sources = targetCluster.confirmedBySources;
      targetCluster.status = targetCluster.sourcesCount > 1 ? 'Developing' : 'Breaking';
      targetCluster.articleIds = targetCluster.articles.map(a => a.id);

      // Phase 13: Internal Debug Update
      targetCluster.internalDebug = {
        clusterId: targetCluster.id,
        matchedArticlesCount: targetCluster.articles.length,
        similarityScore: Math.round(clusterMatch.similarity * 100),
        primarySource: targetCluster.firstPublisher,
        supportingSources: targetCluster.confirmedBySources.filter(s => s !== targetCluster.firstPublisher),
        totalConfidence: targetCluster.score,
        mergeDecision: 'MERGED_INTO_EXISTING',
        publisherTimeline: [...targetCluster.sourceTimeline]
      };

      // Ensure F&O flag is retained
      targetCluster.isFnO = targetCluster.isFnO || isFnO;

      return { cluster: targetCluster, relation: 'MERGED' };
    }

    // 5. CREATE NEW STORY CLUSTER
    const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const initialTimelineItem: SourceTimelineItem = {
      publisher: sourceEval.sourceName,
      timestamp: formattedTime,
      rawTime: articleTime,
      headline: article.title,
      sourceConfidence: sourceEval.confidenceScore
    };

    const newCluster: StoryCluster = {
      id: clusterId,
      title: article.title,
      summary: article.summary || article.description || article.title,
      eventCategory: eventClassification.eventType,
      eventType: eventClassification.eventType,
      symbols: detectedSymbols,
      companyNames: detectedCompanyNames,
      isFnO,
      score: sourceEval.confidenceScore,
      sourcesCount: 1,
      firstPublisher: sourceEval.sourceName,
      latestPublisher: sourceEval.sourceName,
      firstPublisherTime: formattedTime,
      latestPublisherTime: formattedTime,
      timeDifferenceText: 'Single Source',
      confirmedBySources: [sourceEval.sourceName],
      sourceTimeline: [initialTimelineItem],
      verifiedMetrics: eventClassification.metrics,
      articles: [article],
      canonicalArticle: article,
      createdAt: articleTime,
      updatedAt: articleTime,
      internalDebug: {
        clusterId,
        matchedArticlesCount: 1,
        similarityScore: 100,
        primarySource: sourceEval.sourceName,
        supportingSources: [],
        totalConfidence: sourceEval.confidenceScore,
        mergeDecision: 'CREATED_NEW',
        publisherTimeline: [initialTimelineItem]
      }
    };

    // Calculate initial confidence
    newCluster.score = this.calculateClusterConfidence(newCluster);

    // Populate compatibility properties
    newCluster.signalStrength = newCluster.score;
    newCluster.confidence = newCluster.score;
    newCluster.category = newCluster.eventType;
    newCluster.sources = newCluster.confirmedBySources;
    newCluster.status = 'Breaking';
    newCluster.firstSeen = formattedTime;
    newCluster.articleIds = [article.id];
    newCluster.urgency = isFnO ? 'HIGH' : 'MEDIUM';
    newCluster.marketImpact = 'NEUTRAL';

    // Save to cluster map and index by symbol for fast lookup (<2ms)
    this.clusters.set(clusterId, newCluster);
    for (const sym of detectedSymbols) {
      if (!this.symbolClusterIndex.has(sym)) {
        this.symbolClusterIndex.set(sym, new Set());
      }
      this.symbolClusterIndex.get(sym)!.add(clusterId);
    }

    // Phase 10: Notification Check for NEW Clusters
    NotificationService.getInstance().isEligible(article);

    return { cluster: newCluster, relation: 'NEW_CLUSTER' };
  }

  /**
   * Phase 3 & 4: Fast similarity matching engine (<5ms duplicate detection).
   */
  private findMatchingCluster(
    title: string,
    summary: string,
    symbols: string[],
    eventType: EventType,
    metrics: ExtractedFinancialMetric[],
    articleTime: number
  ): { cluster: StoryCluster | null; similarity: number } {
    let bestCluster: StoryCluster | null = null;
    let highestSimilarity = 0;

    // Filter candidate clusters by symbols if available, else check recent clusters
    const candidateClusterIds = new Set<string>();
    if (symbols.length > 0) {
      for (const sym of symbols) {
        const set = this.symbolClusterIndex.get(sym);
        if (set) {
          set.forEach(id => candidateClusterIds.add(id));
        }
      }
    } else {
      // Look through clusters created within the last 48 hours
      this.clusters.forEach((cluster, id) => {
        if (Math.abs(articleTime - cluster.createdAt) <= 48 * 3600 * 1000) {
          candidateClusterIds.add(id);
        }
      });
    }

    const titleTokens = this.tokenize(title);

    for (const cid of candidateClusterIds) {
      const cluster = this.clusters.get(cid);
      if (!cluster) continue;

      // Rule: Must be within 48 hours (Phase 4 requirement)
      if (Math.abs(articleTime - cluster.createdAt) > 48 * 3600 * 1000) {
        continue;
      }

      // Event type check bonus
      const sameEventType = cluster.eventType === eventType && eventType !== 'General Market News';

      // Title Jaccard / Token Similarity
      const clusterTitleTokens = this.tokenize(cluster.title);
      const jaccardSim = this.calculateJaccardSimilarity(titleTokens, clusterTitleTokens);

      // Financial metric overlap check
      let metricOverlap = false;
      for (const m of metrics) {
        if (cluster.verifiedMetrics.some(vm => vm.value === m.value)) {
          metricOverlap = true;
          break;
        }
      }

      // Same symbol match
      const symbolMatch = symbols.some(s => cluster.symbols.includes(s));

      // Composite Similarity Score Calculation
      let compositeScore = jaccardSim;

      if (symbolMatch && sameEventType) {
        // High confidence match: Same Company + Same Event Type (e.g. Airtel Q3 Results)
        compositeScore = 0.75 + (metricOverlap ? 0.15 : 0) + (jaccardSim * 0.25);
      } else {
        if (sameEventType) compositeScore += 0.20;
        if (metricOverlap) compositeScore += 0.25;
        if (symbolMatch) compositeScore += 0.25;
      }

      if (compositeScore > highestSimilarity) {
        highestSimilarity = compositeScore;
        bestCluster = cluster;
      }
    }

    return { cluster: bestCluster, similarity: highestSimilarity };
  }

  /**
   * Phase 7: Source Weight Confidence Calculation.
   * Boosts score if reported by multiple independent high-tier sources.
   * Reduces confidence if reported by only single unknown source.
   */
  private calculateClusterConfidence(cluster: StoryCluster): number {
    const primaryEval = SourcePriorityEngine.evaluateSource(cluster.firstPublisher);
    let baseScore = primaryEval.confidenceScore;

    // Multi-source confirmation bonus
    const confirmedCount = cluster.confirmedBySources.length;
    if (confirmedCount > 1) {
      baseScore += Math.min(15, (confirmedCount - 1) * 4); // +4% for each additional source up to +15%
    }

    // High tier source combination bonus (e.g., Reuters + Bloomberg, or NSE Filing + ET)
    const hasFiling = cluster.confirmedBySources.some(s => s.includes('NSE') || s.includes('BSE') || s.includes('SEBI') || s.includes('Filing'));
    const hasTier1 = cluster.confirmedBySources.some(s => ['Reuters', 'Bloomberg', 'Economic Times', 'Moneycontrol', 'LiveMint'].includes(s));

    if (hasFiling && hasTier1) {
      baseScore += 5;
    }

    // Single low-tier source penalty
    if (confirmedCount === 1 && primaryEval.confidenceScore < 80) {
      baseScore -= 10;
    }

    return Math.min(100, Math.max(10, Math.round(baseScore)));
  }

  private tokenize(text: string): Set<string> {
    const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const tokens = clean.split(/\s+/).filter(t => t.length > 2);
    return new Set(tokens);
  }

  private calculateJaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    a.forEach(token => {
      if (b.has(token)) intersection++;
    });
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Phase 12: AI Preparation Payload Generator
   */
  public getAIPreparedClusterPayload(clusterId: string) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;

    return {
      clusterId: cluster.id,
      headline: cluster.title,
      eventType: cluster.eventType,
      symbols: cluster.symbols,
      companyNames: cluster.companyNames,
      mergedFacts: cluster.articles.map(a => `${a.publisher}: ${a.title}. ${a.summary || a.description || ''}`),
      verifiedMetrics: cluster.verifiedMetrics,
      confirmedSources: cluster.confirmedBySources,
      totalSourcesCount: cluster.sourcesCount,
      sourceChronology: cluster.sourceTimeline.map(t => `${t.timestamp} - ${t.publisher}: "${t.headline}"`),
      overallConfidenceScore: cluster.score
    };
  }

  public getClusters(): StoryCluster[] {
    return Array.from(this.clusters.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getCluster(id: string): StoryCluster | null {
    return this.clusters.get(id) || null;
  }

  public clear(): void {
    this.clusters.clear();
    this.symbolClusterIndex.clear();
  }
}
