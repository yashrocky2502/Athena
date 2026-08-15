import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class LiveMintCollector implements NewsCollector {
  public name = "LiveMint";

  public async collect(): Promise<RawNewsItem[]> {
    const primaryUrl = "https://www.livemint.com/rss/markets";
    const fallbackUrls = [
      "https://news.google.com/rss/search?q=site:livemint.com+markets&hl=en-IN&gl=IN&ceid=IN:en"
    ];
    return await RSSHelper.fetchAndParseRSS(primaryUrl, "LiveMint", 12000, fallbackUrls);
  }
}
