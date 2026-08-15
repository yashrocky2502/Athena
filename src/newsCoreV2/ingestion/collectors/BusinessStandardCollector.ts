import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class BusinessStandardCollector implements NewsCollector {
  public name = "Business Standard";

  public async collect(): Promise<RawNewsItem[]> {
    const primaryUrl = "https://www.business-standard.com/rss/markets-106.rss";
    const fallbackUrls = [
      "https://news.google.com/rss/search?q=site:business-standard.com+markets&hl=en-IN&gl=IN&ceid=IN:en"
    ];
    return await RSSHelper.fetchAndParseRSS(primaryUrl, "Business Standard", 12000, fallbackUrls);
  }
}
