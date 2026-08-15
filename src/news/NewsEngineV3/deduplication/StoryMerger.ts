/**
 * ATHENA NEWS ENGINE V3 — STORY MERGER
 * 
 * Merges a new NormalizedDocument into an existing StoryCluster while preserving:
 * - All financial metrics (Crores/Millions)
 * - All unique executive quotes and broker opinions
 * - All dates, sources, canonical URLs, and full timelines
 * - Deduplicated paragraphs and updated verification scores
 */

import { NormalizedDocument, NormalizedParagraph, NormalizedCompany, NormalizedCurrency } from '../normalization/types/NormalizationTypes';
import { StoryCluster, TimelineEntry, MatchType } from './types/DeduplicationTypes';
import { VerificationEngine } from './VerificationEngine';

export class StoryMerger {
  /**
   * Merges a NormalizedDocument into a StoryCluster and returns the updated cluster.
   */
  public static mergeIntoCluster(
    cluster: StoryCluster,
    doc: NormalizedDocument,
    matchType: MatchType,
    similarityScore: number
  ): StoryCluster {
    const updated = { ...cluster };

    // 1. Add document to cluster documents list
    updated.documents = [...updated.documents, doc];

    // 2. Add publisher to supporting publishers if not already present
    if (!updated.supportingPublishers.includes(doc.publisherName)) {
      updated.supportingPublishers = [...updated.supportingPublishers, doc.publisherName];
    }

    // 3. Add to Cluster Sources
    updated.sources.push({
      documentId: doc.documentId,
      publisher: doc.publisherName,
      publisherId: doc.publisherId,
      canonicalUrl: doc.canonicalUrl,
      sourceUrl: doc.sourceUrl,
      title: doc.title,
      publishedAt: doc.metadata.publishedAt,
      similarityScore,
      matchType
    });

    // 4. Merge Companies and Tickers (never lose companies)
    updated.companies = this.mergeCompanies(updated.companies, doc.companies);
    updated.tickers = Array.from(new Set(updated.companies.map(c => c.ticker)));

    // 5. Merge Currencies & Financial Metrics (never lose metrics)
    updated.mergedCurrencies = this.mergeCurrencies(updated.mergedCurrencies, doc.currencies);

    // 6. Merge Paragraphs (deduplicate identical paragraphs by hash)
    updated.mergedParagraphs = this.mergeParagraphs(updated.mergedParagraphs, doc.paragraphs);

    // 7. Update Canonical Headline (prefer official filing or longer informative headline)
    if (this.shouldUpdateCanonicalHeadline(cluster, doc)) {
      updated.canonicalHeadline = doc.title;
      updated.primaryPublisher = doc.publisherName;
      updated.primaryPublisherId = doc.publisherId;
    }

    // 8. Append Timeline Entry
    let entryType: TimelineEntry['entryType'] = 'UPDATE';
    if (matchType === 'CORRECTION') entryType = 'CORRECTION';
    else if (matchType === 'BREAKING_NEWS_UPDATE') entryType = 'BREAKING';
    else if (matchType === 'EXACT' || matchType === 'NEAR_DUPLICATE') entryType = 'LATEST_VERSION';

    const timelineEntry: TimelineEntry = {
      id: `TL_${doc.documentId}`,
      timestamp: doc.metadata.publishedAt,
      entryType,
      publisher: doc.publisherName,
      publisherId: doc.publisherId,
      sourceUrl: doc.sourceUrl,
      headline: doc.title,
      summaryDelta: doc.paragraphs[0]?.text.slice(0, 150),
      documentId: doc.documentId
    };

    updated.mergedTimeline = [...updated.mergedTimeline, timelineEntry].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 9. Recalculate Verification Score
    const allPublisherIds = updated.sources.map(s => s.publisherId);
    updated.verificationScore = VerificationEngine.calculateVerificationScore(allPublisherIds);
    updated.verificationCount = updated.verificationScore.publisherCount;

    // 10. Update Confidence & Metadata
    updated.confidence = Math.round((updated.verificationScore.score * 0.6) + (similarityScore * 0.4));
    updated.updatedAt = new Date().toISOString();
    updated.metadata = {
      ...updated.metadata,
      lastUpdatedAt: doc.metadata.publishedAt,
      totalArticles: updated.documents.length,
      mergeCount: updated.metadata.mergeCount + 1,
      isFilingBacked: updated.verificationScore.hasOfficialExchangeFiling
    };

    return updated;
  }

  private static mergeCompanies(existing: NormalizedCompany[], incoming: NormalizedCompany[]): NormalizedCompany[] {
    const map = new Map<string, NormalizedCompany>();
    existing.forEach(c => map.set(c.ticker, c));
    incoming.forEach(c => {
      if (!map.has(c.ticker) || c.confidence > map.get(c.ticker)!.confidence) {
        map.set(c.ticker, c);
      }
    });
    return Array.from(map.values());
  }

  private static mergeCurrencies(existing: NormalizedCurrency[], incoming: NormalizedCurrency[]): NormalizedCurrency[] {
    const map = new Map<string, NormalizedCurrency>();
    existing.forEach(c => map.set(c.standardizedDisplay, c));
    incoming.forEach(c => {
      if (!map.has(c.standardizedDisplay)) {
        map.set(c.standardizedDisplay, c);
      }
    });
    return Array.from(map.values());
  }

  private static mergeParagraphs(existing: NormalizedParagraph[], incoming: NormalizedParagraph[]): NormalizedParagraph[] {
    const existingHashes = new Set(existing.map(p => p.hash));
    const merged = [...existing];

    let idxCounter = existing.length;
    incoming.forEach(p => {
      if (!existingHashes.has(p.hash)) {
        merged.push({
          ...p,
          id: `PARA_MERGED_${idxCounter + 1}`,
          index: idxCounter
        });
        existingHashes.add(p.hash);
        idxCounter++;
      }
    });

    return merged;
  }

  private static shouldUpdateCanonicalHeadline(cluster: StoryCluster, incomingDoc: NormalizedDocument): boolean {
    // Priority 1: Official Exchange Filing replaces non-official headline
    if (['NSE', 'BSE', 'COMPANY_FILING'].includes(incomingDoc.publisherId) && !cluster.metadata.isFilingBacked) {
      return true;
    }
    // Priority 2: Breaking news / correction headline update
    if (incomingDoc.title.toLowerCase().includes('breaking') || incomingDoc.title.toLowerCase().includes('correction')) {
      return true;
    }
    // Priority 3: Longer informative headline if incoming has more words
    if (incomingDoc.title.split(' ').length > cluster.canonicalHeadline.split(' ').length + 3) {
      return true;
    }

    return false;
  }
}
