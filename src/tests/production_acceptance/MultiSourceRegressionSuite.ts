import { NewsClassifier } from '../../news/NewsEngine/Classifier';
import { NewsEngineV3 } from '../../news/NewsEngineV3/core/NewsEngineV3';
import { CollectorRegistry } from '../../news/NewsEngineV3/collectorRegistry/CollectorRegistry';

export interface SuiteCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class MultiSourceRegressionSuite {
  public static async runAllChecks(): Promise<{
    passed: boolean;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    results: SuiteCheckResult[];
  }> {
    const results: SuiteCheckResult[] = [];

    // Check 1: API Feed Endpoint Check
    try {
      const res = await fetch('http://localhost:3000/api/v3/news/feed');
      if (!res.ok) {
        results.push({
          checkName: 'API Feed HTTP Status',
          passed: false,
          message: `HTTP Status expected 200, got ${res.status}`
        });
      } else {
        const data = await res.json();
        const articles = data.articles || [];
        if (data.status === 'success' && articles.length > 0) {
          results.push({
            checkName: 'API Feed Availability',
            passed: true,
            message: `Feed online with ${articles.length} articles`
          });

          // Check 2: Multi-Publisher Diversity
          const pubDist: Record<string, number> = {};
          articles.forEach((a: any) => {
            pubDist[a.publisher || 'Unknown'] = (pubDist[a.publisher || 'Unknown'] || 0) + 1;
          });
          const distinctPublishers = Object.keys(pubDist).length;

          if (distinctPublishers > 1) {
            results.push({
              checkName: 'Multi-Source Publisher Diversity',
              passed: true,
              message: `Multi-source feed verified across ${distinctPublishers} distinct publishers`,
              details: pubDist
            });
          } else {
            results.push({
              checkName: 'Multi-Source Publisher Diversity',
              passed: false,
              message: `Single publisher detected (${Object.keys(pubDist)[0] || 'None'}). Diversity check failed!`,
              details: pubDist
            });
          }

          // Check 3: Frontend/API Parity Check
          const grouped = NewsClassifier.groupArticlesByCategory(articles);
          const frontendAllCount = grouped['All']?.length || 0;
          if (frontendAllCount === articles.length) {
            results.push({
              checkName: 'Frontend/API Article Parity',
              passed: true,
              message: `Parity verified: API (${articles.length}) === Frontend All (${frontendAllCount})`
            });
          } else {
            results.push({
              checkName: 'Frontend/API Article Parity',
              passed: false,
              message: `Parity mismatch: API (${articles.length}) !== Frontend All (${frontendAllCount})`
            });
          }

          // Check 4: ID Uniqueness & Non-Collision
          const idSet = new Set(articles.map((a: any) => a.id));
          if (idSet.size === articles.length) {
            results.push({
              checkName: 'Article ID Uniqueness',
              passed: true,
              message: `All ${articles.length} article IDs are unique (0 duplicates)`
            });
          } else {
            results.push({
              checkName: 'Article ID Uniqueness',
              passed: false,
              message: `Duplicate IDs detected! ${articles.length - idSet.size} duplicate IDs found.`
            });
          }

          // Check 5: Publisher Attribution Safety
          const unknownPubs = articles.filter((a: any) => !a.publisher || a.publisher === 'FINANCIAL_NEWS' || a.publisher === 'Unknown');
          if (unknownPubs.length === 0) {
            results.push({
              checkName: 'Publisher Attribution Safety',
              passed: true,
              message: `100% of articles have valid, explicit publisher attributions`
            });
          } else {
            results.push({
              checkName: 'Publisher Attribution Safety',
              passed: false,
              message: `${unknownPubs.length} articles have invalid/generic publisher attributions`
            });
          }

          // Check 6: Dynamic Feed Sizing (No 10-Item Hard Limit)
          if (articles.length > 10) {
            results.push({
              checkName: 'Dynamic Feed Sizing (No Hard Truncation)',
              passed: true,
              message: `Feed depth is ${articles.length} items (no 10-item truncation limit)`
            });
          } else {
            results.push({
              checkName: 'Dynamic Feed Sizing (No Hard Truncation)',
              passed: false,
              message: `Feed truncated at ${articles.length} items. Check for hard limits.`
            });
          }

        } else {
          results.push({
            checkName: 'API Feed Availability',
            passed: false,
            message: `Feed returned 0 articles or failed status`
          });
        }
      }
    } catch (err: any) {
      results.push({
        checkName: 'API Feed Endpoint Check',
        passed: false,
        message: `Failed to fetch /api/v3/news/feed: ${err?.message || err}`
      });
    }

    // Check 7: Production Snapshot Check
    try {
      const snapRes = await fetch('http://localhost:3000/api/v3/news/production-snapshot');
      if (snapRes.ok) {
        const snap = await snapRes.json();
        if (snap.status === 'success' && snap.snapshot && snap.snapshot.totalArticles > 0) {
          results.push({
            checkName: 'Production Snapshot Telemetry',
            passed: true,
            message: `Snapshot verified with ${snap.snapshot.totalArticles} stored stories and ${snap.snapshot.publishers?.length} publishers`
          });
        } else {
          results.push({
            checkName: 'Production Snapshot Telemetry',
            passed: false,
            message: `Snapshot failed or returned empty payload`
          });
        }
      } else {
        results.push({
          checkName: 'Production Snapshot Telemetry',
          passed: false,
          message: `Production snapshot returned status ${snapRes.status}`
        });
      }
    } catch (err: any) {
      results.push({
        checkName: 'Production Snapshot Telemetry',
        passed: false,
        message: `Snapshot endpoint error: ${err?.message || err}`
      });
    }

    // Check 8: AI Failure Isolation Check
    try {
      const dummyRawArticle = {
        title: "MultiSource Regression Test Synthetic Story",
        description: "Testing AI isolation boundary in news ingestion pipeline.",
        content: "Synthetic content to ensure pipeline completes without external AI and contains sufficient words to pass the quality gate verification check safely without sparse content errors.",
        rawBody: "Synthetic content to ensure pipeline completes without external AI and contains sufficient words to pass the quality gate verification check safely without sparse content errors.",
        body: "Synthetic content to ensure pipeline completes without external AI and contains sufficient words to pass the quality gate verification check safely without sparse content errors.",
        rawContent: "Synthetic content to ensure pipeline completes without external AI and contains sufficient words to pass the quality gate verification check safely without sparse content errors.",
        sourceUrl: "https://example.com/regression-test-story",
        publisher: "LiveMint",
        publisherId: "LIVE_MINT",
        publishedAt: new Date().toISOString()
      };
      
      const processed = await NewsEngineV3.getInstance().processArticle(dummyRawArticle as any);
      if (processed && processed.storyId) {
        results.push({
          checkName: 'AI Failure Isolation Boundary',
          passed: true,
          message: `Article processed and stored successfully without requiring active LLM completion`
        });
      } else {
        results.push({
          checkName: 'AI Failure Isolation Boundary',
          passed: false,
          message: `Article processing failed during AI isolation test`
        });
      }
    } catch (err: any) {
      results.push({
        checkName: 'AI Failure Isolation Boundary',
        passed: false,
        message: `AI isolation boundary test threw exception: ${err?.message || err}`
      });
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return {
      passed: failedCount === 0,
      totalChecks: results.length,
      passedChecks: passedCount,
      failedChecks: failedCount,
      results
    };
  }
}

// Auto-execution when run via CLI
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('MultiSourceRegressionSuite')) {
  MultiSourceRegressionSuite.runAllChecks().then(summary => {
    console.log('\n==================================================');
    console.log(' ATHENA NEWS V3 — MULTI-SOURCE REGRESSION SUITE');
    console.log('==================================================');
    summary.results.forEach(r => {
      const symbol = r.passed ? '🟢' : '🔴';
      console.log(`${symbol} [${r.checkName}]: ${r.message}`);
    });
    console.log('--------------------------------------------------');
    console.log(`TOTAL: ${summary.totalChecks} | PASSED: ${summary.passedChecks} | FAILED: ${summary.failedChecks}`);
    console.log('==================================================\n');
    if (!summary.passed) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Regression suite failed with error:', err);
    process.exit(1);
  });
}
