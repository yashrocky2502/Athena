export type AnnouncementTypeV2 =
  | 'Quarterly Results'
  | 'Annual Results'
  | 'Board Meeting Outcome'
  | 'Investor Presentation'
  | 'Conference Call'
  | 'Dividend'
  | 'Bonus'
  | 'Split'
  | 'Rights'
  | 'Buyback'
  | 'Open Offer'
  | 'QIP'
  | 'Preferential Issue'
  | 'Order Win'
  | 'LOI'
  | 'Contract Award'
  | 'MoU'
  | 'Acquisition'
  | 'Merger'
  | 'Credit Rating'
  | 'Resignation'
  | 'Appointment'
  | 'Trading Window Closure'
  | 'Shareholding Pattern'
  | 'Regulation 30'
  | 'Compliance Certificate'
  | 'Postal Ballot'
  | 'Fund Raise'
  | 'Debt Issue'
  | 'ESOP'
  | 'General Announcement';

export class AnnouncementClassifierV2 {
  public static classify(text: string, headline?: string): AnnouncementTypeV2 {
    const headLower = (headline || '').toLowerCase();
    const bodyLower = text.toLowerCase();
    const combined = `${headLower} ${bodyLower}`;

    // HEADLINE HIGHEST PRIORITY MATCHES
    if (headLower.includes('outcome of board meeting') || headLower.includes('board meeting outcome')) return 'Board Meeting Outcome';
    if (headLower.includes('investor presentation') || headLower.includes('earnings presentation') || headLower.includes('investor deck')) return 'Investor Presentation';
    if (headLower.includes('conference call') || headLower.includes('earnings call') || headLower.includes('audio recording') || headLower.includes('transcript')) return 'Conference Call';
    if (headLower.includes('order win') || headLower.includes('bagged order') || headLower.includes('contract won')) return 'Order Win';
    if (headLower.includes('contract award') || headLower.includes('award of contract')) return 'Contract Award';
    if (headLower.includes('letter of intent') || headLower.includes('loi')) return 'LOI';
    if (headLower.includes('mou') || headLower.includes('memorandum of understanding')) return 'MoU';
    if (headLower.includes('credit rating')) return 'Credit Rating';
    if (headLower.includes('trading window closure') || headLower.includes('closure of trading window')) return 'Trading Window Closure';
    if (headLower.includes('shareholding pattern')) return 'Shareholding Pattern';
    if (headLower.includes('resignation')) return 'Resignation';
    if (headLower.includes('appointment')) return 'Appointment';
    if (headLower.includes('esop') || headLower.includes('stock option')) return 'ESOP';
    if (headLower.includes('bonus issue')) return 'Bonus';
    if (headLower.includes('bonus')) return 'Bonus';
    if (headLower.includes('split') || headLower.includes('sub-division')) return 'Split';
    if (headLower.includes('dividend')) return 'Dividend';
    if (headLower.includes('rights issue') || headLower.includes('rights basis')) return 'Rights';
    if (headLower.includes('preferential')) return 'Preferential Issue';
    if (headLower.includes('buyback') || headLower.includes('buy-back')) return 'Buyback';
    if (headLower.includes('open offer')) return 'Open Offer';
    if (headLower.includes('postal ballot')) return 'Postal Ballot';
    if (headLower.includes('merger') || headLower.includes('amalgamation')) return 'Merger';
    if (headLower.includes('qip') || headLower.includes('qualified institutional placement')) return 'QIP';
    if (headLower.includes('debt issue') || headLower.includes('debt raising') || headLower.includes('ncd') || headLower.includes('bonds issuance')) return 'Debt Issue';
    if (headLower.includes('fund raise') || headLower.includes('raising of funds')) return 'Fund Raise';
    if (headLower.includes('acquisition') || headLower.includes('stake purchase')) return 'Acquisition';
    if (headLower.includes('compliance certificate')) return 'Compliance Certificate';
    if (headLower.includes('regulation 30')) return 'Regulation 30';

    // BODY & FULL TEXT MATCHES
    if (combined.includes('q1') || combined.includes('q2') || combined.includes('q3') || combined.includes('q4') || combined.includes('un-audited financial result') || combined.includes('quarterly financial result') || combined.includes('quarterly results')) {
      return 'Quarterly Results';
    }
    if (combined.includes('audited financial result') || combined.includes('annual result') || combined.includes('full year result') || combined.includes('audited annual')) {
      return 'Annual Results';
    }
    if (combined.includes('investor presentation') || combined.includes('earnings presentation') || combined.includes('investor deck')) {
      return 'Investor Presentation';
    }
    if (combined.includes('conference call') || combined.includes('earnings call') || combined.includes('audio recording') || combined.includes('transcript of analyst')) {
      return 'Conference Call';
    }
    if (combined.includes('outcome of board meeting') || combined.includes('board meeting outcome') || combined.includes('board meeting held on')) {
      return 'Board Meeting Outcome';
    }
    if (combined.includes('dividend') || combined.includes('interim dividend') || combined.includes('final dividend')) return 'Dividend';
    if (combined.includes('bonus issue') || combined.includes('bonus shares')) return 'Bonus';
    if (combined.includes('stock split') || combined.includes('sub-division of shares') || combined.includes('split')) return 'Split';
    if (combined.includes('rights issue') || combined.includes('rights basis')) return 'Rights';
    if (combined.includes('acquisition') || combined.includes('stake purchase') || combined.includes('takeover')) return 'Acquisition';
    if (combined.includes('merger') || combined.includes('amalgamation') || combined.includes('scheme of arrangement')) return 'Merger';
    if (combined.includes('order win') || combined.includes('order received') || combined.includes('bagged order')) return 'Order Win';
    if (combined.includes('contract award') || combined.includes('award of contract') || combined.includes('letter of award')) return 'Contract Award';
    if (combined.includes('letter of intent') || combined.includes(' loi ')) return 'LOI';
    if (combined.includes('memorandum of understanding') || combined.includes(' mou ')) return 'MoU';
    if (combined.includes('credit rating') || combined.includes('rating reaffirmed') || combined.includes('rating upgraded') || combined.includes('crisil') || combined.includes('care rating')) return 'Credit Rating';
    if (combined.includes('resignation')) return 'Resignation';
    if (combined.includes('appointment')) return 'Appointment';
    if (combined.includes('shareholding pattern') || combined.includes('shareholding statement')) return 'Shareholding Pattern';
    if (combined.includes('closure of trading window') || combined.includes('trading window closure') || combined.includes('trading window')) return 'Trading Window Closure';
    if (combined.includes('postal ballot')) return 'Postal Ballot';
    if (combined.includes('fund raise') || combined.includes('raising of funds')) return 'Fund Raise';
    if (combined.includes('esop') || combined.includes('esos') || combined.includes('stock option')) return 'ESOP';
    if (combined.includes('buyback') || combined.includes('buy-back')) return 'Buyback';
    if (combined.includes('open offer')) return 'Open Offer';
    if (combined.includes('preferential allotment') || combined.includes('preferential issue')) return 'Preferential Issue';
    if (combined.includes('qip') || combined.includes('qualified institutional placement')) return 'QIP';
    if (combined.includes('ncd') || combined.includes('debentures') || combined.includes('bonds') || combined.includes('debt raising')) return 'Debt Issue';
    if (combined.includes('compliance certificate') || combined.includes('certificate under regulation')) return 'Compliance Certificate';
    if (combined.includes('regulation 30') || combined.includes('sebi (lodr)')) return 'Regulation 30';

    return 'General Announcement';
  }
}
