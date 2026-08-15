import { EventType } from "../types";

export class EventClassifier {
  /**
   * Classifies an incoming event based on title, description, or fallback text.
   */
  public static classify(title: string, description: string): EventType {
    const text = `${title} ${description}`.toLowerCase();

    // 1. RBIPolicy
    if (text.includes("rbi") || text.includes("repo rate") || text.includes("monetary policy committee") || text.includes("mpc") || text.includes("reserve bank")) {
      return EventType.RBIPolicy;
    }

    // 2. RegulatoryFiling
    if (text.includes("sebi") || text.includes("disclosure") || text.includes("exchange filing") || text.includes("lodr") || text.includes("listing obligations") || text.includes("regulatory filing")) {
      return EventType.RegulatoryFiling;
    }

    // 3. Earnings
    if (text.includes("earnings") || text.includes("quarterly results") || text.includes("net profit") || text.includes("ebitda") || text.includes("revenue growth") || /q[1-4]\sresult/i.test(text)) {
      return EventType.Earnings;
    }

    // 4. Dividend
    if (text.includes("dividend") || text.includes("payout") || text.includes("interim dividend")) {
      return EventType.Dividend;
    }

    // 5. Buyback
    if (text.includes("buyback") || text.includes("share repurchase")) {
      return EventType.Buyback;
    }

    // 6. OrderWin
    if (text.includes("order win") || text.includes("secured contract") || text.includes("l1 bidder") || text.includes("awarded project") || text.includes("bagged order")) {
      return EventType.OrderWin;
    }

    // 7. MA
    if (text.includes("acquisition") || text.includes("merger") || text.includes("m&a") || text.includes("takeover") || text.includes("stake sale") || text.includes("divestment")) {
      return EventType.MA;
    }

    // 8. CreditRating
    if (text.includes("credit rating") || text.includes("crisil") || text.includes("icra") || text.includes("care rating") || text.includes("downgrade rating") || text.includes("upgrade rating")) {
      return EventType.CreditRating;
    }

    // 9. PromoterActivity
    if (text.includes("promoter") || text.includes("pledge") || text.includes("unpledge") || text.includes("promoter group")) {
      return EventType.PromoterActivity;
    }

    // 10. InsiderTrading
    if (text.includes("insider trading") || text.includes("form d") || text.includes("pit regulations")) {
      return EventType.InsiderTrading;
    }

    // 11. BlockBulkDeal
    if (text.includes("block deal") || text.includes("bulk deal") || text.includes("large trade")) {
      return EventType.BlockBulkDeal;
    }

    // 12. FIIDIIFlow
    if (text.includes("fii flow") || text.includes("dii flow") || text.includes("foreign institutional") || text.includes("domestic institutional")) {
      return EventType.FIIDIIFlow;
    }

    // 13. IndexInclusionRemoval
    if (text.includes("index inclusion") || text.includes("index removal") || text.includes("msci") || text.includes("ftse") || text.includes("nifty rebalancing")) {
      return EventType.IndexInclusionRemoval;
    }

    // 14. ManagementCommentary
    if (text.includes("commentary") || text.includes("ceo") || text.includes("cfo") || text.includes("guidance") || text.includes("investor call")) {
      return EventType.ManagementCommentary;
    }

    // 15. SectorRotation
    if (text.includes("sector rotation") || text.includes("outperforming sector") || text.includes("sectoral shift")) {
      return EventType.SectorRotation;
    }

    // 16. MacroEconomy
    if (text.includes("gdp") || text.includes("inflation") || text.includes("cpi") || text.includes("wpi") || text.includes("fiscal deficit")) {
      return EventType.MacroEconomy;
    }

    // 17. GovernmentPolicy
    if (text.includes("government policy") || text.includes("ministry") || text.includes("cabinet approval") || text.includes("gst council")) {
      return EventType.GovernmentPolicy;
    }

    // 18. CommodityImpact
    if (text.includes("crude oil") || text.includes("steel price") || text.includes("commodity price") || text.includes("gold price") || text.includes("inventory")) {
      return EventType.CommodityImpact;
    }

    // 19. ForexImpact
    if (text.includes("forex") || text.includes("rupee") || text.includes("usdinr") || text.includes("currency volatility")) {
      return EventType.ForexImpact;
    }

    // 20. TechnicalBreakout
    if (text.includes("breakout") || text.includes("golden cross") || text.includes("all time high") || text.includes("support level") || text.includes("resistance")) {
      return EventType.TechnicalBreakout;
    }

    // 21. UnusualVolume
    if (text.includes("unusual volume") || text.includes("volume spike") || text.includes("high delivery")) {
      return EventType.UnusualVolume;
    }

    // 22. MarketWideRisk
    if (text.includes("market wide risk") || text.includes("contagion") || text.includes("systemic risk") || text.includes("vix spike")) {
      return EventType.MarketWideRisk;
    }

    // 23. CorporateAction (Fallback)
    if (text.includes("bonus") || text.includes("split") || text.includes("rights issue") || text.includes("demerger")) {
      return EventType.CorporateAction;
    }

    return EventType.MacroEconomy; // Default to Macro if unsure
  }
}
