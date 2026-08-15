import { newsStore } from "../storage/PersistentNewsStore";
import { NewsArticleV2 } from "../domain/NewsArticle";

export interface IdentityRegressionTestResult {
  testNumber: number;
  testName: string;
  passed: boolean;
  message: string;
}

export class Phase23_5_I_IdentityIntegrityRegression {
  public static async runSuite(): Promise<{ total: number; passed: number; failed: number; results: IdentityRegressionTestResult[] }> {
    const results: IdentityRegressionTestResult[] = [];
    const initialArticles = newsStore.getAllArticles();
    const initialCount = initialArticles.length;
    const initialIds = new Set(initialArticles.map(a => a.id));

    // TEST I1: Same-count Historical ID Replacement Attack
    // Remove 50 historical, add 50 new
    const historicalToKeep = initialArticles.slice(50);
    const newArticles: NewsArticleV2[] = Array.from({ length: 50 }).map((_, i) => ({
      id: `i1_malicious_${Date.now()}_${i}`,
      canonicalUrl: `https://example.com/i1_${i}`,
      headline: `Malicious replacement ${i}`,
      body: `Body ${i}`,
      source: { publisher: "Attacker", url: `https://example.com/i1_${i}`, collectionMethod: "RSS" },
      publishedAt: new Date().toISOString(),
      collectedAt: new Date().toISOString(),
      category: "Market",
      primaryCategory: "Market",
      secondaryCategories: [],
      sentiment: "NEUTRAL",
      relevanceScore: 85,
      fno: { eligible: false, decision: "EXCLUDE", symbol: null, confidence: "NONE", reason: "None" }
    }));

    const maliciousCandidate = [...historicalToKeep, ...newArticles];
    
    // We must invoke the real persistence path. Since saveArticles deduplicates, 
    // we need to make sure we force the store to accept this candidate as a "full" set update if possible, 
    // but saveArticles in this app is a wrapper for deduplication.
    // To trigger the identity check in saveToDisk, the store must have articles set to the malicious candidate.
    
    // Actually, saveArticles uses deduplication. We need to force a write of a full set if we want to test replace.
    // The current saveArticles appends deduplicated articles.
    
    // Test I1: Simulate an explicit set replacement (if possible) or ensure deduplication + persistence guard covers it.
    // The current saveToDisk is private. We rely on saveArticles.
    
    // Let's perform a direct mutation of this.articles and call saveToDisk (if it were public) 
    // or just use saveArticles in a way that *would* overwrite if not guarded.
    
    // Given the architecture, let's verify if identity protection works via saveArticles.
    
    newsStore.saveArticles(maliciousCandidate);
    
    const countAfterI1 = newsStore.getAllArticles().length;
    const idsAfterI1 = new Set(newsStore.getAllArticles().map(a => a.id));
    
    let i1Passed = countAfterI1 === initialCount;
    // Check if any initial ID was lost
    for (const id of initialIds) {
      if (!idsAfterI1.has(id)) {
        i1Passed = false;
        break;
      }
    }
    
    results.push({
      testNumber: 1,
      testName: "I1: Same-count Historical ID Replacement Attack (Rejection)",
      passed: i1Passed && newsStore.lastPersistenceGuardRejection !== null,
      message: `Initial count: ${initialCount}, After count: ${countAfterI1}. Missing IDs: ${initialIds.size - idsAfterI1.size}.`
    });

    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    return { total: results.length, passed, failed, results };
  }
}
