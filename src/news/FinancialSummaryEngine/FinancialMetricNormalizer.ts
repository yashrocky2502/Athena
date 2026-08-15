export interface NormalizedMetric {
  name: string;
  value: string;
  unit: string;
  period: string;
  comparison: string;
  change: string;
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NONE';
}

export const SUPPORTED_METRICS = [
  "Revenue",
  "Net Revenue",
  "Net Profit",
  "PAT",
  "PBT",
  "EBITDA",
  "EBIT",
  "Operating Profit",
  "Operating Margin",
  "EBITDA Margin",
  "EPS",
  "NIM",
  "AUM",
  "GNPA",
  "NNPA",
  "CASA",
  "Deposits",
  "Advances",
  "ARPU",
  "Vehicle Sales",
  "Volume",
  "Free Cash Flow",
  "ROE",
  "ROCE",
  "Loan Book",
  "Order Book",
  "Order Intake",
  "Cash",
  "Debt",
  "Capex",
  "Dividend",
  "Buyback",
  "Bonus Ratio",
  "Split Ratio",
  "Subscribers",
  "Production",
  "Sales Volume",
  "Exports",
  "Imports",
  "Market Share",
  "Guidance",
  "Revenue Growth",
  "PAT Growth",
  "Target Price",
  "52 Week High",
  "52 Week Low",
  "Market Cap"
];

export class FinancialMetricNormalizer {
  /**
   * Normalize raw metric values into a standard shape.
   */
  public static normalize(raw: Partial<NormalizedMetric> & { name: string; value: string }): NormalizedMetric {
    const name = this.normalizeMetricName(raw.name);
    
    // Normalize unit
    let unit = raw.unit || this.inferUnit(raw.value, name);
    let value = this.cleanValue(raw.value, unit);

    // Standardize unit spelling/casing (e.g., crores -> crore, cr -> Cr, % -> %)
    unit = this.normalizeUnit(unit);

    const change = this.normalizeChange(raw.change || "");
    const direction = raw.direction || this.inferDirection(change, raw.direction);
    
    // Default period if not found
    const period = this.normalizePeriod(raw.period || "Q1FY27");
    const comparison = raw.comparison || "YoY";

    return {
      name,
      value: this.formatValue(value, unit),
      unit,
      period,
      comparison,
      change,
      direction
    };
  }

  private static normalizeMetricName(name: string): string {
    const n = name.trim().toLowerCase();
    
    // Match exact or close aliases
    if (n === "revenue" || n === "total revenue" || n === "turnover") return "Revenue";
    if (n === "net revenue") return "Net Revenue";
    if (n === "revenue growth") return "Revenue Growth";
    if (n === "net profit" || n === "profit after tax" || n === "profit" || n === "net profit/loss") return "Net Profit";
    if (n === "pat") return "PAT";
    if (n === "pat growth") return "PAT Growth";
    if (n === "pbt" || n === "profit before tax") return "PBT";
    if (n === "ebitda") return "EBITDA";
    if (n === "ebit") return "EBIT";
    if (n === "operating profit") return "Operating Profit";
    if (n === "operating margin" || n === "operating profit margin") return "Operating Margin";
    if (n === "ebitda margin") return "EBITDA Margin";
    if (n === "eps" || n === "earnings per share") return "EPS";
    if (n === "nim" || n === "net interest margin") return "NIM";
    if (n === "aum" || n === "assets under management") return "AUM";
    if (n === "gnpa" || n === "gross npa" || n === "gross non-performing assets") return "GNPA";
    if (n === "nnpa" || n === "net npa" || n === "net non-performing assets") return "NNPA";
    if (n === "casa" || n === "casa ratio") return "CASA";
    if (n === "deposits") return "Deposits";
    if (n === "advances") return "Advances";
    if (n === "arpu" || n === "average revenue per user") return "ARPU";
    if (n === "vehicle sales" || n === "auto sales") return "Vehicle Sales";
    if (n === "volume" || n === "volumes" || n === "sales volume") return "Volume";
    if (n === "free cash flow" || n === "fcf") return "Free Cash Flow";
    if (n === "roe" || n === "return on equity") return "ROE";
    if (n === "roce" || n === "return on capital employed") return "ROCE";
    if (n === "loan book") return "Loan Book";
    if (n === "order book") return "Order Book";
    if (n === "order intake") return "Order Intake";
    if (n === "cash" || n === "cash reserves") return "Cash";
    if (n === "debt" || n === "total debt") return "Debt";
    if (n === "capex" || n === "capital expenditure") return "Capex";
    if (n === "dividend") return "Dividend";
    if (n === "buyback") return "Buyback";
    if (n === "bonus ratio") return "Bonus Ratio";
    if (n === "split ratio") return "Split Ratio";
    if (n === "subscribers") return "Subscribers";
    if (n === "production") return "Production";
    if (n === "sales volume") return "Sales Volume";
    if (n === "exports") return "Exports";
    if (n === "imports") return "Imports";
    if (n === "market share") return "Market Share";
    if (n === "guidance") return "Guidance";
    if (n === "target price" || n === "price target" || n === "target") return "Target Price";
    if (n === "52 week high" || n === "52-week high" || n === "high") return "52 Week High";
    if (n === "52 week low" || n === "52-week low" || n === "low") return "52 Week Low";
    if (n === "market cap" || n === "m-cap" || n === "market capitalization") return "Market Cap";

    // Fallback search
    const found = SUPPORTED_METRICS.find(m => m.toLowerCase() === n);
    if (found) return found;

    // Fuzzy matching
    for (const metric of SUPPORTED_METRICS) {
      if (n.includes(metric.toLowerCase()) || metric.toLowerCase().includes(n)) {
        return metric;
      }
    }

    return "Revenue"; // Default fallback
  }

