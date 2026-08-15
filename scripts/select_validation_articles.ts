import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'news_core_v2.json');
const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const categories = [
  { name: 'earnings/PAT', pattern: /earnings|profit|pat|results/i },
  { name: 'revenue/EBITDA', pattern: /revenue|ebitda/i },
  { name: 'regulatory catalyst', pattern: /sebi|rbi|penalty|investigation|regulatory/i },
  { name: 'management change', pattern: /ceo|cfo|appoint|resign/i },
  { name: 'order win', pattern: /order win|contract|bags order/i },
  { name: 'guidance/outlook', pattern: /guidance|outlook|forecast/i },
  { name: 'pharma/regulatory event', pattern: /fda|drug|clinical|pharma/i },
  { name: 'commodity/energy', pattern: /reliance|ongc|oil|coal|commodity/i },
  { name: 'missed HAL', pattern: /HAL/i, id: 'v2_1c07a7a40f29d79a' },
  { name: 'missed Tata Motors/MCX', pattern: /Tata Motors|MCX/i }
];

const selected = [];
const seenIds = new Set();

for (const cat of categories) {
  let found;
  if (cat.id) {
    found = articles.find(a => a.id === cat.id);
  } else {
    found = articles.find(a => 
      cat.pattern.test(a.headline + ' ' + (a.body || '')) && 
      !seenIds.has(a.id) &&
      a.fno?.symbol
    );
  }
  
  if (found) {
    selected.push({
      category: cat.name,
      id: found.id,
      headline: found.headline,
      symbol: found.fno.symbol,
      eligible: found.fno.eligible,
      decision: found.fno.decision,
      confidence: found.fno.confidence,
      reason: found.fno.reason
    });
    seenIds.add(found.id);
  }
}

console.log(JSON.stringify(selected, null, 2));
