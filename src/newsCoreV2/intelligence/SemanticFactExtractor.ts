import { MetricDirection } from "../intelligenceV2/IntelligenceTypes.ts";

export type MetricType =
  | "PAT"
  | "Revenue"
  | "Total Income"
  | "EBITDA"
  | "EBITDA Margin"
  | "EPS"
  | "NII"
  | "Debt"
  | "Order Book"
  | "Sales Volume"
  | "Margin"
  | "Credit Rating"
  | "IPO";

export interface ExtractedFactMetric {
  metricName: MetricType;
  currentValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  changeType?: "YoY" | "QoQ" | "Sequential" | "Annual" | "None";
  direction: MetricDirection;
  unit: string;
  period?: string;
  comparatorPeriod?: string;
  sourceSentence: string;
  displayText: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  status: "RESOLVED" | "UNRESOLVED";
  metadata?: Record<string, any>;
}

export interface MetricPatternDef {
  name: MetricType;
  regex: RegExp;
  priority: number;
}

const METRIC_PATTERNS: MetricPatternDef[] = [
  { name: "EBITDA Margin", regex: /\b(ebitda margin|operating margin|npm|net profit margin)\b/i, priority: 1 },
  { name: "PAT", regex: /\b(net profit|profit after tax|pat|pure profit|net loss|standalone profit|consolidated profit|bottomline|q[1-4]\s+profit|profit\s+(?:rises|rose|rise|falls|fell|fall|drops|dropped|declines|declined|jumps|jumped|surges|surged|grew|grows|stands|stood|of|at|reported|up|down))\b/i, priority: 2 },
  { name: "Total Income", regex: /\b(total income)\b/i, priority: 3 },
  { name: "Revenue", regex: /\b(revenue from operations|total revenue|revenue|topline|turnover|(?:net\s+sales|sales)\s+(?:rises?|rose|declines?|declined|reported|of|grew|stood|surged|jumped|dropped|up|down))\b/i, priority: 4 },
  { name: "EBITDA", regex: /\b(ebitda|operating profit)\b/i, priority: 5 },
  { name: "EPS", regex: /\b(eps|earnings per share|diluted eps)\b/i, priority: 6 },
  { name: "NII", regex: /\b(net interest income|nii)\b/i, priority: 7 },
  { name: "Debt", regex: /\b(total debt|net debt|borrowings)\b/i, priority: 8 },
  { name: "Order Book", regex: /\b(order book|order intake|order inflow|bags order|awarded order|won order|secures order)\b/i, priority: 9 },
  { name: "Margin", regex: /\b(margin)\b/i, priority: 10 },
];

/**
 * Deterministic, source-grounded Semantic Fact Extractor.
 * Parses clauses, prepositions, conjunctions, periods, and financial entities
 * to prevent number cross-contamination between metrics in multi-metric sentences.
 */
