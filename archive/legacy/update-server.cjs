const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const watchlistSummaryCode = `
app.post("/api/ai/watchlist-summary", async (req, res) => {
  if (!ai) {
    return res.json({
      importantNews: [{ title: "API Key Required", summary: "Please configure Gemini API key to get personalized watchlist intelligence." }],
      priceMovements: [],
      sectorImpact: [],
      peerComparison: [],
      corporateActions: []
    });
  }

  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.json({ importantNews: [], priceMovements: [], sectorImpact: [], peerComparison: [], corporateActions: [] });
    }

    const prompt = \`You are an expert personalized financial analyst.
    Analyze the following watchlist of companies: \${symbols.join(", ")}.
    Provide personalized intelligence for this exact list of companies.
    
    Respond with raw JSON structured exactly like this:
    {
      "importantNews": [ { "symbol": string, "title": string, "summary": string } ],
      "priceMovements": [ { "symbol": string, "trend": "up" | "down" | "neutral", "analysis": string } ],
      "sectorImpact": [ { "sector": string, "impact": string } ],
      "peerComparison": [ { "symbol": string, "insight": string } ],
      "corporateActions": [ { "symbol": string, "action": string, "date": string } ]
    }
    
    Keep analysis concise and actionable.\`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    
    let summary = {};
    try {
      const text = response.text || "{}";
      const cleaned = text.replace(/\`\`\`json\\n|\\n\`\`\`|\`\`\`/g, "").trim();
      summary = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse watchlist summary JSON:", e);
      summary = { importantNews: [], priceMovements: [], sectorImpact: [], peerComparison: [], corporateActions: [] };
    }
    
    res.json(summary);
  } catch (error) {
    console.error("Failed to generate watchlist summary:", error);
    res.status(500).json({ error: "Failed to generate watchlist summary" });
  }
});
`;

code = code.replace('app.post("/api/ai/market-summary",', watchlistSummaryCode + '\napp.post("/api/ai/market-summary",');
fs.writeFileSync('server.ts', code);
