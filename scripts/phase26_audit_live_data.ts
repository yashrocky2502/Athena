import fs from 'fs';
import { FNOEligibilityEngine } from '../src/newsCoreV2/fno/FNOEligibilityEngine';
import { FNO_UNIVERSE } from '../src/newsCoreV2/fno/FNOUniverse';

const DATA_PATH = 'data/news_core_v2.json';

async function runAudit() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('Data file not found');
    return;
  }

  const articles = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const auditResults = {
    totalArticles: articles.length,
    fnoArticles: 0,
    uniqueFnoSymbols: new Set<string>(),
    missedFnoStories: [] as any[],
    falseFnoStories: [] as any[],
    routingMatrix: [] as any[]
  };

  for (const article of articles) {
    const headline = article.headline || '';
    const body = article.body || '';
    
    const result = FNOEligibilityEngine.evaluate(headline, body);
    
    const currentFno = article.fno || { eligible: false };
    
    // Check if current stored decision matches current engine logic
    // (In case engine was updated but articles not re-processed)
    const engineEligible = result.eligible;
    const storedEligible = currentFno.eligible;

    if (engineEligible) {
      auditResults.fnoArticles++;
      if (result.symbol) auditResults.uniqueFnoSymbols.add(result.symbol);
    }

    // Matrix entry
    const entry = {
      id: article.id,
      headline: headline.substring(0, 50) + '...',
      resolvedSymbol: result.symbol,
      engineEligible,
      storedEligible,
      reason: result.reason
    };
    auditResults.routingMatrix.push(entry);

    // Forensic logic for MISSED stories (Authoritative company in headline but excluded)
    // We look for articles that HAVE a symbol but are NOT eligible
    if (result.symbol && !engineEligible) {
      // Check if it was because of an exclusion term
      if (result.reason.includes('Excluded due to exclusion filter term')) {
        // If it also had a Tier 2 catalyst mentioned in the text (even if engine didn't reach that step)
        // We need to check if we SHOULD have included it.
        auditResults.missedFnoStories.push({
          id: article.id,
          headline,
          symbol: result.symbol,
          reason: result.reason
        });
      }
    }
  }

  const report = {
    totalArticles: auditResults.totalArticles,
    fnoArticles: auditResults.fnoArticles,
    uniqueFnoSymbols: auditResults.uniqueFnoSymbols.size,
    missedFnoStories: auditResults.missedFnoStories.length,
    falseFnoStories: auditResults.falseFnoStories.length,
    missedDetails: auditResults.missedFnoStories,
    uniqueSymbolsList: Array.from(auditResults.uniqueFnoSymbols).sort()
  };

  console.log(JSON.stringify(report, null, 2));
}

runAudit().catch(console.error);