export class SemanticFactExtractor {
  /**
   * Main entry point to extract financial facts from headline and body text.
   */
  public static extractFacts(text: string): ExtractedFactMetric[] {
    if (!text || typeof text !== "string") return [];

    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 1. Break text into logical sentences (handling missing terminal periods)
    const normalizedSentencesText = cleanText.replace(/(quarter|FY\d{2,4})\s+(?=[A-Z])/gi, "$1. ");
    const rawSentences = normalizedSentencesText.split(/(?<=[.?!;])\s+|\n+/).filter(s => s.trim().length > 5);
    const facts: ExtractedFactMetric[] = [];

    // Extract credit ratings across the text
    const ratingFact = this.extractCreditRating(cleanText);
    if (ratingFact) {
      facts.push(ratingFact);
    }

    // Extract IPO specifics (price band, expected listing)
    const ipoFact = this.extractIpoDetails(cleanText);
    if (ipoFact) {
      facts.push(ipoFact);
    }

    for (const sentence of rawSentences) {
      const sentenceFacts = this.parseSentence(sentence);
      for (const fact of sentenceFacts) {
        const existingIdx = facts.findIndex(f => f.metricName === fact.metricName);
        if (existingIdx === -1) {
          facts.push(fact);
        } else {
          // Merge / upgrade existing metric with more specific / precise data
          const existing = facts[existingIdx];
          
          let bestValue = existing.currentValue;
          if (fact.currentValue !== null) {
            if (bestValue === null) {
              bestValue = fact.currentValue;
            } else if (Math.floor(bestValue) === Math.floor(fact.currentValue) && fact.currentValue.toString().includes('.')) {
              bestValue = fact.currentValue;
            }
          }

          const bestPct = fact.changePercent !== null ? fact.changePercent : existing.changePercent;
          const bestDirection = fact.direction !== "NEUTRAL" ? fact.direction : existing.direction;
          const bestPeriod = existing.period || fact.period;
          const bestCompPeriod = existing.comparatorPeriod || fact.comparatorPeriod;
          const bestChangeType = (fact.changeType && fact.changeType !== "None") ? fact.changeType : existing.changeType;
          const bestSource = fact.changePercent !== null || (fact.currentValue !== null && fact.currentValue.toString().includes('.')) ? fact.sourceSentence : existing.sourceSentence;

          let display = existing.displayText;
          if (bestValue !== null) {
            const formatted = Math.abs(bestValue).toLocaleString("en-IN");
            const unit = fact.unit || existing.unit || "Cr";
            display = bestValue < 0 ? `Net Loss of ₹${formatted} ${unit}` : `₹${formatted} ${unit}`;
          } else if (bestPct !== null) {
            display = `${bestDirection === "UP" ? "+" : bestDirection === "DOWN" ? "-" : ""}${Math.abs(bestPct)}%`;
          }

          facts[existingIdx] = {
            ...existing,
            currentValue: bestValue,
            previousValue: existing.previousValue ?? fact.previousValue,
            change: existing.change ?? fact.change,
            changePercent: bestPct,
            changeType: bestChangeType,
            direction: bestDirection,
            period: bestPeriod,
            comparatorPeriod: bestCompPeriod,
            sourceSentence: bestSource,
            displayText: display,
            confidence: "HIGH",
            status: "RESOLVED",
          };
        }
      }
    }

    return facts;
  }

  /**
   * Splits a sentence into semantic metric clauses and extracts facts.
   */
  private static parseSentence(sentence: string): ExtractedFactMetric[] {
    const trimmed = sentence.trim();
    if (!trimmed) return [];

    const extracted: ExtractedFactMetric[] = [];

    // Detect overall period mentioned in the sentence
    const periodMatch = trimmed.match(/\b(Q[1-4]\s*(?:FY\s*\d{2,4})?|(?:June|September|December|March)\s*\d{4}\s*quarter|FY\s*\d{2,4})\b/i);
    const sentencePeriod = periodMatch ? periodMatch[1].replace(/\s+/g, " ").trim() : undefined;

    // Detect comparator period (e.g. "compared with Q1 FY26", "vs Q1 FY26", "against Q4 FY26")
    const compPeriodMatch = trimmed.match(/(?:compared\s+with|vs\.?|against|from)\s+(Q[1-4]\s*(?:FY\s*\d{2,4})?|(?:June|September|December|March)\s*\d{4}\s*quarter|FY\s*\d{2,4})\b/i);
    const comparatorPeriod = compPeriodMatch ? compPeriodMatch[1].replace(/\s+/g, " ").trim() : undefined;

    // Volume sales check (e.g., "sells 48,763 CV units", "sold 12,000 units", "commercial vehicle volumes hitting a record 48,763 units")
    const volumeMatch = trimmed.match(/\b(?:sells?|sold|sales\s+volume\s+of|vehicle\s+sales\s+of|commercial\s+vehicle\s+volumes?\s+(?:hitting\s+(?:a\s+record\s+|record\s+)?|reaching\s+|at\s+|of\s+)?|vehicle\s+volumes?\s+(?:hitting\s+(?:a\s+record\s+|record\s+)?|reaching\s+|at\s+|of\s+)?|volumes?\s+(?:hitting\s+(?:a\s+record\s+|record\s+)?|reaching\s+|at\s+|of\s+)?)\s*([\d,]+)\s*((?:[A-Za-z]+\s+)?units?|vehicles?|tractors?|trucks?|two-wheelers?)\b/i);
    if (volumeMatch) {
      const volNum = parseFloat(volumeMatch[1].replace(/,/g, ""));
      const volUnit = volumeMatch[2].trim();
      extracted.push({
        metricName: "Sales Volume",
        currentValue: volNum,
        previousValue: null,
        change: null,
        changePercent: null,
        changeType: "None",
        direction: "NEUTRAL",
        unit: volUnit,
        period: sentencePeriod,
        sourceSentence: volumeMatch[0].trim(),
        displayText: `${volNum.toLocaleString("en-IN")} ${volUnit}`,
        confidence: "HIGH",
        status: "RESOLVED",
      });
    }

    // Segment sentence based on metric positions and connectors
    const segments = this.segmentSentenceByMetrics(trimmed);

    for (const segment of segments) {
      const clauseFacts = this.extractFromClause(segment, trimmed, sentencePeriod, comparatorPeriod);
      for (const cf of clauseFacts) {
        if (!extracted.some(e => e.metricName === cf.metricName)) {
          extracted.push(cf);
        }
      }
    }

    return extracted;
  }

