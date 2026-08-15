const fs = require('fs');
let code = fs.readFileSync('src/newsCoreV2/api/newsCoreV2Routes.ts', 'utf8');
code = code.replace('newsStore.getFeedArticles()', 'newsStore.getAllArticles()');
fs.writeFileSync('src/newsCoreV2/api/newsCoreV2Routes.ts', code);
