import fs from 'fs';
import { resolveFNOEligibility } from '../src/news/FNO/FNOEligibilityResolver';
import { FNORelevanceEngine } from '../src/news/FNO/FNORelevanceEngine';
import { CanonicalClassificationEngine } from '../src/news/NewsEngine/CanonicalClassificationEngine';
import { mapV3StoryToNewsArticle } from '../src/news/models/mapV3Story';
import { NewsClassifier } from '../src/news/NewsEngine/Classifier';

async function main() {
  const raw = fs.readFileSync('/tmp/feed.json', 'utf-8');
  const feed = JSON.parse(raw);
  const articles = Array.isArray(feed) ? feed : (feed.articles || []);

  console.log('Total articles in /tmp/feed.json:', articles.length);

  const eligibleStories: any[] = [];
  const negPatternCounts: Record<string, number> = {};
  const tier1Counts: Record<string, number> = {};
  const tier2Counts: Record<string, number> = {};

  for (const item of articles) {
    const elig = resolveFNOEligibility(item);
    if (elig.eligible) {
      const audit = FNORelevanceEngine.evaluateAudit(item);
      eligibleStories.push({ item, elig, audit });

      const title = (item.title || item.headline || '').toString();
      const body = (item.summary || item.description || item.content || item.body || '').toString();
      const textLower = `${title} \n ${body}`.toLowerCase();

      for (const pat of FNORelevanceEngine.TIER_1_PATTERNS) {
        if (pat.regex.test(textLower)) {
          tier1Counts[pat.id] = (tier1Counts[pat.id] || 0) + 1;
        }
      }

      for (const pat of FNORelevanceEngine.TIER_2_PATTERNS) {
        if (pat.regex.test(textLower)) {
          tier2Counts[pat.id] = (tier2Counts[pat.id] || 0) + 1;
        }
      }

      for (const pat of FNORelevanceEngine.NEGATIVE_PATTERNS) {
        if (pat.regex.test(textLower)) {
          negPatternCounts[pat.id] = (negPatternCounts[pat.id] || 0) + 1;
        }
      }
    }
  }

  console.log('\n================ PIPELINE BREAKDOWN ================');
  console.log('1. Total Feed Stories:', articles.length);
  console.log('2. F&O Underlying Eligible Stories:', eligibleStories.length);

  const includedAudit = eligibleStories.filter(s => s.audit.fnoDecision === 'INCLUDE');
  console.log('3. FNORelevanceEngine audit.fnoDecision === INCLUDE:', includedAudit.length);

  const canonicalIsFO = articles.filter(item => CanonicalClassificationEngine.classify(item).isFO);
  console.log('4. CanonicalClassificationEngine.classify isFO === true:', canonicalIsFO.length);

  const grouped = NewsClassifier.groupArticlesByCategory(articles);
  console.log('5. NewsClassifier.groupArticlesByCategory F&O count:', grouped['F&O'] ? grouped['F&O'].length : 0);

  console.log('\n--- TIER 1 DERIVATIVE MATCHES ---', tier1Counts);
  console.log('\n--- TIER 2 MATERIAL EVENT MATCHES ---', tier2Counts);
  console.log('\n--- NEGATIVE PATTERN MATCHES ---', negPatternCounts);

  console.log('\n--- TOP 20 F&O ELIGIBLE STORIES BREAKDOWN ---');
  eligibleStories.slice(0, 20).forEach((s, idx) => {
    console.log(`\n#${idx + 1} [${s.elig.symbol}] ${s.item.title || s.item.headline}`);
    console.log(`   Publisher: ${s.item.publisher?.name || s.item.publisher}`);
    console.log(`   Relevance: ${s.audit.fnoRelevance} | Score: ${s.audit.fnoScore} | Decision: ${s.audit.fnoDecision}`);
    console.log(`   Reasons: ${s.audit.fnoReasons.join(' | ')}`);
  });
}

main().catch(console.error);
