const fs = require('fs');
const file = 'src/newsCoreV2/intelligenceV2/UnifiedIntelligenceEngine.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('generateAIIntelligence')) {
  const insertIndex = content.lastIndexOf('}');
  const newMethod = `
  public static async generateAIIntelligence(article: NewsArticleV2): Promise<IntelligenceRecord> {
    const record = this.build(article);
    const store = IntelligenceStore.getInstance();
    const aiVersion = this.VERSION + "_AI";
    const cached = store.get(article.id, aiVersion);
    if (cached) return cached;

    try {
      const { AIRouter } = await import("../../news/AI/AIRouter.ts");
      const router = AIRouter.getInstance();
      
      const metricsList = record.financialMetrics.map(m => m.name + ": " + m.displayText).join(" | ");
      const body = article.body || "";
      
      const prompt = \`You are ATHENA, a strict financial AI.
Analyze the following article and extracted metrics.
You MUST synthesize narrative language ONLY from the supplied canonical evidence.
Do not invent revenue, PAT, EBITDA, EPS, or derivatives metrics.
If evidence is unavailable, explicitly return a neutral evidence-grounded statement.

Headline: \${record.headline}
Company: \${record.companyName}
F&O Eligible: \${record.fnoEligible}
Category: \${record.category}
Metrics: \${metricsList}

Respond STRICTLY in valid JSON matching this schema:
{
  "executiveSummary": "1 concise paragraph detailing the core event",
  "whyItMatters": "Business/Strategic implication",
  "marketImpact": "Market/Sector impact",
  "optionsSellerImpact": "Actionable F&O impact OR 'No actionable F&O setup from this article alone.'",
  "riskWatchpoints": ["Risk 1", "Risk 2"]
}\`;

      const aiResponse = await router.generateSummary({
         category: record.category,
         headline: article.headline,
         body: prompt + "\\n\\nArticle text:\\n" + body,
      });

      let parsed;
      try {
        const cleanText = aiResponse.text.replace(/\\x60\\x60\\x60json/g, "").replace(/\\x60\\x60\\x60/g, "").trim();
        parsed = JSON.parse(cleanText);
      } catch (e) {
        throw new Error("Invalid JSON from LLM: " + e.message);
      }

      const aiRecord: IntelligenceRecord = {
        ...record,
        executiveSummary: parsed.executiveSummary || record.executiveSummary,
        whyItMatters: parsed.whyItMatters || record.whyItMatters,
        marketImpact: parsed.marketImpact || record.marketImpact,
        optionsSellerImpact: parsed.optionsSellerImpact || record.optionsSellerImpact,
        risk: Array.isArray(parsed.riskWatchpoints) ? parsed.riskWatchpoints : record.risk,
        intelligenceVersion: aiVersion,
        generatedAt: new Date().toISOString()
      };
      
      // We do not override primaryCategory, fno, confidence, etc!
      store.set(aiRecord);
      return aiRecord;
    } catch (err) {
      console.warn("[UnifiedIntelligenceEngine] AI generation failed, falling back to deterministic.", err);
      return record;
    }
  }
`;
  content = content.substring(0, insertIndex) + newMethod + content.substring(insertIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched UnifiedIntelligenceEngine.ts');
} else {
  console.log('Already patched.');
}
