const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/news_core_v2.json', 'utf8'));
console.log(`Total articles: ${data.length}`);

const categoryContamination = [];

for (const article of data) {
  const primaryCategory = article.primaryCategory;
  const headline = article.headline || '';
  const body = article.body || '';
  const text = (headline + ' ' + body).toLowerCase();
  
  if (primaryCategory === 'Technology') {
    if (text.includes('bitcoin') || text.includes('crypto') || text.includes('ethereum') || text.includes('blockchain')) {
      // Is it really crypto?
      if (!article.secondaryCategories?.includes('Cryptocurrency') && article.category !== 'Cryptocurrency') {
        categoryContamination.push({
           id: article.id,
           headline: article.headline,
           primaryCategory: primaryCategory,
           suspected: 'Crypto'
        });
      }
    }
  }

  if (primaryCategory === 'Corporate') {
    if (text.includes('q1 result') || text.includes('q2 result') || text.includes('q3 result') || text.includes('q4 result') || text.includes('net profit') || text.includes('ebitda')) {
      if (!article.secondaryCategories?.includes('Results') && article.eventType !== 'RESULTS') {
        categoryContamination.push({
           id: article.id,
           headline: article.headline,
           primaryCategory: primaryCategory,
           suspected: 'Results'
        });
      }
    }
  }
}

console.log(`Found ${categoryContamination.length} potentially contaminated articles.`);
fs.writeFileSync('audit_results.json', JSON.stringify(categoryContamination, null, 2));
