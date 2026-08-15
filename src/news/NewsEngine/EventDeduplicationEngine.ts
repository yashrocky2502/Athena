import { NewsItem, RelatedSource } from '../models/NewsItem';
import { ProductionLogger } from './ProductionLogger';

export class EventDeduplicationEngine {
  public static getSourceTier(publisher: string): 1 | 2 | 3 {
    const pub = (publisher || '').toLowerCase();
    
    // Tier 1: Top premium publishers and official exchange feeds
    const tier1 = [
      'bloomberg', 'reuters', 'financial times', 'moneycontrol', 'economic times', 
      'cnbc', 'mint', 'livemint', 'business standard', 'bse', 'nse', 
      'exchange filing', 'filing', 'sec', 'sebi', 'rbi'
    ];
    
    // Tier 2: Large national publishers & secondary finance sites
    const tier2 = [
      'yahoo', 'times of india', 'ndtv', 'techcrunch', 'forbes', 
      'republic', 'hindustan times', 'zeebiz', 'ndtv profit'
    ];
    
    if (tier1.some(t => pub.includes(t))) return 1;
    if (tier2.some(t => pub.includes(t))) return 2;
    return 3;
  }

  public static calculateTitleSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (s1 === s2) return 1.0;

    const words1 = s1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = s2.split(/\s+/).filter((w) => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    let matchCount = 0;
    for (const w of set1) {
      if (set2.has(w)) matchCount++;
    }

    const minSize = Math.min(set1.size, set2.size);
    return matchCount / minSize;
  }

  public static groupAndDeduplicate(items: NewsItem[]): NewsItem[] {
    const groups: NewsItem[][] = [];

    for (const item of items) {
      let addedToGroup = false;

      const itemTitle = item.headline || '';
      const itemCompanies = (item.companies || []).map(c => c.ticker || c.name.toLowerCase());
      const itemPublishedAt = new Date(item.publishedAt).getTime();

      for (const group of groups) {
        const rep = group[0];
        const repTitle = rep.headline || '';
        const repCompanies = (rep.companies || []).map(c => c.ticker || c.name.toLowerCase());
        const repPublishedAt = new Date(rep.publishedAt).getTime();

        // 1. Time window constraint (48 hours max)
        const timeDiffHours = Math.abs(itemPublishedAt - repPublishedAt) / (1000 * 60 * 60);
        if (timeDiffHours > 48) continue;

        // 2. Similarity index
        const titleSim = this.calculateTitleSimilarity(itemTitle, repTitle);
        
        // 3. Company overlap check
        const hasCompanyOverlap = itemCompanies.length > 0 && repCompanies.length > 0 && 
          itemCompanies.some(c => repCompanies.includes(c));

        let isMatch = false;
        if (hasCompanyOverlap && titleSim >= 0.55) {
          isMatch = true;
        } else if (titleSim >= 0.70) {
          isMatch = true;
        }

        if (isMatch) {
          group.push(item);
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        groups.push([item]);
      }
    }

    // Keep track of duplicate group counts in ProductionLogger
    ProductionLogger.getInstance().setDuplicateGroupsCount(groups.length);

    const deduplicatedItems: NewsItem[] = [];

    for (const group of groups) {
      // Sort each cluster so the master is the most trusted source
      group.sort((a, b) => {
        const tierA = this.getSourceTier(a.publisher);
        const tierB = this.getSourceTier(b.publisher);
        if (tierA !== tierB) return tierA - tierB; // Lower tier is better (1 is Tier 1)

        // Tiebreaker 1: Presence of extracted companies
        const aHasComp = (a.companies || []).length > 0 ? 1 : 0;
        const bHasComp = (b.companies || []).length > 0 ? 1 : 0;
        if (aHasComp !== bHasComp) return bHasComp - aHasComp;

        // Tiebreaker 2: Title detail length
        return (b.headline?.length || 0) - (a.headline?.length || 0);
      });

      const master = group[0];
      const others = group.slice(1);

      if (others.length > 0) {
        master.relatedSources = others.map(item => ({
          publisher: item.publisher,
          url: item.url,
          publishedAt: item.publishedAt,
          headline: item.headline
        }));
      } else {
        master.relatedSources = [];
      }

      deduplicatedItems.push(master);
    }

    return deduplicatedItems;
  }
}
