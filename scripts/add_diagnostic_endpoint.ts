import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'src/newsCoreV2/api/newsCoreV2Routes.ts');
let routesCode = fs.readFileSync(routesPath, 'utf8');

const diagnosticEndpoint = `
import { TelegramNotificationStateStore } from "../../news/NewsEngine/TelegramNotificationStateStore";
import { TelegramQualityGate } from "../../news/NewsEngine/TelegramQualityGate";

newsCoreV2Router.get("/diagnostics/article/:articleId", (req: Request, res: Response) => {
  try {
    const articleId = req.params.articleId;
    const article = newsStore.getAllArticles().find(a => a.id === articleId);

    if (!article) {
      return res.status(404).json({ status: "error", message: "Article not found" });
    }

    const stateStore = TelegramNotificationStateStore.getInstance();
    const telegramState = stateStore.getAllStates().find(s => s.articleId === articleId);

    let qgEval = null;
    try {
      qgEval = TelegramQualityGate.evaluate(article, { watermarkIso: "2020-01-01T00:00:00Z" });
    } catch(e) {}

    const inFeed = newsStore.getFeedArticles().some(a => a.id === articleId);
    const inFno = newsStore.getFNOArticles().some(a => a.id === articleId);

    res.json({
      status: "success",
      diagnostic: {
        articleId: article.id,
        canonicalUrl: article.canonicalUrl || article.source?.url,
        headline: article.headline,
        publisher: article.source?.publisher,
        publishedAt: article.publishedAt,
        detectedEntity: article.fno?.symbol,
        resolvedFnoSymbol: article.fno?.symbol,
        fnoEligibility: article.fno?.eligible,
        fnoConfidence: article.fno?.confidence,
        fnoDecision: article.fno?.decision,
        fnoReason: article.fno?.reason,
        metrics: article.keyMetrics,
        whyItMatters: article.whyItMatters,
        marketImpact: article.marketImpact,
        catalyst: article.category,
        materialityScore: qgEval?.materialityScore,
        fnoRelevanceScore: article.relevanceScore,
        telegramDecision: qgEval?.decision,
        telegramReason: qgEval?.reason,
        telegramState: telegramState?.status || "NOT_FOUND",
        isOldWatermark: new Date(article.publishedAt) < new Date("2024-08-01T00:00:00Z"),
        isDuplicate: qgEval?.isDuplicateCluster,
        inPersistentStore: true,
        inFeed: inFeed,
        inFno: inFno,
        qgEvaluated: !!qgEval
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});
`;

if (!routesCode.includes("/diagnostics/article/:articleId")) {
  const insertIndex = routesCode.indexOf('export { newsCoreV2Router };');
  if (insertIndex > -1) {
    routesCode = routesCode.slice(0, insertIndex) + diagnosticEndpoint + routesCode.slice(insertIndex);
    fs.writeFileSync(routesPath, routesCode);
    console.log("Added diagnostic endpoint.");
  } else {
    console.log("Could not find export { newsCoreV2Router };");
  }
} else {
  console.log("Diagnostic endpoint already exists.");
}