  /**
   * Intelligently segments a compound sentence into metric-specific clauses.
   */
  private static segmentSentenceByMetrics(sentence: string): string[] {
    const rawMatches: { name: MetricType; index: number; matchText: string }[] = [];

    for (const p of METRIC_PATTERNS) {
      const r = new RegExp(p.regex.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = r.exec(sentence)) !== null) {
        rawMatches.push({ name: p.name, index: m.index, matchText: m[0] });
      }
    }

    rawMatches.sort((a, b) => a.index - b.index);

    // Group close / synonym matches (e.g. "Operating profit (EBITDA)" or "EBITDA Margin" & "Margin")
    const uniqueMatches: typeof rawMatches = [];
    for (const m of rawMatches) {
      const isNearby = uniqueMatches.some(u => Math.abs(u.index - m.index) < 18);
      if (!isNearby) {
        uniqueMatches.push(m);
      }
    }

    if (uniqueMatches.length <= 1) {
      return [sentence];
    }

    const boundaries = [0];
    for (let i = 0; i < uniqueMatches.length - 1; i++) {
      const leftIndex = uniqueMatches[i].index;
      const leftText = uniqueMatches[i].matchText;
      const rightIndex = uniqueMatches[i + 1].index;
      const mid = sentence.slice(leftIndex + leftText.length, rightIndex);

      // Match connectors: on, while, whereas, and, with, against, vs, or comma NOT between digits
      const connRegex = /\b(?:on\s+(?:a|an)?|while|whereas|and|with\s+(?:a|an)?|against|compared\s+to|compared\s+with|vs\.?)\b|;|(?<!\d),(?!\d)/gi;
      let lastMatch: RegExpExecArray | null = null;
      let cm: RegExpExecArray | null;
      while ((cm = connRegex.exec(mid)) !== null) {
        lastMatch = cm;
      }
      if (lastMatch) {
        boundaries.push(leftIndex + leftText.length + lastMatch.index);
      } else {
        const pctMatch = mid.match(/[\+-]?\d+(?:\.\d+)?%\s*(?:rise|increase|growth|jump|surge|fall|decline|drop|slip)?\s*(?:in\s+)?(?=[a-zA-Z\s]*$)/i);
        if (pctMatch && pctMatch.index !== undefined) {
          boundaries.push(leftIndex + leftText.length + pctMatch.index);
        } else {
          boundaries.push(rightIndex);
        }
      }
    }
    boundaries.push(sentence.length);

