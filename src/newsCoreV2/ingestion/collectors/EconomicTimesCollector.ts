import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class EconomicTimesCollector implements NewsCollector {
  public name = "Economic Times";

  public async collect(): Promise<RawNewsItem[]> {
    const urls = [
      "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms"
    ];
    const fallbacks = [
      "https://news.google.com/rss/search?q=site:economictimes.indiatimes.com+markets&hl=en-IN&gl=IN&ceid=IN:en"
    ];

    const results: RawNewsItem[] = [];
    const promises = urls.map((url) => RSSHelper.fetchAndParseRSS(url, "Economic Times", 7500, fallbacks));
    const settlements = await Promise.allSettled(promises);
    for (const res of settlements) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        results.push(...res.value);
      }
    }
    return results;
  }
}
