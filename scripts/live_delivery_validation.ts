import fs from 'fs';
import path from 'path';
import { TelegramQualityGate } from '../src/news/NewsEngine/TelegramQualityGate';
import { FNO_UNIVERSE } from '../src/newsCoreV2/fno/FNOUniverse';

const articles = JSON.parse(fs.readFileSync('data/news_core_v2.json', 'utf-8'));
const notifications = fs.existsSync('data/telegram_notifications.json') 
    ? JSON.parse(fs.readFileSync('data/telegram_notifications.json', 'utf-8')) 
    : [];

const selectedIds = [
  "v2_3179bfb3c2338ea5", // MCX
  "v2_1c07a7a40f29d79a", // HAL
  "v2_hash_1839955026", // MARUTI
  "v2_a7029310ffed9018", // INDIGO
  "v2_030f967d2bebdda3", // TATAMOTORS
  "v2_797c3f38d32abb5f", // HINDALCO
  "v2_9adfbd8b071fd849", // SOLARINDS
  "v2_0d50fe54842bb224", // HAL (revenue)
  "v2_b36193ff3fe86f50", // NIFTY (futures)
  "v2_0aaf08504e3bfeb8"  // TATAMOTORS (profit)
];

const results = selectedIds.map(id => {
  const art = articles.find(a => a.id === id);
  if (!art) return { id, error: 'Not found in storage' };

  const qgResult = TelegramQualityGate.evaluate(art);
  const sentNotif = notifications.find(n => n.articleId === id);

  return {
    id: art.id,
    headline: art.headline,
    symbol: art.fno?.symbol,
    fnoEligible: art.fno?.eligible,
    qgDecision: qgResult.decision,
    qgReason: qgResult.reason,
    matScore: qgResult.materialityScore,
    telegramSent: !!sentNotif,
    telegramStatus: sentNotif?.status || 'NOT_SENT'
  };
});

console.log(JSON.stringify(results, null, 2));