    const segments: string[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const seg = sentence.slice(boundaries[i], boundaries[i + 1]).trim();
      if (seg) segments.push(seg);
    }

    return segments.length > 0 ? segments : [sentence];
  }

  /**
   * Extracts metric facts from a single scoped clause.
   */
  private static extractFromClause(
    clause: string,
    fullSentence: string,
    sentencePeriod?: string,
    sentenceCompPeriod?: string
  ): ExtractedFactMetric[] {
    const results: ExtractedFactMetric[] = [];
    const lower = clause.toLowerCase();

    const metricType = this.identifyMetricType(lower);
    if (!metricType) {
      return results;
    }

    // 1. Direction
    let direction: MetricDirection = "NEUTRAL";
    const isNetLoss = lower.includes("net loss") || lower.includes("loss of") || lower.includes("incurred a loss") || lower.includes("swings to loss");
    const isTurnaround = lower.includes("swings to profit") || lower.includes("turns profit") || lower.includes("turnaround");

    if (isTurnaround) {
      direction = "UP";
    } else if (isNetLoss) {
      direction = "DOWN";
    } else if (/\b(rises|rose|rise|surges|surged|jumps|jumped|grew|grows|growth|up|increased|increase|climbs|climbed|soars|soared|gains|gained)\b/i.test(clause)) {
      direction = "UP";
    } else if (/\b(falls|fell|fall|drops|dropped|slumps|slumped|declines|declined|decline|down|decreased|decrease|plunges|plunged|sinks|sank|slips|slipped|cuts|cut)\b/i.test(clause)) {
      direction = "DOWN";
    } else if (/\b(flat|unchanged|steady|stagnant)\b/i.test(clause)) {
      direction = "FLAT";
    }

    // 2. Change percent
    let changePercent: number | null = null;
    let changeType: ExtractedFactMetric["changeType"] = "None";

    const pctMatch = clause.match(/([\+-]?\d+(?:\.\d+)?)\s*(?:%|pc|percent)\s*(?:rise|increase|growth|jump|surge|fall|decline|drop|slip|down|up)?/i) ||
                     clause.match(/(?:rise|increase|growth|jump|surge|fall|decline|drop|slip|up|down)\s+(?:of\s+|by\s+)?([\+-]?\d+(?:\.\d+)?)\s*(?:%|pc|percent)/i) ||
                     clause.match(/([\+-]?\d+(?:\.\d+)?)\s*(?:%|pc|percent)/i);

    if (pctMatch) {
      changePercent = parseFloat(pctMatch[1]);
      if (lower.includes("qoq") || lower.includes("quarter-on-quarter") || lower.includes("sequential")) {
        changeType = "QoQ";
      } else if (lower.includes("yoy") || lower.includes("year-on-year") || lower.includes("annual") || fullSentence.toLowerCase().includes("compared with") || fullSentence.toLowerCase().includes("yoy")) {
        changeType = "YoY";
      } else {
        changeType = "YoY";
      }
    }

    // 3. Monetary Value
    const monetaryRegex = /(?:(?:Rs\.?|₹|INR|\$)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|billions?|millions?|bn|mn)?)|(?:([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|billions?|millions?|bn|mn)\b)/gi;
    const matches = Array.from(clause.matchAll(monetaryRegex));

    let currentValue: number | null = null;
    let previousValue: number | null = null;
    let unit = "Cr";

    if (matches.length > 0) {
      const m1 = matches[0];
      const valStr1 = m1[1] || m1[3];
      const unitStr1 = m1[2] || m1[4];
      if (valStr1) {
        currentValue = parseFloat(valStr1.replace(/,/g, ""));
      }
      if (unitStr1) {
        unit = this.normalizeUnit(unitStr1);
      }

      // Check for explicit comparator in this clause
      if (matches.length > 1) {
        const hasPrevIndicator = /(?:vs\.?|against|compared\s+to|compared\s+with|from)\s+(?:Rs\.?|₹|INR)?\s*[\d,]+(?:\.\d+)?/i.test(clause);
        if (hasPrevIndicator) {
          const m2 = matches[1];
          const valStr2 = m2[1] || m2[3];
          if (valStr2) {
            previousValue = parseFloat(valStr2.replace(/,/g, ""));
          }
        }
      }
    }

    // Special case: Non-monetary Margin percentage (e.g. "operating margin of 15.1%")
    if ((metricType === "Margin" || metricType === "EBITDA Margin") && currentValue === null && changePercent !== null) {
      // Check if percentage is actually the level (e.g. "margin of 15.1%")
      const marginLevelMatch = clause.match(/(?:margin|npm)\s+(?:of|at|stood\s+at|reached|expanded\s+to|contracted\s+to)\s+([\d\.]+)%/i);
      if (marginLevelMatch) {
        currentValue = parseFloat(marginLevelMatch[1]);
        unit = "%";
      }
    }

    if (metricType === "PAT" && isNetLoss && currentValue !== null && currentValue > 0) {
      currentValue = -currentValue;
    }

    if (currentValue === null && changePercent === null) {
      return results;
    }

    let change: number | null = null;
    if (currentValue !== null && previousValue !== null) {
      change = currentValue - previousValue;
    }

    let displayText = "";
    if (currentValue !== null) {
      const formattedVal = Math.abs(currentValue).toLocaleString("en-IN");
      if (isNetLoss && currentValue < 0) {
        displayText = `Net Loss of ₹${formattedVal} ${unit}`;
      } else {
        displayText = unit === "%" ? `${formattedVal}%` : `₹${formattedVal} ${unit}`;
      }
    } else if (changePercent !== null) {
      displayText = `${direction === "UP" ? "+" : direction === "DOWN" ? "-" : ""}${Math.abs(changePercent)}%`;
    }

    results.push({
      metricName: metricType,
      currentValue,
      previousValue,
      change,
      changePercent,
      changeType,
      direction,
      unit,
      period: sentencePeriod,
      comparatorPeriod: sentenceCompPeriod,
      sourceSentence: clause.trim(),
      displayText,
      confidence: currentValue !== null ? "HIGH" : "MEDIUM",
      status: "RESOLVED",
    });

    return results;
  }

  /**
   * Extracts credit rating announcements.
   */
  private static extractCreditRating(text: string): ExtractedFactMetric | null {
    const ratingRegex = /\b(S&P|Moody(?:'s)?|CRISIL|ICRA|CARE|Fitch|India\s+Ratings)\b.*?\b(?:assigned|affirmed|upgraded|downgraded|revised)\b.*?\b(AAA|AA\+|AA-|AA|A\+|A-|A|BBB\+|BBB-|BBB|BB\+|BB-|BB|B\+|B-|B|CCC|D)(?=[,\s\.\)]|$)/i;
    const match = text.match(ratingRegex);

    if (match) {
      const agency = match[1];
      const rating = match[2].toUpperCase();
      const outlookMatch = text.match(/\b(?:with\s+a\s+)?(Stable|Positive|Negative)\s+Outlook\b/i);
      const outlook = outlookMatch ? outlookMatch[1] : undefined;

      const display = outlook ? `${rating} (${outlook} Outlook)` : rating;

      return {
        metricName: "Credit Rating",
        currentValue: null,
        previousValue: null,
        change: null,
        changePercent: null,
        changeType: "None",
        direction: rating.startsWith("A") || rating.startsWith("BBB") ? "UP" : "NEUTRAL",
        unit: "Rating",
        sourceSentence: match[0],
        displayText: display,
        confidence: "HIGH",
        status: "RESOLVED",
        metadata: { agency, rating, outlook },
      };
    }

    return null;
  }

  /**
   * Extracts IPO details such as price band and expected listing price.
   */
  private static extractIpoDetails(text: string): ExtractedFactMetric | null {
    const bandMatch = text.match(/\b(?:priced\s+between|price\s+band\s+(?:of|is)?)\s*(?:₹|Rs\.?)\s*([\d,]+)\s*(?:and|to|-)\s*(?:₹|Rs\.?)\s*([\d,]+)\b/i);
    const listingMatch = text.match(/\b(?:expected\s+listing\s+price\s+(?:is|at)?|gmp\s+(?:hints|of))\s*(?:₹|Rs\.?)\s*([\d,]+)\b/i);

    if (bandMatch || listingMatch) {
      let display = "";
      if (bandMatch) {
        display = `Band: ₹${bandMatch[1]}–₹${bandMatch[2]}`;
      }
      if (listingMatch) {
        display += (display ? ", " : "") + `Est Listing: ₹${listingMatch[1]}`;
      }

      return {
        metricName: "IPO",
        currentValue: listingMatch ? parseFloat(listingMatch[1].replace(/,/g, "")) : (bandMatch ? parseFloat(bandMatch[2].replace(/,/g, "")) : null),
        previousValue: bandMatch ? parseFloat(bandMatch[1].replace(/,/g, "")) : null,
        change: null,
        changePercent: null,
        changeType: "None",
        direction: "NEUTRAL",
        unit: "₹/share",
        sourceSentence: (bandMatch ? bandMatch[0] : "") + (listingMatch ? " " + listingMatch[0] : ""),
        displayText: display,
        confidence: "HIGH",
        status: "RESOLVED",
      };
    }

    return null;
  }

  private static identifyMetricType(text: string): MetricType | null {
    if (/\b(ebitda margin|operating margin|npm|net profit margin)\b/i.test(text)) {
      return "EBITDA Margin";
    }
    if (
      /\b(net profit|profit after tax|pat|pure profit|net loss|standalone profit|consolidated profit|bottomline|q[1-4]\s+profit)\b/i.test(text) ||
      /\bprofit\s+(?:rises|rose|rise|falls|fell|fall|drops|dropped|declines|declined|jumps|jumped|surges|surged|grew|grows|stands|stood|of|at|reported|up|down)\b/i.test(text)
    ) {
      return "PAT";
    }
    if (/\b(total income)\b/i.test(text)) {
      return "Total Income";
    }
    if (
      /\b(revenue from operations|total revenue|revenue|topline|turnover)\b/i.test(text) ||
      (/\b(net sales|sales)\s+(?:rises?|rose|declines?|declined|reported|of|grew|stood|surged|jumped|dropped|up|down)\b/i.test(text) &&
       !/\b(dollar sales|stake sales?|ticket sales?|arms sales?|asset sales?|token sales?)\b/i.test(text))
    ) {
      return "Revenue";
    }
    if (/\b(ebitda|operating profit)\b/i.test(text)) {
      return "EBITDA";
    }
    if (/\b(eps|earnings per share|diluted eps)\b/i.test(text)) {
      return "EPS";
    }
    if (/\b(net interest income|nii)\b/i.test(text)) {
      return "NII";
    }
    if (/\b(total debt|net debt|borrowings)\b/i.test(text)) {
      return "Debt";
    }
    if (/\b(order book|order intake|order inflow|bags order|awarded order|won order|secures order)\b/i.test(text)) {
      return "Order Book";
    }
    if (/\b(margin)\b/i.test(text)) {
      return "Margin";
    }

    return null;
  }

  private static normalizeUnit(unitStr: string): string {
    const clean = unitStr.toLowerCase().trim();
    if (clean.includes("crore") || clean.includes("cr")) return "Cr";
    if (clean.includes("lakh")) return "Lakh";
    if (clean.includes("billion") || clean.includes("bn")) return "Bn";
    if (clean.includes("million") || clean.includes("mn")) return "Mn";
    if (clean.includes("%") || clean.includes("percent")) return "%";
    return "Cr";
  }
}
