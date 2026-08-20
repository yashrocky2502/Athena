/**
 * ATHENA NEWS ENGINE — STAGE 7.5 FUTURE ADAPTER SKELETONS
 * Non-mandatory interface abstractions for future document extraction, source discovery, and local AI.
 */

import { ExtractedArticle } from '../types/NewsSummary';

export interface UnstructuredDocumentExtractor {
  extractDocument(buffer: Buffer, mimeType: string): Promise<ExtractedArticle>;
  isAvailable(): boolean;
}

export interface SourceDiscoveryService {
  discoverFeeds(topic: string): Promise<string[]>;
}

export interface RSSHubSourceProvider {
  fetchRSSHubFeed(route: string): Promise<any[]>;
  isAvailable(): boolean;
}

export interface SearXNGSourceProvider {
  searchMeta(query: string): Promise<any[]>;
  isAvailable(): boolean;
}

export interface LocalAIProvider {
  generateLocal(prompt: string): Promise<string>;
  isAvailable(): boolean;
}
