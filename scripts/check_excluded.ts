import fs from 'fs';
import { resolveFNOEligibility } from '../src/news/FNO/FNOEligibilityResolver';
import { FNORelevanceEngine } from '../src/news/FNO/FNORelevanceEngine';

const brokerReportPat = FNORelevanceEngine.NEGATIVE_PATTERNS.find(p => p.id === 'BROKER_REPORT');
if (brokerReportPat) {
  brokerReportPat.regex = /\b(brokerage|analyst\s+rating|credit\s+rating|target\s+price|upgrade|downgrade|recommends|jefferies|goldman|morgan\s+stanley|clsa|nomura|jp\s+morgan|citi|ubs)\b/i;
}

const raw = fs.readFileSync('/tmp/feed.json', 'utf-8');
const feed = JSON.parse(raw);
const articles = Array.isArray(feed) ? feed : (feed.articles || []);

const excludedList: any[] = [];

for (const item of articles) {
  const elig = resolveFNOEligibility(item);
  if (elig.eligible) {
    const audit = FNORelevanceEngine.evaluateAudit(item);
    if (audit.fnoDecision === 'EXCLUDE') {
      excludedList.push({ item, elig, audit });
    }
  }
}

console.log('Total Excluded F&O Eligible Stories:', excludedList.length);
excludedList.slice(0, 30).forEach((s, idx) => {
  console.log(`\n#${idx + 1} [${s.elig.symbol}] ${s.item.title || s.item.headline}`);
  console.log(`   Relevance: ${s.audit.fnoRelevance} | Score: ${s.audit.fnoScore}`);
  console.log(`   Reasons: ${s.audit.fnoReasons.join(' | ')}`);
});

process.exit(0);
