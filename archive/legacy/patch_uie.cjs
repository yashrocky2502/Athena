const fs = require('fs');
const file = 'src/newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace the router.generateSummary call to include facts
content = content.replace(
  /const aiResponse = await router\.generateSummary\(\{\s*category: record\.category,\s*headline: article\.headline,\s*body: prompt \+ "\\n\\nArticle text:\\n" \+ body,\s*\}\);/,
  `
      const factsMap = record.financialMetrics.reduce((acc, m) => {
         acc[m.name] = m.displayText || m.currentValue;
         return acc;
      }, {});
      factsMap['Symbol'] = record.symbol;
      factsMap['Category'] = record.primaryCategory;
      factsMap['EventType'] = record.eventType;
      
      const aiResponse = await router.generateSummary({
         category: record.category,
         headline: article.headline,
         body: prompt + "\\n\\nArticle text:\\n" + body,
         facts: factsMap
      });
`
);

// Add basic JSON validation logic
content = content.replace(
  /const aiRecord: IntelligenceRecord = \{/,
  `
      // Validate AI fields against hallucinations
      const combinedOutput = (parsed.executiveSummary + " " + parsed.whyItMatters + " " + parsed.marketImpact + " " + parsed.optionsSellerImpact + " " + (parsed.riskWatchpoints||[]).join(" ")).toLowerCase();
      
      const mustNotInvent = ["revenue", "pat", "ebitda", "eps", "gmp", "order value", "subscription"];
      for (const term of mustNotInvent) {
        if (combinedOutput.includes(term) && !metricsList.toLowerCase().includes(term) && !body.toLowerCase().includes(term) && !article.headline?.toLowerCase().includes(term)) {
           throw new Error("AI hallucination detected: invented " + term);
        }
      }
      
      const aiRecord: IntelligenceRecord = {`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched UnifiedIntelligenceEngine.ts');
