import { RawNewsItem } from "../NewsCollector";

export class RSSHelper {
  /**
   * Fetches an RSS feed and parses <item> or <entry> blocks safely.
   */
  public static async fetchAndParseRSS(
    feedUrl: string,
    publisherName: string,
    timeoutMs = 7500,
    fallbackUrls: string[] = []
  ): Promise<RawNewsItem[]> {
    const urlsToTry = [feedUrl, ...fallbackUrls];

    for (let i = 0; i < urlsToTry.length; i++) {
      const currentUrl = urlsToTry[i];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*"
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${publisherName}`);
        }

        const xmlText = await response.text();
        const items = this.parseRSSXML(xmlText, publisherName);
        if (items.length > 0 || i === urlsToTry.length - 1) {
          return items;
        }
      } catch (err: any) {
        const isAbort = err.name === "AbortError" || err.message?.includes("aborted");
        const errMsg = isAbort ? `Request timed out after ${timeoutMs}ms` : err.message;

        if (i < urlsToTry.length - 1) {
          console.warn(`[RSSCollector] Primary URL failed for ${publisherName} (${currentUrl}): ${errMsg}. Trying fallback...`);
        } else {
          console.warn(`[RSSCollector] Error fetching ${publisherName} (${currentUrl}): ${errMsg}`);
          return [];
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return [];
  }

  /**
   * Parses XML RSS/Atom string using regex pattern matching.
   */
  public static parseRSSXML(xmlText: string, publisherName: string): RawNewsItem[] {
    const items: RawNewsItem[] = [];
    if (!xmlText) return items;

    // Match all <item>...</item> or <entry>...</entry>
    const itemRegex = /<(item|entry)[\s\S]*?>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const block = match[2];

      const title = this.extractTagContent(block, "title");
      const link = this.extractTagContent(block, "link") || this.extractLinkAttribute(block);
      const description =
        this.extractTagContent(block, "description") ||
        this.extractTagContent(block, "content") ||
        this.extractTagContent(block, "summary");
      const pubDate =
        this.extractTagContent(block, "pubDate") ||
        this.extractTagContent(block, "published") ||
        this.extractTagContent(block, "updated") ||
        this.extractTagContent(block, "dc:date");

      if (title && (link || title.length > 10)) {
        items.push({
          headline: title,
          body: description || title,
          url: link || "",
          publisher: publisherName,
          publishedAt: pubDate || new Date().toISOString(),
          collectionMethod: "RSS"
        });
      }
    }

    return items;
  }

  private static extractTagContent(xmlBlock: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = regex.exec(xmlBlock);
    if (!match) return "";

    let content = match[1].trim();
    // Strip CDATA wrapper if present
    if (content.startsWith("<![CDATA[") && content.endsWith("]]>")) {
      content = content.slice(9, -3).trim();
    }
    return content;
  }

  private static extractLinkAttribute(xmlBlock: string): string {
    const match = /<link[^>]+href=["']([^"']+)["']/i.exec(xmlBlock);
    return match ? match[1] : "";
  }
}
