/**
 * ATHENA NEWS ENGINE V3 — STORY CLUSTER ENGINE
 * 
 * Phase 4 Core Orchestrator:
 * Transforms NormalizedDocument instances into unified StoryClusters.
 * Handles duplicate detection, cross-publisher merging, event classification,
 * timeline construction, verification scoring, event publishing, and Telegram notifications.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';
import {
  StoryCluster,
  ClusteringResult,
  ClusterType,
  TimelineEntry,
  SimilarityMetrics
} from './types/DeduplicationTypes';
import { ClusterRepository } from './ClusterRepository';
import { DuplicateDetector, DetectionResult } from './DuplicateDetector';
import { StoryMerger } from './StoryMerger';
import { VerificationEngine } from './VerificationEngine';
import { ClusterValidator } from './ClusterValidator';
import { V3EventBus } from '../events/V3EventBus';
import { NotificationHub } from '../notificationHub/NotificationHub';
import { V3Logger } from '../logging/V3Logger';
import { V3Utils } from '../utils/V3Utils';

export class StoryClusterEngine {
  private repository = ClusterRepository.getInstance();
  private eventBus = V3EventBus.getInstance();
  private notificationHub = NotificationHub.getInstance();
  private logger = V3Logger.getInstance();

  /**
   * Processes a NormalizedDocument and clusters/merges it into a StoryCluster.
   */
  public async processDocument(doc: NormalizedDocument): Promise<ClusteringResult> {
    const startTime = Date.now();
    const correlationId = V3Utils.generateId('CORR');

    this.logger.info('StoryClusterEngine', `Processing doc ${doc.documentId} ("${doc.title}") for clustering`, { docId: doc.documentId }, correlationId);

    // 1. Fetch Candidate Clusters from Repository
    const tickers = doc.companies.map(c => c.ticker);
    const candidateClusters = this.repository.findCandidates(tickers);

    let bestMatch: DetectionResult | null = null;
    let highestScore = 0;

    // 2. Evaluate Candidates
    for (const candidate of candidateClusters) {
      const detection = DuplicateDetector.detectMatch(doc, candidate);
      if (detection.isDuplicate && detection.similarityMetrics.compositeScore > highestScore) {
        highestScore = detection.similarityMetrics.compositeScore;
        bestMatch = detection;
      }
    }

    // 3. Perform Merge if Match Found
    if (bestMatch && bestMatch.candidateCluster) {
      const matchedCluster = bestMatch.candidateCluster;
      const updatedCluster = StoryMerger.mergeIntoCluster(
        matchedCluster,
        doc,
        bestMatch.matchType,
        bestMatch.similarityMetrics.compositeScore
      );

      // Validate merged cluster
      const validation = ClusterValidator.validateCluster(updatedCluster);
      if (!validation.isValid) {
        this.logger.error('StoryClusterEngine', `Merge validation failed for cluster ${updatedCluster.clusterId}`, new Error('ValidationFailed'), { errors: validation.errors }, correlationId);

        await this.eventBus.publish({
          eventId: V3Utils.generateId('EVT'),
          type: 'MERGE_FAILED',
          priority: 'HIGH',
          timestamp: new Date().toISOString(),
          correlationId,
          payload: { docId: doc.documentId, clusterId: matchedCluster.clusterId, errors: validation.errors }
        });

        await this.notificationHub.dispatch({
          type: 'DEDUPLICATION',
          title: '❌ Merge Failed',
          message: `Failed to merge "${doc.title}" into Cluster ${matchedCluster.clusterId}.\nReason: ${validation.errors.join(', ')}`,
          priority: 'HIGH',
          targetChannelOverride: 'OPERATIONS',
          metadata: { docId: doc.documentId, clusterId: matchedCluster.clusterId }
        });

        // Fallback: Create new cluster if merge failed validation
        return this.createNewCluster(doc, startTime, correlationId);
      }

      // Save updated cluster in repository
      this.repository.saveCluster(updatedCluster);
      const processingTimeMs = Date.now() - startTime;

      // Publish Events
      await this.eventBus.publish({
        eventId: V3Utils.generateId('EVT'),
        type: 'DUPLICATE_DETECTED',
        priority: 'NORMAL',
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          docId: doc.documentId,
          clusterId: updatedCluster.clusterId,
          matchType: bestMatch.matchType,
          similarityScore: bestMatch.similarityMetrics.compositeScore
        }
      });

      await this.eventBus.publish({
        eventId: V3Utils.generateId('EVT'),
        type: 'STORY_UPDATED',
        priority: 'NORMAL',
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          clusterId: updatedCluster.clusterId,
          newPublisher: doc.publisherName,
          totalArticles: updatedCluster.documents.length,
          verificationScore: updatedCluster.verificationScore.score
        }
      });

      if (updatedCluster.verificationScore.score >= 90) {
        await this.eventBus.publish({
          eventId: V3Utils.generateId('EVT'),
          type: 'NEW_SOURCE_VERIFIED',
          priority: 'NORMAL',
          timestamp: new Date().toISOString(),
          correlationId,
          payload: {
            clusterId: updatedCluster.clusterId,
            verifiedSources: updatedCluster.verificationScore.verifiedSources,
            trustLevel: updatedCluster.verificationScore.trustLevel
          }
        });
      }

      // Dispatch Telegram Notifications
      await this.notificationHub.dispatch({
        type: 'DEDUPLICATION',
        title: `🔄 Merged: ${doc.publisherName}`,
        message: `Merged into Cluster [${updatedCluster.clusterId}]\nHeadline: "${updatedCluster.canonicalHeadline}"\n• Match Type: ${bestMatch.matchType}\n• Similarity Score: ${bestMatch.similarityMetrics.compositeScore}%\n• Verification Score: ${updatedCluster.verificationScore.score}/100 (${updatedCluster.verificationScore.trustLevel})\n• Sources: ${updatedCluster.supportingPublishers.join(', ')}`,
        priority: 'LOW',
        targetChannelOverride: 'DEVELOPERS',
        metadata: {
          clusterId: updatedCluster.clusterId,
          similarityScore: bestMatch.similarityMetrics.compositeScore,
          verificationScore: updatedCluster.verificationScore.score,
          matchType: bestMatch.matchType
        }
      });

      return {
        action: 'MERGED_INTO_CLUSTER',
        cluster: updatedCluster,
        matchedClusterId: updatedCluster.clusterId,
        matchType: bestMatch.matchType,
        similarityMetrics: bestMatch.similarityMetrics,
        processingTimeMs
      };
    }

    // 4. Create New Cluster if No Match Found
    return this.createNewCluster(doc, startTime, correlationId);
  }

  private async createNewCluster(doc: NormalizedDocument, startTime: number, correlationId: string): Promise<ClusteringResult> {
    const clusterId = `CLUST_${V3Utils.generateId('STORY')}`;
    const eventType = this.classifyClusterType(doc);
    const verificationScore = VerificationEngine.calculateVerificationScore([doc.publisherId]);

    const initialTimeline: TimelineEntry = {
      id: `TL_${doc.documentId}`,
      timestamp: doc.metadata.publishedAt,
      entryType: 'ORIGINAL',
      publisher: doc.publisherName,
      publisherId: doc.publisherId,
      sourceUrl: doc.sourceUrl,
      headline: doc.title,
      summaryDelta: doc.paragraphs[0]?.text.slice(0, 150),
      documentId: doc.documentId
    };

    const newCluster: StoryCluster = {
      clusterId,
      canonicalHeadline: doc.title,
      companies: doc.companies,
      tickers: doc.companies.map(c => c.ticker),
      eventType,
      primaryPublisher: doc.publisherName,
      primaryPublisherId: doc.publisherId,
      supportingPublishers: [doc.publisherName],
      verificationCount: 1,
      verificationScore,
      mergedTimeline: [initialTimeline],
      mergedParagraphs: doc.paragraphs,
      mergedCurrencies: doc.currencies,
      confidence: verificationScore.score,
      sources: [{
        documentId: doc.documentId,
        publisher: doc.publisherName,
        publisherId: doc.publisherId,
        canonicalUrl: doc.canonicalUrl,
        sourceUrl: doc.sourceUrl,
        title: doc.title,
        publishedAt: doc.metadata.publishedAt,
        similarityScore: 100,
        matchType: 'EXACT'
      }],
      documents: [doc],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        firstSeenAt: doc.metadata.publishedAt,
        lastUpdatedAt: doc.metadata.publishedAt,
        totalArticles: 1,
        mergeCount: 0,
        quarterTag: this.extractQuarterTag(doc.title, doc.plainText),
        isFilingBacked: verificationScore.hasOfficialExchangeFiling
      }
    };

    // Save to repository
    this.repository.saveCluster(newCluster);
    const processingTimeMs = Date.now() - startTime;

    // Publish CLUSTER_CREATED event
    await this.eventBus.publish({
      eventId: V3Utils.generateId('EVT'),
      type: 'CLUSTER_CREATED',
      priority: 'NORMAL',
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        clusterId,
        canonicalHeadline: newCluster.canonicalHeadline,
        publisher: doc.publisherName,
        eventType,
        tickers: newCluster.tickers
      }
    });

    // Telegram Notification
    await this.notificationHub.dispatch({
      type: 'DEDUPLICATION',
      title: `✨ New Cluster Created: ${doc.publisherName}`,
      message: `Cluster [${clusterId}]\nHeadline: "${newCluster.canonicalHeadline}"\n• Event Type: ${eventType}\n• Tickers: [${newCluster.tickers.join(', ')}]\n• Verification Score: ${verificationScore.score}/100\n• Latency: ${processingTimeMs}ms`,
      priority: 'LOW',
      targetChannelOverride: 'DEVELOPERS',
      metadata: { clusterId, eventType, verificationScore: verificationScore.score }
    });

    return {
      action: 'CREATED_NEW_CLUSTER',
      cluster: newCluster,
      matchType: 'EXACT',
      processingTimeMs
    };
  }

  private classifyClusterType(doc: NormalizedDocument): ClusterType {
    const text = `${doc.title} ${doc.plainText.slice(0, 500)}`.toLowerCase();

    if (/\b(q[1-4]|quarterly|pat|net profit|ebitda|revenue|financial results)\b/i.test(text)) return 'QUARTERLY_RESULTS';
    if (/\b(target price|buy|sell|hold|brokerage|upgrade|downgrade|retains|jefferies|goldman|motilal)\b/i.test(text)) return 'BROKER_REPORT';
    if (/\b(dividend|split|bonus|record date|ex-date|rights issue|buyback)\b/i.test(text)) return 'CORPORATE_ACTION';
    if (/\b(ipo|initial public offering|subscription|gmp|grey market|listing|issue price)\b/i.test(text)) return 'IPO';
    if (/\b(rbi|repo rate|monetary policy|mpc|reserve bank)\b/i.test(text)) return 'RBI';
    if (/\b(sebi|show cause|penalty|circular|listing regulations|insider trading)\b/i.test(text)) return 'SEBI';
    if (/\b(m&a|merger|acquisition|stake sale|buyout|takeover)\b/i.test(text)) return 'M_AND_A';
    if (/\b(gdp|inflation|cpi|iip|fiscal deficit|trade deficit)\b/i.test(text)) return 'MACRO';
    if (/\b(crude oil|brent|gold|silver|copper|commodities)\b/i.test(text)) return 'COMMODITY';
    if (/\b(rupee|usd\/inr|forex|dollar index)\b/i.test(text)) return 'FOREX';
    if (/\b(bitcoin|crypto|ethereum)\b/i.test(text)) return 'CRYPTO';
    if (/\b(government|cabinet|policy|subsidy|gst council)\b/i.test(text)) return 'GOVERNMENT';

    return 'GENERAL';
  }

  private extractQuarterTag(title: string, text: string): string | undefined {
    const combined = `${title} ${text.slice(0, 500)}`;
    const match = combined.match(/\b(Q[1-4]\s*(?:FY)?\d{2,4}|FY\d{2,4}\s*Q[1-4])\b/i);
    return match ? match[1].toUpperCase().replace(/\s+/g, '') : undefined;
  }
}
