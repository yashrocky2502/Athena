/**
 * ATHENA NEWS ENGINE V3 — DEDUPLICATION & STORY CLUSTERING TYPES
 * 
 * Strict type definitions for Phase 4 Cross-Publisher Deduplication & Story Clustering Engine.
 * Operates purely on NormalizedDocument inputs to produce StoryCluster outputs.
 */

import { V3PublisherId } from '../../types/V3Types';
import {
  NormalizedDocument,
  NormalizedCompany,
  NormalizedCurrency,
  NormalizedParagraph
} from '../../normalization/types/NormalizationTypes';

export type MatchType =
  | 'EXACT'
  | 'NEAR_DUPLICATE'
  | 'PARTIAL_OVERLAP'
  | 'FOLLOW_UP'
  | 'UPDATE'
  | 'CORRECTION'
  | 'BREAKING_NEWS_UPDATE'
  | 'NO_MATCH';

export type ClusterType =
  | 'QUARTERLY_RESULTS'
  | 'BROKER_REPORT'
  | 'CORPORATE_ACTION'
  | 'IPO'
  | 'GOVERNMENT'
  | 'RBI'
  | 'SEBI'
  | 'M_AND_A'
  | 'MACRO'
  | 'COMMODITY'
  | 'FOREX'
  | 'CRYPTO'
  | 'GENERAL';

export type TrustLevel =
  | 'UNVERIFIED'
  | 'SINGLE_SOURCE'
  | 'MULTI_SOURCE_VERIFIED'
  | 'EXCHANGE_CONFIRMED';

export interface VerificationScore {
  score: number; // 0 - 100
  trustLevel: TrustLevel;
  verifiedSources: string[];
  publisherCount: number;
  hasOfficialExchangeFiling: boolean; // NSE, BSE, COMPANY_FILING
  hasTier1Media: boolean; // Reuters, ET, Moneycontrol, LiveMint, Business Standard
  breakdown: Record<string, number>;
}

export interface TimelineEntry {
  id: string;
  timestamp: string; // ISO 8601
  entryType: 'ORIGINAL' | 'UPDATE' | 'CORRECTION' | 'LATEST_VERSION' | 'BREAKING';
  publisher: string;
  publisherId: V3PublisherId;
  sourceUrl: string;
  headline: string;
  summaryDelta?: string;
  documentId: string;
}

export interface ClusterSource {
  documentId: string;
  publisher: string;
  publisherId: V3PublisherId;
  canonicalUrl: string;
  sourceUrl: string;
  title: string;
  publishedAt: string;
  similarityScore: number;
  matchType: MatchType;
}

export interface SimilarityMetrics {
  headlineSimilarity: number; // 0 - 1
  companyOverlapScore: number; // 0 - 1
  tickerOverlapScore: number; // 0 - 1
  entityOverlapScore: number; // 0 - 1
  financialMetricScore: number; // 0 - 1
  dateProximityScore: number; // 0 - 1
  categoryMatchScore: number; // 0 - 1
  paragraphSimilarity: number; // 0 - 1
  sentenceSimilarity: number; // 0 - 1
  documentHashMatch: boolean;
  normalizedHashMatch: boolean;
  compositeScore: number; // 0 - 100
}

export interface StoryCluster {
  clusterId: string;
  canonicalHeadline: string;
  title?: string;
  summary?: string;
  companies: NormalizedCompany[];
  tickers: string[];
  symbols?: string[];
  companyNames?: string[];
  eventType: ClusterType;
  eventCategory?: string;
  category?: string;
  isFnO?: boolean;
  score?: number;
  confirmedBySources?: any[];
  timeDifferenceText?: string;
  firstPublisher?: string;
  verifiedMetrics?: any[];
  sourceTimeline?: any[];
  internalDebug?: any;
  primaryPublisher: string;
  primaryPublisherId: V3PublisherId;
  supportingPublishers: string[];
  verificationCount: number;
  verificationScore: VerificationScore;
  mergedTimeline: TimelineEntry[];
  mergedParagraphs: NormalizedParagraph[];
  mergedCurrencies: NormalizedCurrency[];
  confidence: number; // 0 - 100
  sources: ClusterSource[];
  documents: NormalizedDocument[];
  createdAt: string;
  updatedAt: string;
  metadata: {
    firstSeenAt: string;
    lastUpdatedAt: string;
    totalArticles: number;
    mergeCount: number;
    quarterTag?: string; // e.g. "Q1 FY27"
    isFilingBacked: boolean;
  };
}

export interface ClusteringResult {
  action: 'CREATED_NEW_CLUSTER' | 'MERGED_INTO_CLUSTER' | 'UPDATED_TIMELINE' | 'REJECTED_FALSE_POSITIVE';
  cluster: StoryCluster;
  matchedClusterId?: string;
  matchType: MatchType;
  similarityMetrics?: SimilarityMetrics;
  processingTimeMs: number;
}

export interface ClusterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflictDetected: boolean;
  conflictReason?: string;
}
