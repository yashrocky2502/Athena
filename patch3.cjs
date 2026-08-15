const fs = require('fs');
const file = 'src/newsCoreV2/api/newsCoreV2Routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /newsCoreV2Router\.get\("\/:articleId\/intelligence", \(req: Request, res: Response\) => \{/g,
  'newsCoreV2Router.get("/:articleId/intelligence", async (req: Request, res: Response) => {'
);
content = content.replace(
  /const intelligence = UnifiedIntelligenceEngine\.build\(article\);/g,
  'const intelligence = await UnifiedIntelligenceEngine.generateAIIntelligence(article);'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched newsCoreV2Routes.ts');
