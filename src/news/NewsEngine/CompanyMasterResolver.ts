export interface CompanyMasterEntry {
  name: string;
  symbol?: string;
  scripCode?: string;
  isin?: string;
  cinPrefix?: string;
  domain?: string;
  emailDomain?: string;
}

export class CompanyMasterResolver {
  public static readonly MASTER_COMPANIES: CompanyMasterEntry[] = [
    { name: 'Zen Technologies Limited', symbol: 'ZENTEC', scripCode: '533333', isin: 'INE251B01027', cinPrefix: 'L24292TG1993PLC016012', domain: 'zentechnologies.com' },
    { name: 'Larsen & Toubro Limited', symbol: 'LT', scripCode: '500510', isin: 'INE018A01030', domain: 'larsentoubro.com' },
    { name: 'Reliance Industries Limited', symbol: 'RELIANCE', scripCode: '500325', isin: 'INE002A01018', domain: 'ril.com' },
    { name: 'Tata Consultancy Services Limited', symbol: 'TCS', scripCode: '532540', isin: 'INE467B01029', domain: 'tcs.com' },
    { name: 'Infosys Limited', symbol: 'INFY', scripCode: '500209', isin: 'INE009A01021', domain: 'infosys.com' },
    { name: 'HDFC Bank Limited', symbol: 'HDFCBANK', scripCode: '500180', isin: 'INE040A01034', domain: 'hdfcbank.com' },
    { name: 'ICICI Bank Limited', symbol: 'ICICIBANK', scripCode: '502150', isin: 'INE090A01021', domain: 'icicibank.com' },
    { name: 'State Bank of India', symbol: 'SBIN', scripCode: '500112', isin: 'INE062A01020', domain: 'sbi.co.in' },
    { name: 'Bharti Airtel Limited', symbol: 'BHARTIARTL', scripCode: '532454', isin: 'INE397D01024', domain: 'airtel.com' },
    { name: 'ITC Limited', symbol: 'ITC', scripCode: '500875', isin: 'INE154A01025', domain: 'itc.in' },
    { name: 'Axis Bank Limited', symbol: 'AXISBANK', scripCode: '532215', isin: 'INE238A01034', domain: 'axisbank.com' },
    { name: 'Kotak Mahindra Bank Limited', symbol: 'KOTAKBANK', scripCode: '500247', isin: 'INE237A01028', domain: 'kotak.com' },
    { name: 'Sun Pharmaceutical Industries Limited', symbol: 'SUNPHARMA', scripCode: '524715', isin: 'INE044A01036', domain: 'sunpharma.com' },
    { name: 'Titan Company Limited', symbol: 'TITAN', scripCode: '500114', isin: 'INE280A01028', domain: 'titan.co.in' },
    { name: 'Adani Enterprises Limited', symbol: 'ADANIENT', scripCode: '512599', isin: 'INE423A01024', domain: 'adanienterprises.com' },
    { name: 'Adani Ports and Special Economic Zone Limited', symbol: 'ADANIPORTS', scripCode: '532921', isin: 'INE742H01013', domain: 'adaniports.com' },
    { name: 'NTPC Limited', symbol: 'NTPC', scripCode: '532555', isin: 'INE733E01010', domain: 'ntpc.co.in' },
    { name: 'Power Grid Corporation of India Limited', symbol: 'POWERGRID', scripCode: '532898', isin: 'INE752E01010', domain: 'powergrid.in' },
    { name: 'Coal India Limited', symbol: 'COALINDIA', scripCode: '533278', isin: 'INE522F01014', domain: 'coalindia.in' },
    { name: 'Oil and Natural Gas Corporation Limited', symbol: 'ONGC', scripCode: '500312', isin: 'INE213A01029', domain: 'ongcindia.com' },
    { name: 'UltraTech Cement Limited', symbol: 'ULTRACEMCO', scripCode: '532538', isin: 'INE481G01011', domain: 'ultratechcement.com' },
    { name: 'Mahindra & Mahindra Limited', symbol: 'M&M', scripCode: '500520', isin: 'INE101A01026', domain: 'mahindra.com' },
    { name: 'Bajaj Finance Limited', symbol: 'BAJFINANCE', scripCode: '500034', isin: 'INE296A01024', domain: 'bajajfinserv.in' },
    { name: 'Hindalco Industries Limited', symbol: 'HINDALCO', scripCode: '500440', isin: 'INE038A01020', domain: 'hindalco.com' },
    { name: 'JSW Steel Limited', symbol: 'JSWSTEEL', scripCode: '500228', isin: 'INE019A01038', domain: 'jsw.in' },
    { name: 'Tata Steel Limited', symbol: 'TATASTEEL', scripCode: '500470', isin: 'INE081A01020', domain: 'tatasteel.com' },
    { name: 'Cipla Limited', symbol: 'CIPLA', scripCode: '500087', isin: 'INE059A01026', domain: 'cipla.com' },
    { name: "Dr. Reddy's Laboratories Limited", symbol: 'DRREDDY', scripCode: '500124', isin: 'INE089A01023', domain: 'drreddys.com' },
    { name: "Divi's Laboratories Limited", symbol: 'DIVISLAB', scripCode: '532488', isin: 'INE361B01024', domain: 'divislabs.com' },
    { name: 'Eicher Motors Limited', symbol: 'EICHERMOT', scripCode: '505200', isin: 'INE066A01021', domain: 'eichermotors.com' },
    { name: 'Hero MotoCorp Limited', symbol: 'HEROMOTOCO', scripCode: '500182', isin: 'INE158A01026', domain: 'heromotocorp.com' },
    { name: 'Bajaj Auto Limited', symbol: 'BAJAJ-AUTO', scripCode: '532977', isin: 'INE917I01010', domain: 'bajajauto.com' },
    { name: 'TVS Motor Company Limited', symbol: 'TVSMOTOR', scripCode: '532343', isin: 'INE494B01023', domain: 'tvsmotor.com' },
    { name: 'Bharat Electronics Limited', symbol: 'BEL', scripCode: '500049', isin: 'INE263A01024', domain: 'bel-india.in' },
    { name: 'Hindustan Aeronautics Limited', symbol: 'HAL', scripCode: '541154', isin: 'INE066F01020', domain: 'hal-india.co.in' },
    { name: 'Mazagon Dock Shipbuilders Limited', symbol: 'MAZDOCK', scripCode: '543237', isin: 'INE249Z01012', domain: 'mazagondock.in' },
    { name: 'Cochin Shipyard Limited', symbol: 'COCHINSHIP', scripCode: '540678', isin: 'INE704P01025', domain: 'cochinshipyard.in' },
    { name: 'Indian Renewable Energy Development Agency Limited', symbol: 'IREDA', scripCode: '544026', isin: 'INE202E01016', domain: 'ireda.in' },
    { name: 'Power Finance Corporation Limited', symbol: 'PFC', scripCode: '532810', isin: 'INE134E01011', domain: 'pfcindia.com' },
    { name: 'REC Limited', symbol: 'REC', scripCode: '532955', isin: 'INE020B01018', domain: 'recindia.nic.in' },
    { name: 'Maruti Suzuki India Limited', symbol: 'MARUTI', scripCode: '532500', isin: 'INE585B01010', domain: 'marutisuzuki.com' },
    { name: 'Tata Motors Passenger Vehicles Ltd', symbol: 'TATAMOTORS', scripCode: '500570', isin: 'INE155A01022', domain: 'tatamotors.com' },
    { name: 'Tata Motors Commercial Vehicles Ltd', symbol: 'TATAMTRDVR', scripCode: '500571', isin: 'INE155A01030', domain: 'tatamotors.com' },
    { name: 'Wipro Limited', symbol: 'WIPRO', scripCode: '507685', isin: 'INE075A01022', domain: 'wipro.com' },
    { name: 'HCL Technologies Limited', symbol: 'HCLTECH', scripCode: '532281', isin: 'INE860A01027', domain: 'hcltech.com' },
    { name: 'Tech Mahindra Limited', symbol: 'TECHM', scripCode: '532755', isin: 'INE669C01036', domain: 'techmahindra.com' },
    { name: 'LTIMindtree Limited', symbol: 'LTIM', scripCode: '540005', isin: 'INE214T01019', domain: 'ltimindtree.com' },
    { name: 'Persistent Systems Limited', symbol: 'PERSISTENT', scripCode: '533179', isin: 'INE262H01021', domain: 'persistent.com' },
    { name: 'Coforge Limited', symbol: 'COFORGE', scripCode: '532541', isin: 'INE591G01017', domain: 'coforge.com' },
    { name: 'KPIT Technologies Limited', symbol: 'KPITTECH', scripCode: '542651', isin: 'INE04I401011', domain: 'kpit.com' },
    { name: 'Tata Elxsi Limited', symbol: 'TATAELXSI', scripCode: '500408', isin: 'INE670A01012', domain: 'tataelxsi.com' },
    { name: 'Mphasis Limited', symbol: 'MPHASIS', scripCode: '526299', isin: 'INE356A01018', domain: 'mphasis.com' },
    { name: 'L&T Technology Services Limited', symbol: 'LTTS', scripCode: '540115', isin: 'INE010V01017', domain: 'ltts.com' },
    { name: 'Trent Limited', symbol: 'TRENT', scripCode: '500251', isin: 'INE849A01020', domain: 'trentlimited.com' },
    { name: 'Bharat Heavy Electricals Limited', symbol: 'BHEL', scripCode: '500103', isin: 'INE257A01026', domain: 'bhel.in' },
    { name: 'NHPC Limited', symbol: 'NHPC', scripCode: '533098', isin: 'INE848E01016', domain: 'nhpcindia.com' },
    { name: 'Rail Vikas Nigam Limited', symbol: 'RVNL', scripCode: '542649', isin: 'INE415G01027', domain: 'rvnl.org' },
    { name: 'Indian Railway Finance Corporation Limited', symbol: 'IRFC', scripCode: '543257', isin: 'INE053F01010', domain: 'irfc.co.in' },
    { name: 'Ircon International Limited', symbol: 'IRCON', scripCode: '541956', isin: 'INE962Y01021', domain: 'ircon.org' },
    { name: 'Punjab National Bank', symbol: 'PNB', scripCode: '532461', isin: 'INE160A01022', domain: 'pnbindia.in' },
    { name: 'Canara Bank', symbol: 'CANBK', scripCode: '532483', isin: 'INE476A01014', domain: 'canarabank.com' },
    { name: 'Bank of Baroda', symbol: 'BANKBARODA', scripCode: '532134', isin: 'INE028A01039', domain: 'bankofbaroda.in' },
    { name: 'Yes Bank Limited', symbol: 'YESBANK', scripCode: '532648', isin: 'INE528G01035', domain: 'yesbank.in' },
    { name: 'Federal Bank Limited', symbol: 'FEDERALBNK', scripCode: '500469', isin: 'INE171A01029', domain: 'federalbank.co.in' },
    { name: 'IDFC FIRST Bank Limited', symbol: 'IDFCFIRSTB', scripCode: '539437', isin: 'INE092T01019', domain: 'idfcfirstbank.com' },
    { name: 'Polycab India Limited', symbol: 'POLYCAB', scripCode: '542652', isin: 'INE455K01017', domain: 'polycab.com' },
    { name: 'Havells India Limited', symbol: 'HAVELLS', scripCode: '517354', isin: 'INE176B01034', domain: 'havells.com' },
    { name: 'DLF Limited', symbol: 'DLF', scripCode: '532868', isin: 'INE271C01023', domain: 'dlf.in' },
    { name: 'Suzlon Energy Limited', symbol: 'SUZLON', scripCode: '532667', isin: 'INE040H01021', domain: 'suzlon.com' },
    { name: 'Zomato Limited', symbol: 'ZOMATO', scripCode: '543320', isin: 'INE758T01015', domain: 'zomato.com' },
    { name: 'One97 Communications Limited', symbol: 'PAYTM', scripCode: '543396', isin: 'INE982J01020', domain: 'paytm.com' },
    { name: 'Jio Financial Services Limited', symbol: 'JIOFIN', scripCode: '543940', isin: 'INE072Q01015', domain: 'jfsstat.com' }
  ];

