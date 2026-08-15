import fs from 'fs';
import { FNOEligibilityEngine } from '../src/newsCoreV2/fno/FNOEligibilityEngine';

const filePath = 'data/news_core_v2.json';
if (!fs.existsSync(filePath)) {
  console.log('Storage file not found.');
  process.exit(0);
}

const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
let fixedCount = 0;

for (const art of articles) {
  const oldResult = art.fno;
  const newResult = FNOEligibilityEngine.evaluate(art.headline, art.body);
  
  if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) {
    art.fno = newResult;
    fixedCount++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(articles, null, 2));
console.log(`Successfully updated F&O metadata for ${fixedCount} articles.`);
