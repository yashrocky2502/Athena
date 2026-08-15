import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data', 'news_core_v2.json');
const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const eligible = articles.filter(a => a.fno?.eligible === true && a.fno?.decision === 'INCLUDE').slice(0, 15);

console.log(JSON.stringify(eligible.map(a => ({
  id: a.id,
  headline: a.headline,
  symbol: a.fno.symbol,
  reason: a.fno.reason
})), null, 2));
