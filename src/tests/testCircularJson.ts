import { ArticleRepository } from '../news/NewsEngine/ArticleRepository';
import { ArticleExtractor } from '../news/NewsEngine/ArticleExtractor';
import { SummaryService } from '../news/NewsEngine/SummaryService';
import { FilingIntelligenceEngine } from '../news/NewsEngine/FilingIntelligenceEngine';
import { FeedService } from '../news/NewsEngine/FeedService';

async function test() {
  const feedService = FeedService.getInstance();
  await feedService.getFeed('All');
  const repo = ArticleRepository.getInstance();
  const feed = repo.getAllItems();
  console.log('Total items in repo:', feed.length);
  if (feed.length === 0) return;

  for (let i = 0; i < Math.min(10, feed.length); i++) {
    const item = feed[i];
    console.log(`\nTesting article ${i}: id=${item.id}, title=${item.title}`);
    try {
      let content = repo.getEnrichedContent(item.id);
      if (!content) {
        content = await ArticleExtractor.getInstance().extractArticleContent(item, false);
        repo.saveEnrichedContent(item.id, content);
      }
      
      const isFiling = FilingIntelligenceEngine.getInstance().isCorporateFiling(content);
      if (isFiling) {
        await FilingIntelligenceEngine.getInstance().processFiling(content);
      } else {
        await SummaryService.getInstance().getSummary(content, false);
      }
      content.intelligence = SummaryService.parseArticleIntelligence(content, content.body || '');

      // Try JSON.stringify
      const jsonStr = JSON.stringify(content);
      console.log(`✓ JSON.stringify succeeded for article ${item.id} (len: ${jsonStr.length})`);
    } catch (err: any) {
      console.error(`❌ JSON.stringify FAILED for article ${item.id}:`, err.message);
      console.error(err.stack);
    }
  }
}

test();
