import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class MoneycontrolCollector implements NewsCollector {
  public name = "Moneycontrol";

  public async collect(): Promise<RawNewsItem[]> {
    const primaryUrl = "https://news.google.com/rss/search?q=site:moneycontrol.com+news&hl=en-IN&gl=IN&ceid=IN:en";
    const fallbackUrls = [
      "https://www.moneycontrol.com/rss/MCtopnews.xml"
    ];
    return await RSSHelper.fetchAndParseRSS(primaryUrl, "Moneycontrol", 7500, fallbackUrls);
  }
}
