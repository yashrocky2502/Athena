import { NewsArticleV2 } from "../domain/NewsArticle.ts";
import { IntelligenceRecord } from "../intelligenceV2/IntelligenceTypes.ts";
import { UnifiedIntelligenceEngine } from "../intelligenceV2/UnifiedIntelligenceEngine.ts";

export class TelegramNewsFormatter {
  /**
   * Formats a canonical IntelligenceRecord or NewsArticleV2 into a compact,
   * information-dense, high-precision Telegram notification (~700–900 chars).
   */
  public static format(recordOrArticle: IntelligenceRecord | NewsArticleV2, customOptionsImpact?: string): string {
    const record: IntelligenceRecord = (recordOrArticle as any).intelligenceVersion
      ? (recordOrArticle as IntelligenceRecord)
      : UnifiedIntelligenceEngine.build(recordOrArticle as NewsArticleV2);

    const companyOrSubject = record.companyName || record.symbol || "Broad Market";
    const cleanHeadline = this.sanitizeText(record.headline);

    // Determine Header Type
    let headerType = "HIGH IMPACT";
    const categoryUpper = (record.category || "").toUpperCase();
    if (categoryUpper === "RESULTS" || /q[1-4]|earnings|profit/i.test(cleanHeadline)) {
      headerType = "EARNINGS";
    } else if (categoryUpper === "REGULATORY" || categoryUpper === "ECONOMY" || /sebi|rbi|penalty|investigation/i.test(cleanHeadline)) {
      headerType = "REGULATORY";
    } else if (categoryUpper === "IPO" || /ipo|gmp|listing/i.test(cleanHeadline)) {
      headerType = "IPO";
    } else if (categoryUpper === "CRYPTO") {
      headerType = "CRYPTO";
    } else if (categoryUpper === "COMMODITIES" || categoryUpper === "COMMODITY") {
      headerType = "COMMODITY";
    } else if (record.urgency === "CRITICAL") {
      headerType = "BREAKING ALERT";
    }

    // Build header block
    let text = `🚨 <b>ATHENA | ${headerType}</b>\n\n`;

    // Title / Subject line
    const titleLine = companyOrSubject !== "Broad Market" && !cleanHeadline.toLowerCase().includes(companyOrSubject.toLowerCase())
      ? `${companyOrSubject} — ${cleanHeadline}`
      : cleanHeadline;
    
    text += `<b>${this.escapeHtml(titleLine)}</b>\n\n`;

    // Category & Impact Line
    const catBadge = record.category ? `🏷️ <b>${this.escapeHtml(record.category)}</b> | ` : "";
    text += `${catBadge}📊 <b>Impact: ${record.materialityScore}/100</b> | <b>Urgency: ${record.urgency}</b>\n\n`;

    // Key Bullets (Facts & Metrics) - Max 3-4 bullets
    const bullets: string[] = [];

    if (record.financialMetrics && record.financialMetrics.length > 0) {
      for (const m of record.financialMetrics.slice(0, 3)) {
        let changeStr = "";
        if (m.changePercent !== undefined && m.changePercent !== null) {
          const sign = m.direction === "UP" ? "↑ " : m.direction === "DOWN" ? "↓ " : "";
          changeStr = ` (${sign}${Math.abs(m.changePercent)}%)`;
        } else if (m.direction === "UP") {
          changeStr = " (↑)";
        } else if (m.direction === "DOWN") {
          changeStr = " (↓)";
        }
        bullets.push(`${m.name}: ${this.formatCompactMetric(m.displayText)}${changeStr}`);
      }
    }

    if (record.keyFacts && record.keyFacts.length > 0 && bullets.length < 3) {
      for (const fact of record.keyFacts) {
        if (bullets.length >= 3) break;
        const cleanFact = this.sanitizeText(fact);
        if (cleanFact && !bullets.some(b => b.toLowerCase().includes(cleanFact.slice(0, 20).toLowerCase()))) {
          bullets.push(cleanFact);
        }
      }
    }

    if (bullets.length === 0 && record.executiveSummary) {
      bullets.push(this.sanitizeText(record.executiveSummary));
    }

    for (const b of bullets) {
      text += `• ${this.escapeHtml(b)}\n`;
    }
    text += `\n`;

    // Read-through / Why It Matters
    if (record.whyItMatters && record.whyItMatters.trim()) {
      text += `🧠 <b>Read-through:</b>\n${this.escapeHtml(this.sanitizeText(record.whyItMatters))}\n\n`;
    }

    // F&O Implications
    text += `📌 <b>F&O:</b>\n`;
    const fnoText = customOptionsImpact || record.optionsSellerImpact;
    if (!fnoText || fnoText.includes("No actionable F&O setup from this article alone")) {
      text += `No material F&O implication identified.\n\n`;
    } else {
      text += `${this.escapeHtml(this.sanitizeText(fnoText))}\n\n`;
    }

    // Watchpoints (1 brief point max)
    if (record.risk && record.risk.length > 0) {
      const firstRisk = record.risk.find(r => !r.toLowerCase().includes("financial metric source") && !r.toLowerCase().includes("monitor post-announcement price"));
      const watchText = firstRisk || "Post-announcement price action / volume confirmation";
      text += `⚠️ <b>Watch:</b>\n${this.escapeHtml(this.sanitizeText(watchText))}\n\n`;
    }

    // Source & Time
    const sourceName = record.source || "Market Wire";
    const pubTime = record.publishedAt
      ? new Date(record.publishedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "Just now";

    text += `<b>Source:</b> ${this.escapeHtml(sourceName)} • ${pubTime}`;

    // Ensure strict character cap protection (~900 chars target, max 1200)
    if (text.length > 1150) {
      text = text.slice(0, 1140) + "...\n\n<b>Source:</b> " + this.escapeHtml(sourceName);
    }

    return text;
  }

  private static sanitizeText(str: string): string {
    if (!str) return "";
    return str
      .replace(/<[^>]*>/g, "")
      .replace(/https?:\/\/news\.google\.com\/[^\s]+/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static formatCompactMetric(displayText: string): string {
    if (!displayText) return "";
    return displayText
      .replace(/crore/gi, "Cr")
      .replace(/crores/gi, "Cr")
      .replace(/billion/gi, "Bn")
      .replace(/million/gi, "Mn")
      .replace(/lakh/gi, "Lakh");
  }

  public static escapeHtml(str: string): string {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
