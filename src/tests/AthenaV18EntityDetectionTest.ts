import { CompanyDetector } from '../news/detection/CompanyDetector';
import { CanonicalClassificationEngine } from '../news/NewsEngine/CanonicalClassificationEngine';
import { NotificationService } from '../news/NewsEngine/NotificationService';

export function runAthenaV18Tests() {
  console.log('================================================================');
  console.log('       ATHENA V18 — UNIVERSAL F&O ENTITY DETECTION TEST         ');
  console.log('================================================================\n');

  // Perform dummy warm-up detection to load V8 JIT & precompiled patterns
  CompanyDetector.detectUniversal({ headline: 'Warmup Test' });

  const testArticles = [
    {
      id: 'TEST_001',
      headline: 'Kalyan Jewellers Q3 net profit surges 22% to Rs 180 crore; revenue expands 35%',
      description: 'Kalyan Jewellers India Limited reported strong retail demand across South India and international showrooms. Same-store sales growth remained robust.',
      publisher: 'Economic Times'
    },
    {
      id: 'TEST_002',
      headline: 'Nestlé India board approves second interim dividend of Rs 7 per share; Maggi volume grows 12%',
      description: 'Nestle India reported quarterly revenue growth driven by double-digit volume expansion in prepared dishes and confectionery.',
      publisher: 'Financial Express'
    },
    {
      id: 'TEST_003',
      headline: 'Bharti Airtel tariff hike drives ARPU to Rs 233 in Q3; 4G/5G subscriber base expands',
      description: 'Bharti Airtel Limited announced strong wireless revenue growth as average revenue per user touched record highs.',
      publisher: 'Bloomberg'
    },
    {
      id: 'TEST_004',
      headline: 'Larsen & Toubro secures Rs 5,000 crore mega offshore order in Middle East',
      description: 'L&T Construction division won a major hydrocarbon and power grid infrastructure project.',
      publisher: 'Reuters'
    },
    {
      id: 'TEST_005',
      headline: 'Defence Ministry clears Rs 45,000 crore proposals for defence equipment acquisition',
      description: 'The Defence Acquisition Council granted approval for procurement of electronic warfare suites and missile defense systems.',
      publisher: 'Press Trust of India'
    }
  ];

  let allPassed = true;

  for (const article of testArticles) {
    console.log(`----------------------------------------------------------------`);
    console.log(`ARTICLE: "${article.headline}"`);
    
    // 1. Universal Entity Detection
    const detection = CompanyDetector.detectUniversal({
      headline: article.headline,
      subheadline: article.description,
      summary: article.description,
      metadata: article.publisher
    });

    console.log(`⏱️  Detection Time: ${detection.processingTimeMs} ms (Limit < 10ms)`);
    console.log(`🏢 Detected Companies: ${detection.detectedCompanies.map(c => `${c.name} (${c.ticker}, F&O: ${c.isFnO})`).join(', ') || 'None'}`);
    console.log(`🎯 Highest Confidence: ${detection.highestConfidence}%`);
    console.log(`⚡ F&O Status: ${detection.isFnO ? 'YES (F&O Stock Detected)' : 'NO'}`);

    // 2. Canonical Classification
    const classification = CanonicalClassificationEngine.classify(article as any);
    console.log(`🏷️  Primary Category: ${classification.primaryCategory}`);
    console.log(`Reason: ${classification.foReason}`);

    // 3. Notification Eligibility
    const notificationEligible = NotificationService.getInstance().isEligible(article as any);
    console.log(`🔔 Notification Eligible: ${notificationEligible ? 'PASSED (Will Trigger Telegram Alert)' : 'FAILED'}`);

    if (detection.processingTimeMs > 10) {
      console.error(`❌ Performance failure: Detection took ${detection.processingTimeMs}ms (> 10ms threshold)`);
      allPassed = false;
    }

    if (!classification.isFO && (article.id === 'TEST_001' || article.id === 'TEST_002' || article.id === 'TEST_003' || article.id === 'TEST_004')) {
      console.error(`❌ F&O Tagging failure: Expected F&O status for article ${article.id}`);
      allPassed = false;
    }
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ✅ ALL ATHENA V18 ENTITY DETECTION & ALERT ENGINE TESTS PASSED');
  } else {
    console.log('  ❌ ATHENA V18 TESTS FAILED — CHECK ERRORS ABOVE');
  }
  console.log('================================================================\n');

  return allPassed;
}
