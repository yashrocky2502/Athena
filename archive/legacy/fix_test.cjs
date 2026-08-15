const fs = require('fs');
const file = 'src/newsCoreV2/tests/Phase23_6_AIIntegrationRegression.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const testArticle: NewsArticleV2 = \{[\s\S]*?\};/,
  `const testArticle: NewsArticleV2 = {
    id: "test-ai-82",
    canonicalUrl: "https://example.com/test",
    headline: "Reliance Industries Reports 15% Jump in Q3 PAT",
    body: "Reliance Industries announced its Q3 results today. The PAT was Rs 19000 crore, up 15%. EBITDA margins expanded by 50 bps.",
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    primaryCategory: "Results",
    category: "Results",
    sentiment: "BULLISH",
    relevanceScore: 90,
    eventType: "EARNINGS",
    source: { publisher: "Economic Times", url: "https://example.com/test", collectionMethod: "DIRECT" },
    fno: { eligible: true, decision: "INCLUDE", symbol: "RELIANCE", confidence: "HIGH", reason: "test" }
  };`
);

content = content.replace(
  /const badArticle: NewsArticleV2 = \{[\s\S]*?\};/,
  `const badArticle: NewsArticleV2 = {
      ...testArticle,
      id: "test-ai-86",
      headline: "Some news without revenue",
      body: "Just a generic news story."
    };`
);


fs.writeFileSync(file, content, 'utf8');
console.log('Fixed test file properties');
