/**
 * ATHENA NEWS ENGINE V3 — DYNAMIC EXPECTED FIELD MATRIX
 *
 * Implements Phase 6.1 Strict Field Presence Detection rules.
 * Instead of assuming static fields, dynamically scans document text
 * to determine if a financial field actually exists, is absent, or ambiguous.
 */

import { NormalizedDocument } from '../normalization/types/NormalizationTypes';

export interface FieldPresenceRule {
  fieldName: string;
  keywords: RegExp[];
}

export class ExpectedFieldMatrix {
  private static rules: Record<string, FieldPresenceRule[]> = {
    QuarterlyResultsParser: [
      { fieldName: 'quarter', keywords: [/\bQ[1-4]\b/i, /\bquarter\b/i] },
      { fieldName: 'financialYear', keywords: [/\bFY\d{2,4}\b/i, /\bfinancial year\b/i] },
      { fieldName: 'revenue', keywords: [/\brevenue\b/i, /\bsales\b/i, /\bturnover\b/i, /\btop-line\b/i, /\btop line\b/i, /\bincome of rs\b/i] },
      { fieldName: 'pat', keywords: [/\bnet profit\b/i, /\bpat\b/i, /\bprofit after tax\b/i, /\bnet income\b/i, /\bbottom-line\b/i, /\bbottom line\b/i] },
      { fieldName: 'ebitda', keywords: [/\bebitda\b/i, /\boperating profit\b/i] },
      { fieldName: 'ebitdaMargin', keywords: [/\bebitda margin\b/i, /\boperating margin\b/i] },
      { fieldName: 'netMargin', keywords: [/\bnet margin\b/i, /\bprofit margin\b/i, /\bnet profit margin\b/i] },
      { fieldName: 'eps', keywords: [/\beps\b/i, /\bearnings per share\b/i] },
      { fieldName: 'guidance', keywords: [/\bguidance\b/i, /\boutlook\b/i, /\bforecast\b/i, /\bpredict\b/i, /\bexpects to achieve\b/i] },
      { fieldName: 'capexPlan', keywords: [/\bcapex\b/i, /\bcapital expenditure\b/i, /\bcapacity expansion\b/i, /\bcapital outlay\b/i] }
    ],
    BrokerReportParser: [
      { fieldName: 'brokerName', keywords: [/\bbrokerage\b/i, /\banalyst\b/i, /\bbroker\b/i, /\bjefferies\b/i, /\bmorgan stanley\b/i, /\bgoldman sachs\b/i, /\bclsa\b/i, /\bnomura\b/i, /\bjpmorgan\b/i, /\bubs\b/i, /\bciti\b/i, /\bmacquarie\b/i, /\bmotilal oswal\b/i, /\bicici securities\b/i, /\bkotak\b/i, /\baxis capital\b/i, /\bhdfc securities\b/i, /\bnuvama\b/i, /\bjm financial\b/i, /\bemkay\b/i, /\bnirmal bang\b/i, /\bedelweiss\b/i, /\bcentrum\b/i, /\binvestec\b/i, /\bdam capital\b/i, /\bprabhudas lilladher\b/i] },
      { fieldName: 'targetPrice', keywords: [/\btarget price\b/i, /\bprice target\b/i, /\btarget of\b/i, /\btp of\b/i, /\btarget at\b/i, /\braises target\b/i, /\bcuts target\b/i] },
      { fieldName: 'previousTargetPrice', keywords: [/\bprevious target\b/i, /\bearlier target\b/i, /\btp from\b/i, /\bcut from\b/i, /\braised from\b/i, /\bfrom rs\b/i] },
      { fieldName: 'rating', keywords: [/\bbuy\b/i, /\bsell\b/i, /\bhold\b/i, /\baccumulate\b/i, /\breduce\b/i, /\bneutral\b/i, /\boutperform\b/i] },
      { fieldName: 'action', keywords: [/\bupgrade\b/i, /\bdowngrade\b/i, /\binitiation\b/i, /\breiterate\b/i, /\bmaintain\b/i] },
      { fieldName: 'upsidePercent', keywords: [/\bupside\b/i, /\bpotential upside\b/i, /\bupside of\b/i] },
      { fieldName: 'downsidePercent', keywords: [/\bdownside\b/i, /\bpotential downside\b/i, /\bdownside of\b/i] }
    ],
    DividendParser: [
      { fieldName: 'dividendAmountPerShare', keywords: [/\bdividend of\b/i, /\bdividend at\b/i, /\bdividend per share\b/i, /\bpays dividend\b/i] },
      { fieldName: 'dividendYieldPercent', keywords: [/\bdividend yield\b/i, /\byield of\b/i] },
      { fieldName: 'type', keywords: [/\binterim dividend\b/i, /\bfinal dividend\b/i, /\bspecial dividend\b/i] },
      { fieldName: 'recordDate', keywords: [/\brecord date\b/i] },
      { fieldName: 'exDate', keywords: [/\bex-date\b/i, /\bex dividend\b/i] },
      { fieldName: 'paymentDate', keywords: [/\bpayment date\b/i, /\bpaid on\b/i, /\bpayable on\b/i] }
    ],
    BuybackParser: [
      { fieldName: 'offerPrice', keywords: [/\bbuyback price\b/i, /\bbuyback at\b/i, /\boffer price\b/i] },
      { fieldName: 'buybackSizeCrores', keywords: [/\bbuyback size\b/i, /\bbuyback worth\b/i, /\bbuyback of\b/i, /\btotal buyback\b/i] },
      { fieldName: 'mechanism', keywords: [/\btender offer\b/i, /\bopen market\b/i] },
      { fieldName: 'recordDate', keywords: [/\brecord date\b/i] },
      { fieldName: 'totalSharesCount', keywords: [/\btotal shares\b/i, /\bnumber of shares\b/i, /\bbuyback shares\b/i] }
    ],
    BonusSplitParser: [
      { fieldName: 'type', keywords: [/\bbonus\b/i, /\bstock split\b/i, /\bshare split\b/i] },
      { fieldName: 'bonusRatio', keywords: [/\bbonus ratio\b/i, /\bbonus of\b/i, /\bbonus issue\b/i] },
      { fieldName: 'splitRatio', keywords: [/\bsplit ratio\b/i, /\bstock split\b/i, /\bsub-divide\b/i, /\bsub-division\b/i] },
      { fieldName: 'recordDate', keywords: [/\brecord date\b/i] },
      { fieldName: 'exDate', keywords: [/\bex-date\b/i] }
    ],
    ManagementChangeParser: [
      { fieldName: 'executiveName', keywords: [/\bappointed\b/i, /\bresigned\b/i, /\bretired\b/i, /\bveteran executive\b/i, /\bceo\b/i, /\bmd\b/i] },
      { fieldName: 'designation', keywords: [/\bceo\b/i, /\bmd\b/i, /\bchief executive\b/i, /\bmanaging director\b/i, /\bcfo\b/i, /\bchairperson\b/i, /\bdirector\b/i, /\bvice president\b/i] },
      { fieldName: 'action', keywords: [/\bappoint\b/i, /\bresign\b/i, /\bretire\b/i, /\bstep down\b/i, /\belevate\b/i, /\breplace\b/i] },
      { fieldName: 'effectiveDate', keywords: [/\beffective date\b/i, /\beffective from\b/i] },
      { fieldName: 'reason', keywords: [/\breason\b/i, /\bpersonal grounds\b/i, /\bhealth reasons\b/i, /\bcareer pursuit\b/i] }
    ],
    OrderWinParser: [
      { fieldName: 'clientName', keywords: [/\bclient\b/i, /\bordered by\b/i, /\border from\b/i, /\bcontract from\b/i, /\breceived from\b/i] },
      { fieldName: 'contractValueCrores', keywords: [/\bcontract value\b/i, /\border worth\b/i, /\border of\b/i, /\bcontract worth\b/i, /\bcontract of\b/i, /\bRs\b.*?\bcrore\b/i, /\border of rs\b/i] },
      { fieldName: 'currency', keywords: [/\brs\b/i, /\busd\b/i, /\beuro\b/i, /\binr\b/i, /\bdollar\b/i] },
      { fieldName: 'durationMonthsYears', keywords: [/\bduration\b/i, /\btimeline\b/i, /\bmonths\b/i, /\byears\b/i, /\bperiod of\b/i] },
      { fieldName: 'geography', keywords: [/\bgeography\b/i, /\bdomestic\b/i, /\binternational\b/i, /\bglobal\b/i, /\bindia\b/i, /\bus\b/i, /\beurope\b/i] },
      { fieldName: 'segment', keywords: [/\bsegment\b/i, /\bdivision\b/i, /\bbusiness unit\b/i] },
      { fieldName: 'executionTimeline', keywords: [/\bexecution timeline\b/i, /\bcompletion period\b/i, /\bto be executed\b/i] },
      { fieldName: 'marginImpact', keywords: [/\bmargin\b/i, /\bmargin impact\b/i, /\boperating margin\b/i, /\bmargin accretive\b/i] }
    ],
    MergersAcquisitionParser: [
      { fieldName: 'buyerName', keywords: [/\bacquires\b/i, /\bbuys stake\b/i, /\bbuying\b/i, /\bbuyer\b/i, /\bacquirer\b/i] },
      { fieldName: 'sellerName', keywords: [/\bsells stake\b/i, /\bselling\b/i, /\bseller\b/i, /\bdivests\b/i] },
      { fieldName: 'targetCompany', keywords: [/\btarget firm\b/i, /\btarget company\b/i, /\bacquired firm\b/i, /\bacquisition of\b/i] },
      { fieldName: 'stakePercent', keywords: [/\bstake\b/i, /\bshareholding\b/i, /\bpercent stake\b/i, /\b% stake\b/i, /\bacquisition of\b.*?\b%\b/i] },
      { fieldName: 'dealValueCrores', keywords: [/\bdeal value\b/i, /\bdeal size\b/i, /\bacquisition cost\b/i, /\bvaluation of rs\b/i, /\bacquisition for rs\b/i] },
      { fieldName: 'fundingSource', keywords: [/\bcash transaction\b/i, /\bshare swap\b/i, /\bdebt-funded\b/i, /\bfunded via\b/i] },
      { fieldName: 'approvalStatus', keywords: [/\bcompetition commission\b/i, /\bCCI approval\b/i, /\bboard approved\b/i, /\bregulatory approval\b/i] },
      { fieldName: 'expectedClosingDate', keywords: [/\bclosing date\b/i, /\bcompletion date\b/i, /\bexpected to close\b/i] },
      { fieldName: 'synergiesDescription', keywords: [/\bsynergy\b/i, /\bsynergies\b/i, /\bcost savings\b/i, /\bstrategic fit\b/i] }
    ],
    IPOParser: [
      { fieldName: 'issueSizeCrores', keywords: [/\bipo size\b/i, /\bissue size\b/i, /\bipo worth\b/i, /\bipo of rs\b/i, /\bpublic issue of rs\b/i] },
      { fieldName: 'freshIssueCrores', keywords: [/\bfresh issue\b/i, /\bfresh shares\b/i] },
      { fieldName: 'ofsCrores', keywords: [/\boffer for sale\b/i, /\bofs\b/i, /\bselling shareholders\b/i] },
      { fieldName: 'priceBandMin', keywords: [/\bprice band\b/i, /\bprice range\b/i, /\bband of rs\b/i] },
      { fieldName: 'priceBandMax', keywords: [/\bupper band\b/i, /\bprice band max\b/i] },
      { fieldName: 'lotSize', keywords: [/\blot size\b/i, /\bminimum bid\b/i, /\blot of\b/i] },
      { fieldName: 'subscriptionTimes', keywords: [/\bsubscribed\b/i, /\bsubscription\b/i, /\btimes subscribed\b/i] },
      { fieldName: 'anchorInvestors', keywords: [/\banchor investor\b/i, /\banchor book\b/i, /\banchor portion\b/i] },
      { fieldName: 'listingDate', keywords: [/\blisting date\b/i, /\blisted on\b/i, /\blisting on\b/i] },
      { fieldName: 'gmpAmount', keywords: [/\bgrey market premium\b/i, /\bgmp\b/i, /\bpremium of rs\b/i] },
      { fieldName: 'registrar', keywords: [/\bregistrar\b/i] },
      { fieldName: 'leadManagers', keywords: [/\blead manager\b/i, /\bbook running lead manager\b/i, /\bBRLM\b/i] }
    ],
    BlockDealParser: [
      { fieldName: 'buyer', keywords: [/\bbuyer\b/i, /\bbought by\b/i, /\bpurchased by\b/i] },
      { fieldName: 'seller', keywords: [/\bseller\b/i, /\bsold by\b/i, /\bdivested by\b/i] },
      { fieldName: 'quantity', keywords: [/\bshares traded\b/i, /\bquantity\b/i, /\bvolume of shares\b/i, /\bblock of shares\b/i] },
      { fieldName: 'averagePrice', keywords: [/\baverage price\b/i, /\bexecuted at\b/i, /\bpriced at\b/i] },
      { fieldName: 'dealValueCrores', keywords: [/\bdeal value\b/i, /\bdeal worth\b/i, /\btransaction of rs\b/i, /\bdeal of rs\b/i] },
      { fieldName: 'exchange', keywords: [/\bnse\b/i, /\bbse\b/i] }
    ],
    BulkDealParser: [
      { fieldName: 'buyer', keywords: [/\bbuyer\b/i, /\bbought by\b/i, /\bpurchased by\b/i] },
      { fieldName: 'seller', keywords: [/\bseller\b/i, /\bsold by\b/i, /\bdivested by\b/i] },
      { fieldName: 'quantity', keywords: [/\bquantity\b/i, /\bvolume of shares\b/i, /\bbulk of shares\b/i] },
      { fieldName: 'averagePrice', keywords: [/\baverage price\b/i, /\bexecuted at\b/i, /\bpriced at\b/i] },
      { fieldName: 'dealValueCrores', keywords: [/\bdeal value\b/i, /\btransaction of rs\b/i, /\bdeal of rs\b/i] },
      { fieldName: 'exchange', keywords: [/\bnse\b/i, /\bbse\b/i] }
    ],
    FundRaiseParser: [
      { fieldName: 'mode', keywords: [/\bqip\b/i, /\brights issue\b/i, /\bpreferential issue\b/i, /\bdebt\b/i, /\bbond\b/i, /\braising capital\b/i, /\bequity dilution\b/i] },
      { fieldName: 'amountCrores', keywords: [/\braise rs\b/i, /\braising rs\b/i, /\braise up to rs\b/i, /\bfundraise of rs\b/i] },
      { fieldName: 'floorPrice', keywords: [/\bfloor price\b/i, /\bissue price\b/i, /\bpriced at\b/i] },
      { fieldName: 'issuePrice', keywords: [/\bissue price\b/i, /\bfinal price\b/i] },
      { fieldName: 'investorDetails', keywords: [/\binstitutional investors\b/i, /\bmarquee investors\b/i, /\bqualified institutional buyers\b/i] }
    ],
    RBIParser: [
      { fieldName: 'repoRatePercent', keywords: [/\brepo rate\b/i] },
      { fieldName: 'reverseRepoRatePercent', keywords: [/\breverse repo\b/i] },
      { fieldName: 'sdfPercent', keywords: [/\bsdf\b/i, /\bstanding deposit facility\b/i] },
      { fieldName: 'msfPercent', keywords: [/\bmsf\b/i, /\bmarginal standing facility\b/i] },
      { fieldName: 'crrPercent', keywords: [/\bcrr\b/i, /\bcash reserve ratio\b/i] },
      { fieldName: 'slrPercent', keywords: [/\bslr\b/i, /\bstatutory liquidity ratio\b/i] },
      { fieldName: 'gdpForecastPercent', keywords: [/\bgdp growth forecast\b/i, /\brbi gdp\b/i, /\bgdp forecast\b/i] },
      { fieldName: 'inflationForecastPercent', keywords: [/\binflation forecast\b/i, /\bcpi forecast\b/i, /\brbi inflation\b/i] },
      { fieldName: 'policyStance', keywords: [/\bstance\b/i, /\baccommodative\b/i, /\bneutral\b/i, /\bhawkish\b/i, /\bwithdrawal of accommodation\b/i] },
      { fieldName: 'liquidityMeasures', keywords: [/\bliquidity\b/i, /\bopen market operations\b/i, /\bomo\b/i, /\bliquidity injection\b/i] }
    ],
    SEBIParser: [
      { fieldName: 'documentType', keywords: [/\bcircular\b/i, /\bpenalty\b/i, /\brestriction\b/i, /\bsettlement\b/i, /\bconsultation\b/i, /\bframework\b/i, /\bcompliance\b/i] },
      { fieldName: 'affectedEntities', keywords: [/\baffected party\b/i, /\bbarred entities\b/i, /\brestricted entities\b/i, /\bpenalized entities\b/i] },
      { fieldName: 'complianceRequirement', keywords: [/\bcompliance\b/i, /\bguidelines\b/i, /\bdisclosure norms\b/i] },
      { fieldName: 'penaltyAmountLakhs', keywords: [/\bpenalty of\b/i, /\bfine of\b/i, /\bpenalty of rs\b/i] }
    ],
    MacroParser: [
      { fieldName: 'gdpGrowthPercent', keywords: [/\bgdp growth\b/i, /\bgdp grew\b/i, /\bgdp expansion\b/i] },
      { fieldName: 'cpiInflationPercent', keywords: [/\bcpi inflation\b/i, /\bretail inflation\b/i, /\bconsumer price index\b/i] },
      { fieldName: 'wpiInflationPercent', keywords: [/\bwpi inflation\b/i, /\bwholesale inflation\b/i, /\bwholesale price index\b/i] },
      { fieldName: 'pmiValue', keywords: [/\bpmi\b/i, /\bpurchasing managers index\b/i] },
      { fieldName: 'tradeDeficitBillionUSD', keywords: [/\btrade deficit\b/i, /\btrade gap\b/i] },
      { fieldName: 'fiscalDeficitPercent', keywords: [/\bfiscal deficit\b/i] },
      { fieldName: 'iipGrowthPercent', keywords: [/\biip grew\b/i, /\biip growth\b/i, /\bindustrial production\b/i] },
      { fieldName: 'gstCollectionCrores', keywords: [/\bgst collection\b/i, /\bgst revenue\b/i, /\bgross gst\b/i] },
      { fieldName: 'unemploymentPercent', keywords: [/\bunemployment rate\b/i, /\bjobless rate\b/i] },
      { fieldName: 'autoSalesUnits', keywords: [/\bauto sales\b/i, /\bcar sales\b/i, /\bvehicle sales\b/i, /\bpassenger vehicle\b/i] }
    ],
    CommodityParser: [
      { fieldName: 'commodityName', keywords: [/\bgold\b/i, /\bsilver\b/i, /\bcrude\b/i, /\boil\b/i, /\bbrent\b/i, /\bcopper\b/i, /\bnatural gas\b/i, /\baluminium\b/i] },
      { fieldName: 'price', keywords: [/\btraded at\b/i, /\bprice at\b/i, /\bfutures at\b/i, /\bper ounce\b/i, /\bper barrel\b/i, /\bper 10g\b/i] },
      { fieldName: 'priceChangePercent', keywords: [/\bgained\b/i, /\brose by\b/i, /\bfell by\b/i, /\bdropped\b/i, /\bup\b/i, /\bdown\b/i] },
      { fieldName: 'movementDirection', keywords: [/\brose\b/i, /\bgained\b/i, /\bhigher\b/i, /\bup\b/i, /\bsurged\b/i, /\bfell\b/i, /\bdropped\b/i, /\blower\b/i, /\bdown\b/i, /\bdeclined\b/i] },
      { fieldName: 'drivers', keywords: [/\bdrivers\b/i, /\bsupply disruption\b/i, /\bdollar strength\b/i, /\bopec\b/i] },
      { fieldName: 'inventoryStatus', keywords: [/\binventory\b/i, /\bstockpile\b/i, /\breserves\b/i, /\bstocks fell\b/i] }
    ],
    ForexParser: [
      { fieldName: 'pair', keywords: [/\busdinr\b/i, /\beurinr\b/i, /\bgbpinr\b/i, /\brupee vs dollar\b/i, /\brupee opens\b/i, /\brupee closes\b/i, /\beuro\b/i, /\bpound\b/i] },
      { fieldName: 'rate', keywords: [/\brupee at\b/i, /\btraded at\b/i, /\bclosed at\b/i, /\bopened at\b/i, /\brupee dollar\b/i] },
      { fieldName: 'changePercent', keywords: [/\brupee fell\b/i, /\brupee gained\b/i, /\brupee appreciated\b/i, /\brupee depreciated\b/i, /\bchange of\b/i] },
      { fieldName: 'dollarIndex', keywords: [/\bdollar index\b/i, /\bdxy\b/i] },
      { fieldName: 'tenYearYieldPercent', keywords: [/\b10-year yield\b/i, /\bbond yield\b/i, /\btreasury yield\b/i, /\bG-Sec yield\b/i] },
      { fieldName: 'drivers', keywords: [/\bfed policy\b/i, /\bcapital outflows\b/i, /\bdollar strength\b/i, /\btrade deficit\b/i] }
    ]
  };

  /**
   * Scans document plainText to detect which fields are actually present.
   * Returns a Set of field names that are expected to exist in the extraction.
   */
  public static detectPresentFields(doc: NormalizedDocument, parserType: string): Set<string> {
    const text = (doc.title + ' ' + (doc.plainText || '')).toLowerCase();
    const presentFields = new Set<string>();

    const rules = this.rules[parserType] || [];
    for (const rule of rules) {
      const isPresent = rule.keywords.some((rx) => rx.test(text));
      if (isPresent) {
        presentFields.add(rule.fieldName);
      }
    }

    return presentFields;
  }

  /**
   * Returns the list of all configured fields for a parser type.
   */
  public static getFieldsForParser(parserType: string): string[] {
    return (this.rules[parserType] || []).map((r) => r.fieldName);
  }
}
