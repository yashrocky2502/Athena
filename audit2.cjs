const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/news_core_v2.json', 'utf8'));

const categories = {};
for (const article of data) {
  const cat = article.primaryCategory || 'NONE';
  if (!categories[cat]) categories[cat] = 0;
  categories[cat]++;
}

console.log('Categories distribution:');
console.log(categories);

