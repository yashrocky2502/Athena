export class CountryDetector {
  public static detect(text: string, publisher: string = ''): string {
    const combined = `${text} ${publisher}`.toLowerCase();

    if (
      combined.includes('india') ||
      combined.includes('nse') ||
      combined.includes('bse') ||
      combined.includes('nifty') ||
      combined.includes('sensex') ||
      combined.includes('rbi') ||
      combined.includes('sebi') ||
      combined.includes('rupee') ||
      combined.includes('pib') ||
      combined.includes('mca') ||
      combined.includes('livemint') ||
      combined.includes('moneycontrol') ||
      combined.includes('economic times') ||
      combined.includes('business standard') ||
      combined.includes('cnbc tv18')
    ) {
      return 'India';
    }

    if (
      combined.includes('us') ||
      combined.includes('usa') ||
      combined.includes('wall street') ||
      combined.includes('fed') ||
      combined.includes('federal reserve') ||
      combined.includes('nasdaq') ||
      combined.includes('nyse') ||
      combined.includes('dow jones') ||
      combined.includes('s&p 500') ||
      combined.includes('sec')
    ) {
      return 'US';
    }

    if (
      combined.includes('europe') ||
      combined.includes('ecb') ||
      combined.includes('uk') ||
      combined.includes('london') ||
      combined.includes('ftse') ||
      combined.includes('dax') ||
      combined.includes('cac') ||
      combined.includes('euro')
    ) {
      return 'Europe';
    }

    if (
      combined.includes('china') ||
      combined.includes('beijing') ||
      combined.includes('shanghai') ||
      combined.includes('yuan') ||
      combined.includes('pboc')
    ) {
      return 'China';
    }

    if (
      combined.includes('japan') ||
      combined.includes('tokyo') ||
      combined.includes('nikkei') ||
      combined.includes('yen') ||
      combined.includes('boj')
    ) {
      return 'Japan';
    }

    if (
      combined.includes('middle east') ||
      combined.includes('dubai') ||
      combined.includes('saudi') ||
      combined.includes('opec') ||
      combined.includes('gulf')
    ) {
      return 'Middle East';
    }

    return 'Global';
  }
}