  public static resolveBySymbol(symbol?: string): string | null {
    if (!symbol) return null;
    const cleanSym = symbol.trim().toUpperCase();
    const found = this.MASTER_COMPANIES.find(c => c.symbol?.toUpperCase() === cleanSym);
    return found ? found.name : null;
  }

  public static resolveByScripCode(code?: string): string | null {
    if (!code) return null;
    const cleanCode = code.trim();
    const found = this.MASTER_COMPANIES.find(c => c.scripCode === cleanCode);
    return found ? found.name : null;
  }

  public static resolveByIsin(isin?: string): string | null {
    if (!isin) return null;
    const cleanIsin = isin.trim().toUpperCase();
    const found = this.MASTER_COMPANIES.find(c => c.isin?.toUpperCase() === cleanIsin);
    return found ? found.name : null;
  }

  public static resolveByDomain(domain?: string): string | null {
    if (!domain) return null;
    const cleanD = domain.trim().toLowerCase();
    const found = this.MASTER_COMPANIES.find(c => c.domain?.toLowerCase() === cleanD || c.emailDomain?.toLowerCase() === cleanD);
    return found ? found.name : null;
  }

  public static resolveByCin(cin?: string): string | null {
    if (!cin) return null;
    const cleanCin = cin.trim().toUpperCase();
    const found = this.MASTER_COMPANIES.find(c => c.cinPrefix && cleanCin.includes(c.cinPrefix));
    return found ? found.name : null;
  }
}
