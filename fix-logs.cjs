const fs = require('fs');

const filesToUpdate = [
  'src/lib/connectors/BaseMCP.ts',
  'src/lib/connectors/GoogleSearchMCP.ts',
  'src/lib/SearchOrchestrator.ts',
  'src/lib/QueryPlanner.ts'
];

filesToUpdate.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/console\.error/g, 'console.log');
    fs.writeFileSync(file, content);
  }
});
