import { TelegramNotificationService } from '../news/NewsEngine/TelegramNotificationService';
import { StoryIntelligenceEngine } from '../news/NewsEngine/StoryIntelligenceEngine';

export async function runAthenaV31TelegramPipelineTests() {
  console.log('================================================================');
  console.log('ATHENA V31 — TELEGRAM DEVELOPMENT INTELLIGENCE REGRESSION TESTS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      console.log(`✓ PASS: ${description}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: ${description}`);
    }
  }

  const service = TelegramNotificationService.getInstance();

  // Test 1: Stage 1 Pipeline Started
  try {
    await service.sendStageStarted({
      articleId: 'TEST_ART_001',
      headline: 'Tata Motors Q1 Net Profit Rises 30% YoY to Rs 5,500 Crore',
      publisher: 'Bloomberg',
      company: 'Tata Motors',
      source: 'RSS Feed'
    });
    assert(true, 'Stage 1 Pipeline Started notification enqueued successfully');
  } catch (err: any) {
    assert(false, `Stage 1 error: ${err.message}`);
  }

  // Test 2: Pending Queue tracking
  try {
    const pending = service.getPendingQueue();
    assert(pending.some(p => p.id === 'TEST_ART_001'), 'Pending article queue correctly tracks in-flight article');
  } catch (err: any) {
    assert(false, `Queue tracking error: ${err.message}`);
  }

  // Test 3: Stage 2 - 9 Notifications
  try {
    await service.sendStageDownloaded({ articleId: 'TEST_ART_001', characters: 1200, wordCount: 220 });
    await service.sendStageCleaned({ articleId: 'TEST_ART_001', finalLength: 1100, charactersRemoved: 100 });
    await service.sendStageEventDetected({ articleId: 'TEST_ART_001', detectedEvent: 'Q1 Financial Results', confidence: 95 });
    await service.sendStageFinancialExtracted({ articleId: 'TEST_ART_001', metricsCount: 4, revenue: 'Rs 10,000 Cr', pat: 'Rs 5,500 Cr', extractionConfidence: 95 });
    await service.sendStageBusinessEvents({ articleId: 'TEST_ART_001', numberOfEvents: 2, orderWins: 1 });
    await service.sendStageQuoteExtracted({ articleId: 'TEST_ART_001', corporateQuotesCount: 1, analystQuotesCount: 1, rejectedQuotesCount: 0 });
    await service.sendStageNarrativeGenerated({ articleId: 'TEST_ART_001', wordCount: 250, originalityScore: 100, duplicatePct: 0, parserConfidence: 98, generationTimeMs: 120 });
    await service.sendStageQualityGate({ articleId: 'TEST_ART_001', status: 'PASS', qualityScore: 95, parserConfidence: 98, rejectedSentencesCount: 0, rejectedMetricsCount: 0, rejectedQuotesCount: 0 });
    assert(true, 'Stages 2 through 9 notifications dispatched smoothly');
  } catch (err: any) {
    assert(false, `Stages 2-9 error: ${err.message}`);
  }

  // Test 4: Stage 10 Published
  try {
    await service.sendStagePublished({
      articleId: 'TEST_ART_001',
      storyId: 'STORY_001',
      publishTime: new Date().toISOString(),
      processingTimeMs: 150,
      headline: 'Tata Motors Q1 Net Profit Rises 30%'
    });
    const pendingAfter = service.getPendingQueue();
    assert(!pendingAfter.some(p => p.id === 'TEST_ART_001'), 'Stage 10 Published resolves and cleans in-flight pending queue item');
  } catch (err: any) {
    assert(false, `Stage 10 error: ${err.message}`);
  }

  // Test 5: Failure Alert
  try {
    await service.sendStageFailed({
      stageName: 'Financial Extraction',
      reason: 'Parser confidence below threshold (<80)',
      articleTitle: 'Corrupt Article Payload',
      articleId: 'TEST_FAIL_001',
      action: 'Retry Scheduled'
    });
    const failed = service.getFailedArticles();
    assert(failed.some(f => f.articleId === 'TEST_FAIL_001'), 'Failure alert recorded article in failed articles list');
  } catch (err: any) {
    assert(false, `Failure alert error: ${err.message}`);
  }

  // Test 6: Pipeline Pause & Resume
  try {
    service.pausePipeline();
    assert(service.isPipelinePaused() === true, 'Pipeline paused state toggled to true');
    service.resumePipeline();
    assert(service.isPipelinePaused() === false, 'Pipeline resumed state toggled to false');
  } catch (err: any) {
    assert(false, `Pause/Resume error: ${err.message}`);
  }

  // Test 7: Full Story Intelligence Integration with 10-Stage Pipeline
  try {
    const story = StoryIntelligenceEngine.analyzeStory({
      id: 'ART_TATA_001',
      title: 'Tata Motors Q1 Net Profit Surges 30% YoY to Rs 5,500 Crore',
      company: 'Tata Motors',
      symbol: 'TATAMOTORS',
      publisher: 'Reuters',
      cleanText: `Tata Motors Ltd. reported a 30% YoY surge in standalone net profit to Rs. 5,500 crore for Q1 FY27. Revenue from operations increased 15% YoY to Rs. 105,000 crore.

EBITDA margin expanded by 180 bps to 13.5% driven by strong JLR sales and commercial vehicle realizations.

"Our EV portfolio and JLR premium luxury volumes continue to deliver strong operating margins," stated the Group Chief Financial Officer.

Nomura maintained a 'BUY' rating with a price target of Rs. 1,250.`
    });

    assert(story.headline.length > 0, 'Story Intelligence Engine analyzed story successfully');
    assert(story.verifiedMetrics.length > 0, 'Extracted financial metrics through pipeline');
    assert(story.qualityPassed === true, 'Quality gate passed for story');
  } catch (err: any) {
    assert(false, `Story Intelligence integration error: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`ATHENA V31 REGRESSION RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  return { passedTests, totalTests, success: passedTests === totalTests };
}
