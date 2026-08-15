import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class CNBCTV18Collector implements NewsCollector {
  public name = "CNBC TV18";

  public async collect(): Promise<RawNewsItem[]> {
    const url = "https://news.google.com/rss/search?q=site:cnbctv18.com+market&hl=en-IN&gl=IN&ceid=IN:en";
    return await RSSHelper.fetchAndParseRSS(url, "CNBC TV18");
  }
}

