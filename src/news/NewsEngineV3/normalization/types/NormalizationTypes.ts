/**
 * ATHENA NEWS ENGINE V3 — NORMALIZATION TYPES & CONTRACTS
 * 
 * Strict type definitions for Phase 3 Universal Normalization Engine.
 * Ensures clean separation from parsing, classification, and AI reasoning.
 */

import { V3PublisherId } from '../../types/V3Types';

export interface NormalizedParagraph {
  id: string;
  index: number;
  text: string;
  wordCount: number;
  charCount: number;
  hash: string;
}

export interface NormalizedSentence {
  id: string;
  paragraphIndex: number;
  indexInParagraph: number;
  globalIndex: number;
  text: string;
  protectedTokens: string[];
  hash: string;
}

export interface NormalizedCompany {
  name: string;
  ticker: string;
  exchange: 'BSE' | 'NSE' | 'NASDAQ' | 'NYSE' | 'UNKNOWN';
  sector: string;
  industry: string;
  confidence: number; // 0 - 100
  isPrimary?: boolean;
}

export interface NormalizedCurrency {
  originalText: string;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'OTHER';
  rawAmount: number;
  unitMultiplier: number;
  numericValueCr: number; // Normalized into Crores
  numericValueMn: number; // Normalized into Millions
  standardizedDisplay: string;
}

export interface NormalizedMetadata {
  publisher: string;
  publisherId: V3PublisherId;
  title: string;
  subtitle?: string;
  author?: string;
  publishedAt: string; // ISO 8601
  modifiedAt?: string; // ISO 8601
  displayDate: string; // Original display format e.g. "Aug 7, 2026, 2:15 PM IST"
  category?: string;
  tags: string[];
  sourceUrl: string;
  canonicalUrl: string;
  language: string; // e.g. "en"
}

export interface NormalizedHashes {
  rawHash: string;
  normalizedHash: string;
  paragraphHashes: string[];
  sentenceHashes: string[];
}

export interface NormalizedDocument {
  documentId: string;
  publisherId: V3PublisherId;
  publisherName: string;
  canonicalUrl: string;
  sourceUrl: string;
  title: string;
  subtitle?: string;
  companies: NormalizedCompany[];
  primaryCompany?: NormalizedCompany;
  currencies: NormalizedCurrency[];
  category?: string;
  language: string;
  paragraphs: NormalizedParagraph[];
  sentences: NormalizedSentence[];
  plainText: string;
  metadata: NormalizedMetadata;
  hashes: NormalizedHashes;
  wordCount: number;
  characterCount: number;
  processingTimeMs: number;
  normalizedAt: string;
}

export interface NormalizationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  noiseRatio: number;
  sentenceCount: number;
  paragraphCount: number;
  unreadableEncoding?: boolean;
}