  private static inferUnit(value: string, name: string): string {
    const val = value.toLowerCase();
    if (name.includes("Margin") || name.includes("Ratio") || val.includes("%") || name === "GNPA" || name === "NNPA" || name === "NIM" || name === "CASA" || name === "ROE" || name === "ROCE") {
      return "%";
    }
    if (val.includes("crore") || val.includes("cr")) return "crore";
    if (val.includes("lakh") || val.includes("lakhs")) return "lakh";
    if (val.includes("billion") || val.includes("bn")) return "billion";
    if (val.includes("million") || val.includes("mn")) return "million";
    if (val.includes("rs") || val.includes("₹") || val.includes("rupees")) return "crore"; // Standard Indian scale default
    return "";
  }

  private static cleanValue(value: string, unit: string): string {
    // Strip unit names, currencies, and clean whitespace
    let cleaned = value
      .replace(/₹|Rs\.?|Rupees|USD|\$|%|crores?|cr\.?|lakhs?|billions?|millions?|bn|mn/gi, "")
      .trim();
    return cleaned;
  }

  private static normalizeUnit(unit: string): string {
    const u = unit.trim().toLowerCase();
    if (u === "%") return "%";
    if (u === "crore" || u === "crores" || u === "cr" || u === "cr.") return "crore";
    if (u === "lakh" || u === "lakhs") return "lakh";
    if (u === "billion" || u === "bn") return "billion";
    if (u === "million" || u === "mn") return "million";
    if (u === "eps" || u === "rs" || u === "₹" || u === "per share") return "per share";
    return unit;
  }

  private static formatValue(value: string, unit: string): string {
    // Ensure standard prefix formatting (e.g., adding ₹ to crore, but not to percentages)
    const val = value.trim();
    if (unit === "crore") {
      return `₹${val} crore`;
    }
    if (unit === "lakh") {
      return `₹${val} lakh`;
    }
    if (unit === "%") {
      return `${val}%`;
    }
    if (unit === "per share") {
      return `₹${val}`;
    }
    return val;
  }

  private static normalizeChange(change: string): string {
    let c = change.trim();
    if (!c) return "";
    
    // Ensure clean +/- prefixes and %
    c = c.replace(/up|down|rose|fell|increased|decreased|growth/gi, "").trim();
    
    // Add percent if missing and it's a numeric change
    if (/^\d+(\.\d+)?$/.test(c)) {
      c = `${c}%`;
    }

    if (!c.startsWith("+") && !c.startsWith("-") && /^\d/.test(c)) {
      c = `+${c}`; // Default to positive if no sign
    }

    return c;
  }

  private static inferDirection(change: string, dir?: 'UP' | 'DOWN' | 'FLAT' | 'NONE'): 'UP' | 'DOWN' | 'FLAT' | 'NONE' {
    if (dir && dir !== 'NONE') return dir;
    if (change.startsWith("+")) return "UP";
    if (change.startsWith("-")) return "DOWN";
    if (change.toLowerCase().includes("flat") || change === "0%") return "FLAT";
    return "NONE";
  }

  private static normalizePeriod(period: string): string {
    let p = period.trim().toUpperCase();
    // Normalize patterns like Q1 FY27 -> Q1FY27
    p = p.replace(/\s+/g, "");
    if (/^Q\dFY\d{2}$/.test(p)) return p;
    if (p === "Q1") return "Q1FY27"; // Default standard
    return p;
  }
}
