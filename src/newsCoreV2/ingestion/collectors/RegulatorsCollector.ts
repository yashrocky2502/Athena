import { NewsCollector, RawNewsItem } from "../NewsCollector";
import { RSSHelper } from "./RSSHelper";

export class PIBCollector implements NewsCollector {
  public name = "Press Information Bureau (PIB)";

  public async collect(): Promise<RawNewsItem[]> {
    const primaryUrl = "https://news.google.com/rss/search?q=site:pib.gov.in&hl=en-IN&gl=IN&ceid=IN:en";
    const fallbackUrls = [
      "https://pib.gov.in/RssMain.aspx?ModId=6",
      "https://pib.gov.in/RssMain.aspx?ModId=1"
    ];
    return await RSSHelper.fetchAndParseRSS(primaryUrl, "Press Information Bureau", 7500, fallbackUrls);
  }
}

export class RBICollector implements NewsCollector {
  public name = "Reserve Bank of India (RBI)";

  public async collect(): Promise<RawNewsItem[]> {
    const url = "https://news.google.com/rss/search?q=site:rbi.org.in+OR+%22Reserve+Bank+of+India%22&hl=en-IN&gl=IN&ceid=IN:en";
    return await RSSHelper.fetchAndParseRSS(url, "RBI", 7500);
  }
}

export class SEBICollector implements NewsCollector {
  public name = "SEBI Press Releases";

  public async collect(): Promise<RawNewsItem[]> {
    const primaryUrl = "https://news.google.com/rss/search?q=site:sebi.gov.in+OR+%22SEBI%22+press+release&hl=en-IN&gl=IN&ceid=IN:en";
    const fallbackUrls = [
      "https://www.sebi.gov.in/sebirss.xml",
      "https://news.google.com/rss/search?q=SEBI+circular+OR+press+release+India&hl=en-IN&gl=IN&ceid=IN:en"
    ];
    return await RSSHelper.fetchAndParseRSS(primaryUrl, "SEBI", 7500, fallbackUrls);
  }
}

export class NSECollector implements NewsCollector {
  public name = "NSE Corporate Announcements";

  public async collect(): Promise<RawNewsItem[]> {
    const url = "https://news.google.com/rss/search?q=NSE+Corporate+Announcement+India&hl=en-IN&gl=IN&ceid=IN:en";
    return await RSSHelper.fetchAndParseRSS(url, "NSE");
  }
}

export class BSECollector implements NewsCollector {
  public name = "BSE Corporate Announcements";

  public async collect(): Promise<RawNewsItem[]> {
    const url = "https://news.google.com/rss/search?q=BSE+Corporate+Announcement+India&hl=en-IN&gl=IN&ceid=IN:en";
    return await RSSHelper.fetchAndParseRSS(url, "BSE");
  }
}
