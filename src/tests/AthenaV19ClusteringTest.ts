import { StoryClusterEngine } from '../news/NewsEngine/StoryClusterEngine';
import { SourcePriorityEngine } from '../news/NewsEngine/SourcePriorityEngine';
import { EventClassifierEngine } from '../news/NewsEngine/EventClassifierEngine';
import { CompanyDetector } from '../news/detection/CompanyDetector';

export function runAthenaV19Tests() {
  console.log('================================================================');
  console.log('       ATHENA V19 — MULTI-SOURCE CLUSTERING & AGGREGATION TEST   ');
  console.log('================================================================\n');

  // Clear previous state and pre-warm JIT cache
  StoryClusterEngine.getInstance().clear();
  CompanyDetector.initWarmup();
  StoryClusterEngine.getInstance().processArticle({
    id: 'WARMUP',
    title: 'Warmup test article for JIT compilation',
    publisher: 'Reuters'
  } as any);
  StoryClusterEngine.getInstance().clear();

  let allPassed = true;

  // TEST 1 — SOURCE PRIORITY EVALUATION
  console.log('--- TEST 1: Source Priority & Confidence Scores ---');
  const sourcesToTest = [
    { name: 'NSE Corporate Announcements', expectedScore: 100 },
    { name: 'SEBI', expectedScore: 100 },
    { name: 'Reuters', expectedScore: 98 },
    { name: 'Economic Times', expectedScore: 95 },
    { name: 'Moneycontrol', expectedScore: 94 },
    { name: 'LiveMint', expectedScore: 94 },
    { name: 'CNBC TV18', expectedScore: 90 },
    { name: 'Random Tech Blog', expectedScore: 60 }
  ];

  for (const src of sourcesToTest) {
    const res = SourcePriorityEngine.evaluateSource(src.name);
    console.log(`  Source: "${src.name}" -> Assigned Score: ${res.confidenceScore} (Expected: ${src.expectedScore}), Category: ${res.category}`);
    if (res.confidenceScore !== src.expectedScore) {
      console.error(`❌ Source Priority mismatch for ${src.name}`);
      allPassed = false;
    }
  }

  // TEST 2 — MULTI-SOURCE CLUSTERING & BREAKING NEWS MERGE (BHARTI AIRTEL Q3 EVENT)
  console.log('\n--- TEST 2: Multi-Source Clustering & Breaking News Merge (5 Publishers -> 1 Story Cluster) ---');
  const airtelEventArticles = [
    {
      id: 'AIRTEL_001',
      title: 'Bharti Airtel Q3 net profit leaps 54% to Rs 2,442 crore; ARPU touches Rs 233',
      description: 'Bharti Airtel Limited reported a 54% YoY increase in net profit for Q3 FY25 driven by mobile tariff hikes and 4G subscriber additions.',
      publisher: 'Reuters',
      publishedAt: new Date('2026-08-04T09:31:00Z').toISOString()
    },
    {
      id: 'AIRTEL_002',
      title: 'Bharti Airtel Q3 profit surges 54% to Rs 2,442 crore on tariff hike boost; ARPU at Rs 233',
      description: 'Telecom giant Bharti Airtel posted robust quarterly net profit growth of 54% to Rs 2,442 crore as ARPU expanded to Rs 233.',
      publisher: 'Economic Times',
      publishedAt: new Date('2026-08-04T09:36:00Z').toISOString()
    },
    {
      id: 'AIRTEL_003',
      title: 'Bharti Airtel reports 54% jump in Q3 net profit to Rs 2,442 crore',
      description: 'Bharti Airtel net profit rose 54% YoY in the third quarter ended December 31, 2025. ARPU expanded to Rs 233.',
      publisher: 'Moneycontrol',
      publishedAt: new Date('2026-08-04T09:38:00Z').toISOString()
    },
    {
      id: 'AIRTEL_004',
      title: 'Airtel Q3 net profit climbs 54% to Rs 2,442 crore; wireless revenue expands',
      description: 'Bharti Airtel wireless business momentum drove quarterly profit to Rs 2,442 crore.',
      publisher: 'LiveMint',
      publishedAt: new Date('2026-08-04T09:41:00Z').toISOString()
    },
    {
      id: 'AIRTEL_005',
      title: 'NSE Disclosure: Bharti Airtel Limited Financial Results for Q3 FY25',
      description: 'Bharti Airtel Limited has submitted financial results showing net profit of Rs 2,442 crore and ARPU of Rs 233.',
      publisher: 'NSE Corporate Announcements',
      publishedAt: new Date('2026-08-04T09:45:00Z').toISOString()
    }
  ];

  let airtelClusterId = '';
  for (const art of airtelEventArticles) {
    const startMs = performance.now();
    const res = StoryClusterEngine.getInstance().processArticle(art as any);
    const procTimeMs = performance.now() - startMs;

    console.log(`  Processed: [${art.publisher}] "${art.title.substring(0, 50)}..."`);
    console.log(`  -> Cluster ID: ${res.cluster.id} | Relation: ${res.relation} | Proc Time: ${procTimeMs.toFixed(2)} ms`);

    airtelClusterId = res.cluster.id;

    if (procTimeMs > 20) {
      console.error(`❌ Performance failure: Cluster processing took ${procTimeMs.toFixed(2)} ms (> 20ms threshold)`);
      allPassed = false;
    }
  }

  const finalAirtelCluster = StoryClusterEngine.getInstance().getCluster(airtelClusterId);
  if (!finalAirtelCluster) {
    console.error('❌ Cluster not found after multi-source ingestion');
    return false;
  }

  console.log('\n--- VERIFYING AIRTEL CLUSTER INTEGRITY ---');
  console.log(`  Title: "${finalAirtelCluster.title}"`);
  console.log(`  Event Type: ${finalAirtelCluster.eventType}`);
  console.log(`  Confirmed By Sources (${finalAirtelCluster.confirmedBySources.length}): ${finalAirtelCluster.confirmedBySources.join(', ')}`);
  console.log(`  First Publisher: ${finalAirtelCluster.firstPublisher} (${finalAirtelCluster.firstPublisherTime})`);
  console.log(`  Latest Publisher: ${finalAirtelCluster.latestPublisher} (${finalAirtelCluster.latestPublisherTime})`);
  console.log(`  Time Span: ${finalAirtelCluster.timeDifferenceText}`);
  console.log(`  Total Confidence Score: ${finalAirtelCluster.score}/100`);
  console.log(`  F&O Stock Status: ${finalAirtelCluster.isFnO ? 'YES (F&O Stock)' : 'NO'}`);

  if (finalAirtelCluster.confirmedBySources.length !== 5) {
    console.error(`❌ Cluster source count mismatch. Expected 5 sources, got ${finalAirtelCluster.confirmedBySources.length}`);
    allPassed = false;
  }

  // Canonical article upgrade test: NSE Disclosure (confidence 100) should upgrade canonical article over Reuters (98)
  if (!finalAirtelCluster.canonicalArticle.publisher.includes('NSE')) {
    console.error(`❌ Canonical article source upgrade failure. Expected NSE disclosure to become canonical article, got ${finalAirtelCluster.canonicalArticle.publisher}`);
    allPassed = false;
  }

  // TEST 3 — DUPLICATE DETECTION PERFORMANCE & ACCURACY (< 5ms)
  console.log('\n--- TEST 3: Duplicate Detection Performance Test (< 5ms) ---');
  const duplicateArticle = {
    id: 'AIRTEL_DUP',
    title: 'Bharti Airtel Q3 profit leaps 54% to Rs 2,442 crore on ARPU growth',
    description: 'Bharti Airtel reported Q3 FY25 net profit of Rs 2,442 crore driven by ARPU expansion to Rs 233.',
    publisher: 'Financial Express',
    publishedAt: new Date('2026-08-04T09:50:00Z').toISOString()
  };

  const dupStartMs = performance.now();
  const dupRes = StoryClusterEngine.getInstance().processArticle(duplicateArticle as any);
  const dupProcTime = performance.now() - dupStartMs;

  console.log(`  Duplicate Check Processing Time: ${dupProcTime.toFixed(2)} ms (Threshold < 5ms)`);
  console.log(`  Merge Decision: ${dupRes.relation} | Cluster ID: ${dupRes.cluster.id}`);

  if (dupProcTime > 5) {
    console.error(`❌ Duplicate detection performance benchmark failed: Took ${dupProcTime.toFixed(2)} ms (> 5ms threshold)`);
    allPassed = false;
  }

  if (dupRes.relation !== 'MERGED') {
    console.error('❌ Duplicate detection failure: Article should have been merged into existing Airtel story cluster');
    allPassed = false;
  }

  // TEST 4 — AI PREPARATION PAYLOAD GENERATION (PHASE 12)
  console.log('\n--- TEST 4: AI Preparation Payload Generation (Phase 12) ---');
  const aiPayload = StoryClusterEngine.getInstance().getAIPreparedClusterPayload(airtelClusterId);
  console.log(`  AI Prepared Headline: "${aiPayload?.headline}"`);
  console.log(`  Verified Metrics (${aiPayload?.verifiedMetrics.length}):`, aiPayload?.verifiedMetrics.map(m => m.value).join(', '));
  console.log(`  Confirmed Sources List:`, aiPayload?.confirmedSources.join(', '));
  console.log(`  Source Chronology Items:`, aiPayload?.sourceChronology.length);

  if (!aiPayload || aiPayload.confirmedSources.length < 5 || aiPayload.verifiedMetrics.length === 0) {
    console.error('❌ AI Preparation payload generation failed');
    allPassed = false;
  }

  // TEST 5 — INTERNAL DEBUG AUDIT (PHASE 13)
  console.log('\n--- TEST 5: Internal Debug Info Audit (Phase 13) ---');
  const debugInfo = finalAirtelCluster.internalDebug;
  console.log(`  Cluster ID: ${debugInfo.clusterId}`);
  console.log(`  Matched Articles Count: ${debugInfo.matchedArticlesCount}`);
  console.log(`  Similarity Score: ${debugInfo.similarityScore}%`);
  console.log(`  Primary Source: ${debugInfo.primarySource}`);
  console.log(`  Supporting Sources: ${debugInfo.supportingSources.join(', ')}`);
  console.log(`  Merge Decision: ${debugInfo.mergeDecision}`);

  if (!debugInfo || debugInfo.matchedArticlesCount < 5) {
    console.error('❌ Internal Debug Info missing or incomplete');
    allPassed = false;
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ✅ ALL ATHENA V19 CLUSTERING & SOURCE AGGREGATION TESTS PASSED');
  } else {
    console.log('  ❌ ATHENA V19 TESTS FAILED — CHECK ERRORS ABOVE');
  }
  console.log('================================================================\n');

  return allPassed;
}
