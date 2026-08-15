import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class GoogleNewsRSSCollector implements NewsCollector {
  public name = "Google News Indian Business";

  public async collect(): Promise<RawNewsItem[]> {
    const url = "https://news.google.com/rss/search?q=Indian+Stock+Market+OR+NSE+OR+BSE+OR+Nifty&hl=en-IN&gl=IN&ceid=IN:en";
    const items = await RSSHelper.fetchAndParseRSS(url, "Google News Business");
    return items;
  }
}
