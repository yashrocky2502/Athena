/**
 * ATHENA NEWS ENGINE — STAGE 7.4 PUBLISHER PROFILE MANAGER
 * Learns runtime extraction performance per publisher domain.
 */

import { PublisherProfile } from '../types/NewsSummary';

export class PublisherProfileManager {
  private static instance: PublisherProfileManager;
  private profiles: Map<string, PublisherProfile> = new Map();

  private constructor() {}

  public static getInstance(): PublisherProfileManager {
    if (!PublisherProfileManager.instance) {
      PublisherProfileManager.instance = new PublisherProfileManager();
    }
    return PublisherProfileManager.instance;
  }

  public getProfile(domain: string): PublisherProfile | null {
    if (!domain) return null;
    const cleanDomain = this.normalizeDomain(domain);
    return this.profiles.get(cleanDomain) || null;
  }

  public recordResult(
    domain: string,
    extractorName: string,
    qualityScore: number,
    success: boolean,
    failureReason?: string
  ): PublisherProfile {
    const cleanDomain = this.normalizeDomain(domain);
    let profile = this.profiles.get(cleanDomain);

    if (!profile) {
      profile = {
        domain: cleanDomain,
        preferredExtractor: extractorName,
        fallbackExtractor: 'JinaReaderExtractor',
        averageQuality: qualityScore,
        successRate: success ? 100 : 0,
        jsRequired: false,
        totalExtractions: 1,
        failedExtractions: success ? 0 : 1,
        lastFailureReason: failureReason,
        lastSuccessfulExtraction: success ? new Date().toISOString() : undefined
      };
    } else {
      profile.totalExtractions += 1;
      if (!success) {
        profile.failedExtractions += 1;
        profile.lastFailureReason = failureReason;
      } else {
        profile.lastSuccessfulExtraction = new Date().toISOString();
      }

      profile.successRate = Math.round(
        ((profile.totalExtractions - profile.failedExtractions) / profile.totalExtractions) * 100
      );

      // Running average for quality
      profile.averageQuality = Math.round(
        (profile.averageQuality * (profile.totalExtractions - 1) + qualityScore) / profile.totalExtractions
      );

      // If Trafilatura repeatedly fails, switch preferredExtractor to Crawl4AI or JinaReader
      if (success && qualityScore > 75) {
        profile.preferredExtractor = extractorName;
      } else if (!success && profile.failedExtractions >= 2) {
        profile.jsRequired = true;
        profile.preferredExtractor = 'Crawl4AIExtractor';
      }
    }

    this.profiles.set(cleanDomain, profile);
    return profile;
  }

  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0];
  }
}
