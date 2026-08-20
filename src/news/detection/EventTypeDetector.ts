/**
 * ATHENA NEWS ENGINE — EVENT TYPE DETECTOR (STAGE 7.6)
 */

export class EventTypeDetector {
  public static detect(headline: string, body: string = ""): string {
    const text = `${headline} ${body}`.toLowerCase();

    if (text.includes('penalty') || text.includes('compliance') || text.includes('fines')) {
      return 'REGULATORY_ACTION';
    }
    if (text.includes('sebi') && (text.includes('interim order') || text.includes('order') || text.includes('notice') || text.includes('restrains'))) {
      return 'SEBI_ACTION';
    }
    if (text.includes('block deal') || text.includes('bulk deal')) {
      return 'BLOCK_DEAL';
    }
    if (text.includes('stake sale') || text.includes('sells stake') || text.includes('offload') || (text.includes('sells') && text.includes('stake')) || (text.includes('sells') && text.includes('shares'))) {
      return 'STAKE_SALE';
    }
    if (text.includes('q1') || text.includes('q2') || text.includes('q3') || text.includes('q4') || text.includes('net profit') || text.includes('financial results')) {
      return 'EARNINGS';
    }
    if (text.includes('ipo') || text.includes('initial public offer') || text.includes('gmp')) {
      return 'IPO';
    }
    if (text.includes('dividend') || text.includes('interim dividend')) {
      return 'DIVIDEND';
    }
    if (text.includes('buyback') || text.includes('share repurchase')) {
      return 'BUYBACK';
    }
    if (text.includes('acquires') || text.includes('merger') || text.includes('acquisition') || text.includes('controlling stake')) {
      return 'M_AND_A';
    }
    if (text.includes('order win') || text.includes('bags') || text.includes('bagged') || text.includes('contract win') || text.includes('solar power project')) {
      return 'ORDER_WIN';
    }
    if (text.includes('qip') || text.includes('institutional placement')) {
      return 'QIP';
    }
    if (text.includes('upgrade') || text.includes('downgrade') || text.includes('rating') || text.includes('target price')) {
      return 'RATING_CHANGE';
    }
    if (text.includes('rbi') && (text.includes('penalty') || text.includes('compliance') || text.includes('fines'))) {
      return 'REGULATORY_ACTION';
    }
    if (text.includes('repo rate') || text.includes('mpc') || text.includes('rbi monetary policy')) {
      return 'RBI_POLICY';
    }
    if (text.includes('fed') || text.includes('federal reserve') || text.includes('powell') || text.includes('fomc') || text.includes('central bank')) {
      return 'CENTRAL_BANK';
    }
    if (text.includes('iip') || text.includes('gdp') || text.includes('industrial production')) {
      return 'MACRO_DATA';
    }
    if (text.includes('mclr') || text.includes('interest rate') || text.includes('loan rate')) {
      return 'INTEREST_RATE';
    }
    if (text.includes('cpi') || text.includes('inflation') || text.includes('wpi')) {
      return 'INFLATION';
    }
    if (text.includes('rupee') || text.includes('dollar') || text.includes('fx')) {
      return 'CURRENCY';
    }
    if (text.includes('crude') || text.includes('oil') || text.includes('gold') || text.includes('brent')) {
      return 'COMMODITY';
    }
    if (text.includes('subscription') || text.includes('product') || text.includes('tariff') || /\bplan\b|\bplans\b/i.test(text)) {
      return 'PRODUCT_LAUNCH';
    }
    if (text.includes('capex') || text.includes('expenditure') || text.includes('expansion')) {
      return 'CAPEX';
    }
    if (text.includes('appoints') || text.includes('ceo') || text.includes('resignation')) {
      return 'MANAGEMENT_CHANGE';
    }
    if (text.includes('pledge') || text.includes('promoter')) {
      return 'PROMOTER_ACTION';
    }
    if (text.includes('court') || text.includes('stay') || text.includes('dispute') || text.includes('arbitration')) {
      return 'LEGAL_ACTION';
    }

    return 'OTHER';
  }
}
