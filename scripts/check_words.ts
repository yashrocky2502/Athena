import fs from 'fs';
import { FNORelevanceEngine } from '../src/news/FNO/FNORelevanceEngine';

const raw = fs.readFileSync('/tmp/feed.json', 'utf-8');
const feed = JSON.parse(raw);
const articles = Array.isArray(feed) ? feed : (feed.articles || []);

const regex = FNORelevanceEngine.NEGATIVE_PATTERNS.find(p => p.id === 'BROKER_REPORT')!.regex;

const wordMatches: Record<string, number> = {};

articles.forEach(art => {
  const title = (art.title || art.headline || '').toString();
  const body = (art.summary || art.description || art.content || art.body || '').toString();
  const text = `${title} \n ${body}`;
  
  const m = text.match(new RegExp(regex, 'gi'));
  if (m) {
    m.forEach(w => {
      const lower = w.toLowerCase().trim();
      wordMatches[lower] = (wordMatches[lower] || 0) + 1;
    });
  }
});

console.log('Words matching BROKER_REPORT regex:', wordMatches);
process.exit(0);
