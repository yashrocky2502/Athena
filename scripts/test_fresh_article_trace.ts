import { newsStore } from '../src/newsCoreV2/storage/PersistentNewsStore';
import { TelegramNotificationPipeline } from '../src/news/NewsEngine/TelegramNotificationPipeline';
import { TelegramQualityGate } from '../src/news/NewsEngine/TelegramQualityGate';
import { FNOEligibilityEngine } from '../src/newsCoreV2/fno/FNOEligibilityEngine';
import fs from 'fs';

async function testTrace() {
  console.log('--- STARTING FRESH ARTICLE TRACE (WITH CLASSIFICATION) ---');
  
  const pipeline = TelegramNotificationPipeline.getInstance();
  pipeline.setAuditMode(true); 
  
  const freshArticleId = `v2_fresh_${Date.now()}`;
  const rawArticle = {
    id: freshArticleId,
    canonicalUrl: "https://example.com/hal-q1-results-" + Date.now(),
    headline: "HAL reports 30% jump in Q1 net profit, board approves dividend",
    body: "Hindustan Aeronautics (HAL) reported stellar first quarter numbers with profit surging 30% YoY. The company also announced a dividend of Rs 10 per share.",
    source: {
      publisher: "CNBC TV18",
      url: "https://cnbctv18.com",
      collectionMethod: "RSS"
    },
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    category: "RESULTS",
    sentiment: "BULLISH",
    relevanceScore: 100
  };

  console.log(`1. Classifying article: ${freshArticleId}`);
  const fnoResult = FNOEligibilityEngine.evaluate(rawArticle.headline, rawArticle.body);
  const freshArticle = { ...rawArticle, fno: fnoResult };
  
  console.log(`   F&O Result: Eligible=${freshArticle.fno.eligible}, Symbol=${freshArticle.fno.symbol}`);

  console.log(`2. Ingesting article to Store...`);
  const saved = newsStore.saveArticles([freshArticle as any]);
  console.log(`3. Persisted to Store: ${saved.length === 1 ? 'SUCCESS' : 'FAILED'}`);

  const storeArt = newsStore.getAllArticles().find(a => a.id === freshArticleId);
  console.log(`4. Store Retrieval Check: ID=${storeArt?.id}, Symbol=${storeArt?.fno?.symbol}`);

  const qgResult = TelegramQualityGate.evaluate(storeArt!);
  console.log(`5. Quality Gate Decision: ${qgResult.decision} (${qgResult.reason})`);
  console.log(`   Resolved Symbol: ${qgResult.symbol}`);

  if (qgResult.decision === 'IMMEDIATE') {
    console.log('6. Triggering Telegram Notification Pipeline...');
    const result = await pipeline.processArticle(storeArt!);
    console.log(`7. Notification Result: Sent=${result.enqueued}, AuditMode=${result.auditMode}`);
  }

  const auditPath = 'data/telegram_notifications.json';
  const notifs = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
  const finalNotif = notifs.find((n: any) => n.articleId === freshArticleId);
  console.log(`8. Persistent Audit Log: ${finalNotif ? 'FOUND' : 'NOT FOUND'}`);
  if (finalNotif) {
    console.log(`   Log Status: ${finalNotif.status}`);
    console.log(`   Log Symbol: ${finalNotif.stock}`);
    console.log(`   Log Message Fragment: ${finalNotif.formattedMessage.split('\n')[0]}`);
  }
  
  process.exit(0);
}

testTrace().catch(console.error);
