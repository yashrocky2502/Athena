import { newsStore } from '../newsCoreV2/storage/PersistentNewsStore';
import { TelegramQualityGate, QualityGateResult } from '../news/NewsEngine/TelegramQualityGate';
import { TelegramNotificationPipeline } from '../news/NewsEngine/TelegramNotificationPipeline';
import { runTelegramQualityGateRegressionSuite } from '../news/NewsEngine/TelegramQualityGateRegression';
import { runTelegramRegressionSuite } from './telegramIntegrationRegression';

export interface AuditReport {
  totalEvaluated: number;
  immediateCount: number;
  digestPendingCount: number;
  noActionCount: number;
  suppressedCount: number;
  
  immediatePercent: number;
  digestPercent: number;
  noActionPercent: number;
  suppressedPercent: number;

  historicalExcluded: number;
  newlyEligible: number;
  duplicateSuppressed: number;

  bseTestResult: {
    found: boolean;
    headline?: string;
    decision?: string;
    reason?: string;
    passed: boolean;
  };

  topImmediate: any[];
  falsePositives: any[];
  missedAlerts: any[];

  burstAnalysis: {
    alertsPerMinute: number;
    alertsPerHour: number;
    circuitBreakerWouldActivate: boolean;
  };
}

export async function runLiveDatasetAudit(): Promise<AuditReport> {
  const articles = newsStore.getAllArticles();
  const pipeline = TelegramNotificationPipeline.getInstance();
  
  // Save current pipeline settings
  const originalWatermark = pipeline.getWatermark();
  const originalAuditMode = pipeline.getAuditMode();

  // For audit, we set watermark to a reasonable date (e.g., beginning of the dataset) to evaluate all recent articles
  // Let's find the oldest article date or use a standard watermark date
  // The user says: "Verify that articles predating Telegram notification activation are not considered newly arrived live alerts."
  // If we want to check backlog protection, we can set activation watermark to a middle date like Aug 13, 2026 00:00:00,
  // so some articles are historical and some are newly eligible!
  const auditWatermark = '2026-08-13T00:00:00.000Z'; 
  const auditWatermarkMs = new Date(auditWatermark).getTime();

  // Temporary clear cluster history for clean evaluation
  TelegramQualityGate.clearClusterHistory();

  let immediateCount = 0;
  let digestPendingCount = 0;
  let noActionCount = 0;
  let suppressedCount = 0;
  let historicalExcluded = 0;
  let newlyEligible = 0;
  let duplicateSuppressed = 0;

  const topImmediateCandidates: any[] = [];
  const falsePositiveCandidates: any[] = [];
  const missedAlertCandidates: any[] = [];

  let bseArticleFound = false;
  let bseArticleHeadline = '';
  let bseArticleDecision = '';
  let bseArticleReason = '';
  let bseTestPassed = false;

  // Track timestamps for burst protection analysis
  const immediateTimestamps: number[] = [];

  // Temporarily set pipeline to dry-run audit mode
  pipeline.setAuditMode(true);
  pipeline.setWatermark(auditWatermark);

  // Clear existing decisions in memory for a clean audit log
  // We'll populate it with the actual live evaluations!
  const evaluations: { article: any; evalResult: QualityGateResult }[] = [];

  for (const article of articles) {
    const articleTime = new Date(article.publishedAt || article.collectedAt).getTime();
    const isHistorical = articleTime < auditWatermarkMs;

    if (isHistorical) {
      historicalExcluded++;
    } else {
      newlyEligible++;
    }

    // Evaluate via Quality Gate directly (without pipeline suppression to get raw decision first)
    const evalResult = TelegramQualityGate.evaluate(article, {
      watermarkIso: auditWatermark,
      circuitBreakerActive: false
    });

    evaluations.push({ article, evalResult });

    if (evalResult.decision === 'IMMEDIATE') {
      immediateCount++;
      immediateTimestamps.push(articleTime);
    } else if (evalResult.decision === 'DIGEST_PENDING') {
      digestPendingCount++;
    } else if (evalResult.decision === 'SUPPRESSED') {
      suppressedCount++;
      if (evalResult.isDuplicateCluster) {
        duplicateSuppressed++;
      }
    } else {
      noActionCount++;
    }

    // Specific BSE Problem Test
    // "Q3 Results 2026: Over 170 Companies Including BSE, Zydus Life To Announce Earnings Today - Samco"
    if (article.headline && article.headline.includes('Over 170 Companies Including BSE')) {
      bseArticleFound = true;
      bseArticleHeadline = article.headline;
      
      // Do a secondary watermark-free evaluation to test the generic calendar logic
      const liveEval = TelegramQualityGate.evaluate(article, {
        watermarkIso: '2026-01-01T00:00:00.000Z'
      });
      
      bseArticleDecision = liveEval.decision;
      bseArticleReason = liveEval.reason;
      bseTestPassed = liveEval.decision === 'NO_ACTION' && 
                      liveEval.isGenericCalendar === true &&
                      !liveEval.optionsImpactSummary.includes('Suitable for theta decay') &&
                      liveEval.symbol === 'MARKET';
    }

    // Let's populate candidates
    if (evalResult.decision === 'IMMEDIATE') {
      topImmediateCandidates.push({
        articleId: article.id,
        company: article.fno?.symbol || 'UNKNOWN',
        symbol: evalResult.symbol,
        headline: article.headline,
        source: article.source?.publisher || 'Unknown',
        publishedTime: article.publishedAt,
        eventCategory: article.category,
        materiality: evalResult.materialityScore,
        fNoRelevance: evalResult.qualityScore,
        sentiment: article.sentiment,
        decisionReason: evalResult.reason,
        optionsImpactSummary: evalResult.optionsImpactSummary
      });

      // Search for potential False Positives
      // (patterns matching routine commentary, generic market roundups, mere stock watchlists, etc.)
      const isRoutineCommentary = /brokerage|shares rise|shares fall|gains \d+%|falls \d+%|stocks to watch|market roundup|market wrap|trading setup|early trade|analyst/i.test(article.headline) ||
                                  /block deal|bulk deal/i.test(article.headline) ||
                                  (!article.headline.includes('profit') && !article.headline.includes('revenue') && !article.headline.includes('order') && !article.headline.includes('acquire') && !article.headline.includes('merger') && evalResult.materialityScore < 65);

      if (isRoutineCommentary) {
        falsePositiveCandidates.push({
          articleId: article.id,
          company: article.fno?.symbol || 'UNKNOWN',
          symbol: evalResult.symbol,
          headline: article.headline,
          source: article.source?.publisher || 'Unknown',
          publishedTime: article.publishedAt,
          eventCategory: article.category,
          materiality: evalResult.materialityScore,
          fNoRelevance: evalResult.qualityScore,
          sentiment: article.sentiment,
          decisionReason: evalResult.reason,
          optionsImpactSummary: evalResult.optionsImpactSummary,
          whySuspicious: 'Triggers as IMMEDIATE but matches routine analyst commentary, watchlist, or minor daily price movement patterns.'
        });
      }
    } else if (evalResult.decision === 'NO_ACTION') {
      // Search for Missed Alerts (articles categorized as NO_ACTION but contain extremely material keywords)
      const hasMaterialKeywords = /earnings surprise|guidance raised|profit jumps|profit surges|net profit up|ebitda up|order win|secures contract|board approves dividend|rating upgrade/i.test(article.headline || '');
      const isFNoSymbol = article.fno?.eligible;

      if (hasMaterialKeywords && isFNoSymbol && evalResult.qualityScore < 50) {
        missedAlertCandidates.push({
          articleId: article.id,
          company: article.fno?.symbol || 'UNKNOWN',
          symbol: evalResult.symbol,
          headline: article.headline,
          source: article.source?.publisher || 'Unknown',
          publishedTime: article.publishedAt,
          eventCategory: article.category,
          materiality: evalResult.materialityScore,
          fNoRelevance: evalResult.qualityScore,
          sentiment: article.sentiment,
          decisionReason: evalResult.reason,
          whyMissed: 'Classified as NO_ACTION despite containing high-materiality earnings/contract surprise keywords and representing an eligible F&O symbol.'
        });
      }
    }
  }

  // Populate actual pipeline's decision history for the AlertsManager UI so it shows REAL live audit data!
  // To do this, we'll feed the top evaluations into the pipeline
  // Let's sort evaluations so the newest evaluations are fed last (and thus appear first in pipeline's unshifted list)
  const sortedEvals = [...evaluations].sort((a, b) => {
    return new Date(a.article.publishedAt || a.article.collectedAt).getTime() - 
           new Date(b.article.publishedAt || b.article.collectedAt).getTime();
  });

  // We process a subset of evaluations through pipeline to avoid extreme file bloating but still fill the 500 limit
  // Let's process the most recent 100 articles through processArticle to populate real live decisions
  const auditSubset = sortedEvals.slice(-120);
  for (const ev of auditSubset) {
    await pipeline.processArticle(ev.article);
  }

  // Sort top candidates by materiality and quality score descending
  const topImmediate = topImmediateCandidates
    .sort((a, b) => b.materiality - a.materiality || b.fNoRelevance - a.fNoRelevance)
    .slice(0, 20);

  const falsePositives = falsePositiveCandidates
    .sort((a, b) => a.materiality - b.materiality)
    .slice(0, 20);

  const missedAlerts = missedAlertCandidates
    .sort((a, b) => b.materiality - a.materiality)
    .slice(0, 20);

  // Burst analysis
  // Sort timestamps to calculate rates
  const sortedTimes = [...immediateTimestamps].sort((a, b) => a - b);
  let maxAlertsPerMinute = 0;
  let maxAlertsPerHour = 0;

  // Simple rolling window calculation
  for (let i = 0; i < sortedTimes.length; i++) {
    const t = sortedTimes[i];
    const minuteEnd = t + 60 * 1000;
    const hourEnd = t + 3600 * 1000;

    const countMin = sortedTimes.filter(ts => ts >= t && ts < minuteEnd).length;
    const countHour = sortedTimes.filter(ts => ts >= t && ts < hourEnd).length;

    if (countMin > maxAlertsPerMinute) maxAlertsPerMinute = countMin;
    if (countHour > maxAlertsPerHour) maxAlertsPerHour = countHour;
  }

  const burstAnalysis = {
    alertsPerMinute: maxAlertsPerMinute,
    alertsPerHour: maxAlertsPerHour,
    circuitBreakerWouldActivate: maxAlertsPerMinute >= 3 || maxAlertsPerHour >= 10
  };

  const totalEvaluated = articles.length;
  
  // Restore pipeline settings
  pipeline.setWatermark(originalWatermark);
  pipeline.setAuditMode(originalAuditMode);

  return {
    totalEvaluated,
    immediateCount,
    digestPendingCount,
    noActionCount,
    suppressedCount,
    immediatePercent: parseFloat(((immediateCount / totalEvaluated) * 100).toFixed(2)),
    digestPercent: parseFloat(((digestPendingCount / totalEvaluated) * 100).toFixed(2)),
    noActionPercent: parseFloat(((noActionCount / totalEvaluated) * 100).toFixed(2)),
    suppressedPercent: parseFloat(((suppressedCount / totalEvaluated) * 100).toFixed(2)),
    historicalExcluded,
    newlyEligible,
    duplicateSuppressed,
    bseTestResult: {
      found: bseArticleFound,
      headline: bseArticleHeadline,
      decision: bseArticleDecision,
      reason: bseArticleReason,
      passed: bseTestPassed
    },
    topImmediate,
    falsePositives,
    missedAlerts,
    burstAnalysis
  };
}
