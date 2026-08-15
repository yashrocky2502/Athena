/**
 * ATHENA NEWS ENGINE V3 — CATEGORY RULES
 * 
 * Comprehensive deterministic rule definitions for financial news classification.
 * NO AI, 100% deterministic pattern matching rules with priority weights.
 */

import { ClassificationCategory } from './types/ClassificationTypes';

export interface CategoryRuleDefinition {
  id: string;
  category: ClassificationCategory;
  patterns: RegExp[];
  negativePatterns?: RegExp[];
  weight: number; // 0 to 100
  titleOnly?: boolean;
}

export class CategoryRules {
  public static readonly RULES: CategoryRuleDefinition[] = [
    // 1. RESULT PREVIEW (Priority higher than raw quarterly results when preview markers exist)
    {
      id: 'RULE_RESULT_PREVIEW',
      category: 'RESULT_PREVIEW',
      patterns: [
        /\b(q[1-4]|q[1-4]\s*fy\d{2,4}|quarterly results?|earnings|pat|net profit)\b.*\b(preview|expectations|likely to report|estimate|forecast|ahead of|poll|what to expect)\b/i,
        /\b(preview|poll|estimates|what to expect)\b.*\b(q[1-4]|earnings|results|net profit|pat)\b/i,
        /\b(q[1-4]|quarterly)\s*(preview|poll|expectations)\b/i
      ],
      negativePatterns: [
        /\b(gdp|cpi|wpi|iip|inflation|forex|commodity|rupee|dollar)\b/i
      ],
      weight: 95
    },

    // 2. RESULT REACTION
    {
      id: 'RULE_RESULT_REACTION',
      category: 'RESULT_REACTION',
      patterns: [
        /\b(shares?|stock)\b.*\b(surge|jump|plunge|fall|drop|rally|gain|slide|tumble|soar)\b.*\b(post|after|following|on)\b.*\b(q[1-4]|results|earnings|net profit|pat)\b/i,
        /\b(post|after)\b.*\b(q[1-4]|results|earnings)\b.*\b(shares?|stock)\b.*\b(rise|fall|gain|lose|up|down)\b/i
      ],
      negativePatterns: [
        /\b(gdp|cpi|wpi|iip|inflation|forex|commodity|rupee|dollar)\b/i
      ],
      weight: 92
    },

    // 3. QUARTERLY RESULTS
    {
      id: 'RULE_QUARTERLY_RESULTS',
      category: 'QUARTERLY_RESULTS',
      patterns: [
        /\b(q[1-4]|quarterly)\s*(results?|earnings|pat|net profit|numbers)\b/i,
        /\b(net profit|pat|ebitda|revenue)\s*(surges?|jumps?|rises?|falls?|drops?|up|down|climbs?|soars?)\s*\d+%/i,
        /\b(reports?|posts?|records?)\s*(a|a net)?\s*(profit|loss|pat|revenue)\s*of\s*rs\b/i,
        /\b(q[1-4]\s*fy\d{2,4}|financial results)\b/i
      ],
      negativePatterns: [
        /\b(preview|what to expect|poll|gdp|cpi|wpi|iip|inflation|forex|commodity|rupee|dollar)\b/i,
        /\b(shares?|stock)\b.*\b(surge|jump|fall|drop)\b.*\b(post|after)\b/i
      ],
      weight: 90
    },

    // 4. BROKER REPORT
    {
      id: 'RULE_BROKER_REPORT',
      category: 'BROKER_REPORT',
      patterns: [
        /\b(target price|buy|sell|hold|underperform|outperform|overweight|equal-weight|accumulate|neutral)\b.*\b(rs\s*\d+|brokerage|rating)\b/i,
        /\b(brokerage|jefferies|goldman|morgan stanley|nomura|jp morgan|citi|clsa|ubs|bernstein|motilal oswal|nomura|investec|hsbc|macquarie)\b.*\b(maintains?|retains?|reiterates?|upgrades?|downgrades?|raises?|cuts?|target)\b/i,
        /\b(target|rating)\b.*\b(raised|cut|upgraded|downgraded|maintained|retained)\b/i
      ],
      weight: 90
    },

    // 5. DIVIDEND
    {
      id: 'RULE_DIVIDEND',
      category: 'DIVIDEND',
      patterns: [
        /\b(dividend|interim dividend|final dividend|special dividend)\b/i,
        /\b(declares?|recommends?|approves?|announces?)\s*(a|an)?\s*(dividend|interim dividend|final dividend)\b/i,
        /\b(dividend per share|record date for dividend)\b/i
      ],
      weight: 95
    },

    // 6. BONUS
    {
      id: 'RULE_BONUS',
      category: 'BONUS',
      patterns: [
        /\b(bonus issue|bonus shares?|ratio of \d+:\d+ bonus)\b/i,
        /\b(approves?|announces?|recommends?)\s*bonus\s*shares?\b/i
      ],
      weight: 95
    },

    // 7. SPLIT
    {
      id: 'RULE_SPLIT',
      category: 'SPLIT',
      patterns: [
        /\b(stock split|share split|sub-division|subdivision)\b/i,
        /\b(splits?|sub-divides?)\s*(its|equity)?\s*shares?\b/i
      ],
      weight: 95
    },

    // 8. BUYBACK
    {
      id: 'RULE_BUYBACK',
      category: 'BUYBACK',
      patterns: [
        /\b(share buyback|stock buyback|buyback of shares?|buyback offer)\b/i,
        /\b(approves?|announces?)\s*buyback\b/i
      ],
      weight: 95
    },

    // 9. MERGER & ACQUISITION
    {
      id: 'RULE_MERGER',
      category: 'MERGER',
      patterns: [
        /\b(merger|amalgamation|scheme of arrangement|merges with)\b/i,
        /\b(boards?|shareholders?)\s*approve\s*merger\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_ACQUISITION',
      category: 'ACQUISITION',
      patterns: [
        /\b(acquires?|acquisition|stake buy|stake purchase|takeover|buys \d+% stake)\b/i,
        /\b(completes?|signs?)\s*acquisition\b/i
      ],
      weight: 90
    },

    // 10. IPO
    {
      id: 'RULE_IPO',
      category: 'IPO',
      patterns: [
        /\b(ipo|initial public offering|gmp|grey market premium|ipo listing|ipo subscription|issue price|anchor investors?)\b/i,
        /\b(ipo opens|ipo closes|subscribed \d+ times)\b/i
      ],
      weight: 92
    },

    // 11. QIP & RIGHTS ISSUE
    {
      id: 'RULE_QIP',
      category: 'QIP',
      patterns: [
        /\b(qip|qualified institutional placement|floor price for qip)\b/i
      ],
      weight: 92
    },

    {
      id: 'RULE_RIGHTS_ISSUE',
      category: 'RIGHTS_ISSUE',
      patterns: [
        /\b(rights issue|rights entitlement|record date for rights issue)\b/i
      ],
      weight: 92
    },

    // 12. BLOCK & BULK DEALS
    {
      id: 'RULE_BLOCK_DEAL',
      category: 'BLOCK_DEAL',
      patterns: [
        /\b(block deal|block trade|large trade|promoter sells stake via block)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_BULK_DEAL',
      category: 'BULK_DEAL',
      patterns: [
        /\b(bulk deal|bulk trade|sells \d+ lakh shares|buys \d+ lakh shares)\b/i
      ],
      weight: 95
    },

    // 13. PROMOTER ACTION
    {
      id: 'RULE_PROMOTER_ACTION',
      category: 'PROMOTER_ACTION',
      patterns: [
        /\b(promoter|promoter group|promoter stake|pledge|unpledge|promoters sell|promoters buy)\b/i
      ],
      weight: 88
    },

    // 14. BOARD MEETING
    {
      id: 'RULE_BOARD_MEETING',
      category: 'BOARD_MEETING',
      patterns: [
        /\b(board meeting|board to meet on|board meeting scheduled|to consider financial results|to consider dividend|to consider fundraising)\b/i
      ],
      weight: 85
    },

    // 15. GUIDANCE & CAPEX
    {
      id: 'RULE_GUIDANCE',
      category: 'GUIDANCE',
      patterns: [
        /\b(guidance|revenue guidance|growth guidance|outlook|margin guidance|projects \d+% growth)\b/i
      ],
      weight: 85
    },

    {
      id: 'RULE_CAPEX',
      category: 'CAPEX',
      patterns: [
        /\b(capex|capital expenditure|expansion plan|new plant|factory setup|invests? rs \d+ cr)\b/i
      ],
      weight: 85
    },

    // 16. ORDER WIN & LOSS
    {
      id: 'RULE_ORDER_WIN',
      category: 'ORDER_WIN',
      patterns: [
        /\b(bags?|wins?|secures?|awarded|receives?|received|secured?|bagged|won)\b.*\b(order|contract|project|deal|agreement)\b/i,
        /\b(order win|contract win|new order|receives? order)\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_ORDER_LOSS',
      category: 'ORDER_LOSS',
      patterns: [
        /\b(loses?|cancels?|terminates?)\s*(order|contract|project)\b/i,
        /\b(contract cancellation|order termination)\b/i
      ],
      weight: 90
    },

    // 17. MANAGEMENT CHANGE (CEO/CFO/Resignation)
    {
      id: 'RULE_CEO_CHANGE',
      category: 'CEO_CHANGE',
      patterns: [
        /\b(appoints?|names?|steps down as|resigns as|successor|appointing|naming|transition|transitions)\b.*\b(ceo|chief executive officer|managing director|md & ceo|md\b)/i,
        /\b(ceo|chief executive officer|managing director|md & ceo|md\b).*\b(appoints?|names?|steps down|resigns|successor|appointment|transition|resignation)\b/i,
        /\b(new ceo|ceo resignation|ceo appointment)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_CFO_CHANGE',
      category: 'CFO_CHANGE',
      patterns: [
        /\b(appoints?|names?|steps down as|resigns as)\s*(new\s*)?(cfo|chief financial officer)\b/i,
        /\b(new cfo|cfo resignation|cfo appointment)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_RESIGNATION',
      category: 'RESIGNATION',
      patterns: [
        /\b(resigns?|resignation|steps down|quits?|vacates office)\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_MANAGEMENT_CHANGE',
      category: 'MANAGEMENT_CHANGE',
      patterns: [
        /\b(management change|key managerial personnel|kmp|board appointment|independent director)\b/i
      ],
      weight: 80
    },

    // 18. SEBI ACTION
    {
      id: 'RULE_SEBI_ACTION',
      category: 'SEBI_ACTION',
      patterns: [
        /\b(sebi|sebi order|sebi circular|sebi penalty|sebi bans|sebi bars|sebi show cause|sebi warning|sebi investigation)\b/i
      ],
      weight: 92
    },

    // 19. RBI POLICY
    {
      id: 'RULE_RBI_POLICY',
      category: 'RBI_POLICY',
      patterns: [
        /\b(rbi|reserve bank of india|mpc|monetary policy committee|repo rate|reverse repo|crr|slr|rbi rate decision|rbi governor)\b/i
      ],
      weight: 95
    },

    // 20. MACRO & INDICATORS (GDP, CPI, WPI, IIP, TRADE)
    {
      id: 'RULE_GDP',
      category: 'GDP',
      patterns: [
        /\b(gdp|gross domestic product|economic growth|gdp growth|gdp expands|gdp slows)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_CPI',
      category: 'CPI',
      patterns: [
        /\b(cpi|retail inflation|consumer price index|cpi inflation)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_WPI',
      category: 'WPI',
      patterns: [
        /\b(wpi|wholesale inflation|wholesale price index)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_IIP',
      category: 'IIP',
      patterns: [
        /\b(iip|index of industrial production|factory output|industrial growth)\b/i
      ],
      weight: 95
    },

    {
      id: 'RULE_TRADE',
      category: 'TRADE',
      patterns: [
        /\b(trade deficit|current account deficit|cad|exports|imports|trade balance)\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_MACRO',
      category: 'MACRO',
      patterns: [
        /\b(macro|macroeconomic|fiscal deficit|tax collection|gst collection|union budget|finance ministry)\b/i
      ],
      weight: 85
    },

    // 21. FOREX, COMMODITY, CRYPTO
    {
      id: 'RULE_FOREX',
      category: 'FOREX',
      patterns: [
        /\b(rupee|usd\/inr|forex reserves|dollar index|foreign exchange|currency market)\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_COMMODITY',
      category: 'COMMODITY',
      patterns: [
        /\b(crude oil|brent crude|wti|gold prices?|silver prices?|copper|commodity market)\b/i
      ],
      weight: 90
    },

    {
      id: 'RULE_CRYPTO',
      category: 'CRYPTO',
      patterns: [
        /\b(bitcoin|ethereum|crypto|cryptocurrency|btc|eth)\b/i
      ],
      weight: 95
    },

    // 22. MARKETS
    {
      id: 'RULE_GLOBAL_MARKETS',
      category: 'GLOBAL_MARKETS',
      patterns: [
        /\b(wall street|dow jones|s&p 500|nasdaq|nikkei|hang seng|ftse|asian markets|us stocks)\b/i
      ],
      weight: 85
    },

    {
      id: 'RULE_DOMESTIC_MARKETS',
      category: 'DOMESTIC_MARKETS',
      patterns: [
        /\b(nifty|sensex|stock market|bse sensex|nifty 50|market wrap|dalal street|indian indices)\b/i
      ],
      weight: 80
    }
  ];
}
