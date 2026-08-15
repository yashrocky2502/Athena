const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(
  /cache: Cache.getInstance\(\).getStats\(\)/,
  'cache: Cache.getInstance().getStats(),\n    redirectMetrics: UrlResolver.getInstance().metrics'
);
fs.writeFileSync('server.ts', content);
console.log("Patched server.ts health");
