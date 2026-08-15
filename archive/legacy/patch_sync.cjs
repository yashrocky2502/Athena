const fs = require('fs');
const file = 'src/newsCoreV2/sync/NewsSyncService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /if \(art\.fno\?\.eligible && art\.fno\?\.decision === "INCLUDE"\) \{[\s\S]*?\} else \{([\s\S]*?)\}/,
  '$1'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched NewsSyncService.ts');
