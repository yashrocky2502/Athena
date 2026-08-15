export interface FNOCompany {
  name: string;
  symbol: string;      // Trading symbol
  nseSymbol: string;   // NSE Ticker symbol
  aliases: string[];   // Aliases & common abbreviations
  sector: string;
  industry: string;
  isFnO: boolean;
}

export const CANONICAL_FNO_204_SYMBOLS: readonly string[] = [
  '360ONE', 'ABB', 'ABCAPITAL', 'ADANIENSOL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ADANIPOWER', 'ALKEM', 'AMBER',
  'AMBUJACEM', 'ANGELONE', 'APLAPOLLO', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'AUBANK', 'AUROPHARMA',
  'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV', 'BAJAJHLDNG', 'BAJFINANCE', 'BANDHANBNK', 'BANKBARODA', 'BDL', 'BEL', 'BHARATFORG',
  'BHARTIARTL', 'BHEL', 'BIOCON', 'BLUESTARCO', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'BSE', 'CAMS', 'CANBK',
  'CDSL', 'CGPOWER', 'CHOLAFIN', 'CIPLA', 'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'CROMPTON', 'CUMMINSIND',
  'DABUR', 'DALBHARAT', 'DELHIVERY', 'DIVISLAB', 'DIXON', 'DLF', 'DMART', 'DRREDDY', 'EICHERMOT', 'ETERNAL',
  'FEDERALBNK', 'FORTIS', 'GAIL', 'GLENMARK', 'GMRAIRPORT', 'GODFRYPHLP', 'GODREJCP', 'GODREJPROPERTY', 'GRASIM', 'GVT&D',
  'HAL', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDPETRO', 'HINDUNILVR',
  'HINDZINC', 'HUDCO', 'HYUNDAI', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDEA', 'IDFCFIRSTB', 'IEX', 'INDHOTEL',
  'INDIANBANK', 'INDIGO', 'INDUSINDBK', 'INDUSTOWER', 'INFY', 'INOXWIND', 'IOC', 'IRCTC', 'IREDA', 'IRFC',
  'ITC', 'JINDALSTEL', 'JIOFIN', 'JSWENERGY', 'JSWSTEEL', 'JUBLFOOD', 'KALYANKJIL', 'KAYNES', 'KEI', 'KFINTECH',
  'KOTAKBANK', 'KPITTECH', 'LAURUSLABS', 'LICHSGFIN', 'LICI', 'LODHA', 'LT', 'LTF', 'LTIM', 'LUPIN',
  'M&M', 'MANAPPURAM', 'MANKIND', 'MARICO', 'MARUTI', 'MAXHEALTH', 'MAZDOCK', 'MCX', 'MFSL', 'MOTHERSON',
  'MOTILALOFS', 'MPHASIS', 'MUTHOOTFIN', 'NAM-INDIA', 'NATIONALUM', 'NAUKRI', 'NBCC', 'NESTLEIND', 'NHPC', 'NMDC',
  'NTPC', 'OBEROIRLTY', 'OFSS', 'OIL', 'ONGC', 'PAGEIND', 'PATANJALI', 'PAYTM', 'PERSISTENT', 'PETRONET',
  'PHOENIXLTD', 'PIDILITIND', 'PIIND', 'PNB', 'PNBHOUSING', 'POLICYBZR', 'POLYCAB', 'POWERGRID', 'POWERINDIA', 'PREMIERENE',
  'PRESTIGE', 'RADICO', 'RBLBANK', 'RECLTD', 'RELIANCE', 'RVNL', 'SAIL', 'SBICARD', 'SBILIFE', 'SBIN',
  'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SOLARINDS', 'SONACOMS', 'SRF', 'SUNPHARMA', 'SUPREMEIND', 'SUZLON', 'SWIGGY',
  'TATACONSUM', 'TATAELXSI', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TCS', 'TECHM', 'TIINDIA', 'TITAN', 'TORNTPHARM',
  'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'UNOMINDA', 'UPL', 'VBL', 'VEDL', 'VOLTAS',
  'WAAREEENER', 'WIPRO', 'YESBANK', 'ZYDUSLIFE'
];

export const FNO_COMPANIES_REGISTRY: FNOCompany[] = [
  // Financials & Banking
  { name: '360 ONE WAM', symbol: '360ONE', nseSymbol: '360ONE.NS', aliases: ['360one', 'iifl wealth', '360 one'], sector: 'Financial Services', industry: 'Wealth Management', isFnO: true },
  { name: 'ABB India', symbol: 'ABB', nseSymbol: 'ABB.NS', aliases: ['abb', 'abb india'], sector: 'Industrials', industry: 'Electrical Equipment', isFnO: true },
  { name: 'Aditya Birla Capital', symbol: 'ABCAPITAL', nseSymbol: 'ABCAPITAL.NS', aliases: ['abcapital', 'aditya birla capital'], sector: 'Financial Services', industry: 'NBFC', isFnO: true },
  { name: 'Adani Energy Solutions', symbol: 'ADANIENSOL', nseSymbol: 'ADANIENSOL.NS', aliases: ['adaniensol', 'adani transmission', 'adani energy'], sector: 'Utilities', industry: 'Power Transmission', isFnO: true },
  { name: 'Adani Enterprises', symbol: 'ADANIENT', nseSymbol: 'ADANIENT.NS', aliases: ['adanient', 'adani enterprises'], sector: 'Industrials', industry: 'Trading & Infrastructure', isFnO: true },
  { name: 'Adani Green Energy', symbol: 'ADANIGREEN', nseSymbol: 'ADANIGREEN.NS', aliases: ['adanigreen', 'adani green'], sector: 'Utilities', industry: 'Renewable Power', isFnO: true },
  { name: 'Adani Ports & SEZ', symbol: 'ADANIPORTS', nseSymbol: 'ADANIPORTS.NS', aliases: ['adaniports', 'adani ports'], sector: 'Industrials', industry: 'Ports & Logistics', isFnO: true },
  { name: 'Adani Power', symbol: 'ADANIPOWER', nseSymbol: 'ADANIPOWER.NS', aliases: ['adanipower', 'adani power'], sector: 'Utilities', industry: 'Power Generation', isFnO: true },
  { name: 'Alkem Laboratories', symbol: 'ALKEM', nseSymbol: 'ALKEM.NS', aliases: ['alkem', 'alkem lab'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Amber Enterprises', symbol: 'AMBER', nseSymbol: 'AMBER.NS', aliases: ['amber', 'amber enterprises'], sector: 'Consumer Discretionary', industry: 'Air Conditioners', isFnO: true },
  { name: 'Ambuja Cements', symbol: 'AMBUJACEM', nseSymbol: 'AMBUJACEM.NS', aliases: ['ambujacem', 'ambuja cement', 'ambuja'], sector: 'Basic Materials', industry: 'Cement', isFnO: true },
  { name: 'Angel One', symbol: 'ANGELONE', nseSymbol: 'ANGELONE.NS', aliases: ['angelone', 'angel broking', 'angel one'], sector: 'Financial Services', industry: 'Stockbroking', isFnO: true },
  { name: 'APL Apollo Tubes', symbol: 'APLAPOLLO', nseSymbol: 'APLAPOLLO.NS', aliases: ['aplapollo', 'apl apollo'], sector: 'Industrials', industry: 'Steel Tubes', isFnO: true },
  { name: 'Apollo Hospitals', symbol: 'APOLLOHOSP', nseSymbol: 'APOLLOHOSP.NS', aliases: ['apollohosp', 'apollo hospitals', 'apollo hospital'], sector: 'Healthcare', industry: 'Healthcare Facilities', isFnO: true },
  { name: 'Apollo Tyres', symbol: 'APOLLOTYRE', nseSymbol: 'APOLLOTYRE.NS', aliases: ['apollotyre', 'apollo tyres', 'apollo tyre'], sector: 'Automobile', industry: 'Tyres & Rubber', isFnO: true },
  { name: 'Ashok Leyland', symbol: 'ASHOKLEY', nseSymbol: 'ASHOKLEY.NS', aliases: ['ashokley', 'ashok leyland'], sector: 'Automobile', industry: 'Commercial Vehicles', isFnO: true },
  { name: 'Asian Paints', symbol: 'ASIANPAINT', nseSymbol: 'ASIANPAINT.NS', aliases: ['asianpaint', 'asian paints'], sector: 'Consumer Discretionary', industry: 'Paints', isFnO: true },
  { name: 'Astral Limited', symbol: 'ASTRAL', nseSymbol: 'ASTRAL.NS', aliases: ['astral', 'astral pipes'], sector: 'Industrials', industry: 'Plastic Pipes', isFnO: true },
  { name: 'AU Small Finance Bank', symbol: 'AUBANK', nseSymbol: 'AUBANK.NS', aliases: ['aubank', 'au bank', 'au small finance'], sector: 'Financial Services', industry: 'Small Finance Bank', isFnO: true },
  { name: 'Aurobindo Pharma', symbol: 'AUROPHARMA', nseSymbol: 'AUROPHARMA.NS', aliases: ['auropharma', 'aurobindo pharma', 'aurobindo'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Axis Bank', symbol: 'AXISBANK', nseSymbol: 'AXISBANK.NS', aliases: ['axisbank', 'axis bank', 'axis'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Bajaj Auto', symbol: 'BAJAJ-AUTO', nseSymbol: 'BAJAJ-AUTO.NS', aliases: ['bajaj-auto', 'bajaj auto'], sector: 'Automobile', industry: 'Two & Three Wheelers', isFnO: true },
  { name: 'Bajaj Finserv', symbol: 'BAJAJFINSV', nseSymbol: 'BAJAJFINSV.NS', aliases: ['bajajfinsv', 'bajaj finserv'], sector: 'Financial Services', industry: 'Holding Company', isFnO: true },
  { name: 'Bajaj Holdings & Investment', symbol: 'BAJAJHLDNG', nseSymbol: 'BAJAJHLDNG.NS', aliases: ['bajajhldng', 'bajaj holdings'], sector: 'Financial Services', industry: 'Holding Company', isFnO: true },
  { name: 'Bajaj Finance', symbol: 'BAJFINANCE', nseSymbol: 'BAJFINANCE.NS', aliases: ['bajfinance', 'bajaj finance'], sector: 'Financial Services', industry: 'NBFC', isFnO: true },
  { name: 'Bandhan Bank', symbol: 'BANDHANBNK', nseSymbol: 'BANDHANBNK.NS', aliases: ['bandhanbnk', 'bandhan bank'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Bank of Baroda', symbol: 'BANKBARODA', nseSymbol: 'BANKBARODA.NS', aliases: ['bankbaroda', 'bank of baroda', 'bob'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'Bharat Dynamics', symbol: 'BDL', nseSymbol: 'BDL.NS', aliases: ['bdl', 'bharat dynamics'], sector: 'Industrials', industry: 'Defense', isFnO: true },
  { name: 'Bharat Electronics', symbol: 'BEL', nseSymbol: 'BEL.NS', aliases: ['bel', 'bharat electronics'], sector: 'Industrials', industry: 'Defense Electronics', isFnO: true },
  { name: 'Bharat Forge', symbol: 'BHARATFORG', nseSymbol: 'BHARATFORG.NS', aliases: ['bharatforg', 'bharat forge'], sector: 'Industrials', industry: 'Auto Components', isFnO: true },
  { name: 'Bharti Airtel', symbol: 'BHARTIARTL', nseSymbol: 'BHARTIARTL.NS', aliases: ['bhartiartl', 'bharti airtel', 'airtel'], sector: 'Telecommunications', industry: 'Telecom Services', isFnO: true },
  { name: 'Bharat Heavy Electricals', symbol: 'BHEL', nseSymbol: 'BHEL.NS', aliases: ['bhel', 'bharat heavy electricals'], sector: 'Industrials', industry: 'Heavy Electrical Equipment', isFnO: true },
  { name: 'Biocon', symbol: 'BIOCON', nseSymbol: 'BIOCON.NS', aliases: ['biocon'], sector: 'Healthcare', industry: 'Biotechnology', isFnO: true },
  { name: 'Blue Star', symbol: 'BLUESTARCO', nseSymbol: 'BLUESTARCO.NS', aliases: ['bluestarco', 'blue star'], sector: 'Consumer Discretionary', industry: 'Air Conditioners', isFnO: true },
  { name: 'Bosch Limited', symbol: 'BOSCHLTD', nseSymbol: 'BOSCHLTD.NS', aliases: ['boschltd', 'bosch'], sector: 'Automobile', industry: 'Auto Ancillaries', isFnO: true },
  { name: 'Bharat Petroleum', symbol: 'BPCL', nseSymbol: 'BPCL.NS', aliases: ['bpcl', 'bharat petroleum'], sector: 'Energy', industry: 'Oil Refining', isFnO: true },
  { name: 'Britannia Industries', symbol: 'BRITANNIA', nseSymbol: 'BRITANNIA.NS', aliases: ['britannia', 'britannia industries'], sector: 'Consumer Goods', industry: 'Packaged Foods', isFnO: true },
  { name: 'BSE Limited', symbol: 'BSE', nseSymbol: 'BSE.NS', aliases: ['bse', 'bse ltd', 'bse limited'], sector: 'Financial Services', industry: 'Financial Exchange', isFnO: true },
  { name: 'Computer Age Management Services', symbol: 'CAMS', nseSymbol: 'CAMS.NS', aliases: ['cams', 'computer age management'], sector: 'Financial Services', industry: 'Financial Tech', isFnO: true },
  { name: 'Canara Bank', symbol: 'CANBK', nseSymbol: 'CANBK.NS', aliases: ['canbk', 'canara bank'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'Central Depository Services', symbol: 'CDSL', nseSymbol: 'CDSL.NS', aliases: ['cdsl'], sector: 'Financial Services', industry: 'Depository', isFnO: true },
  { name: 'CG Power and Industrial Solutions', symbol: 'CGPOWER', nseSymbol: 'CGPOWER.NS', aliases: ['cgpower', 'cg power', 'crompton greaves power'], sector: 'Industrials', industry: 'Electrical Equipment', isFnO: true },
  { name: 'Cholamandalam Investment', symbol: 'CHOLAFIN', nseSymbol: 'CHOLAFIN.NS', aliases: ['cholafin', 'cholamandalam'], sector: 'Financial Services', industry: 'NBFC', isFnO: true },
  { name: 'Cipla', symbol: 'CIPLA', nseSymbol: 'CIPLA.NS', aliases: ['cipla'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Coal India', symbol: 'COALINDIA', nseSymbol: 'COALINDIA.NS', aliases: ['coalindia', 'coal india'], sector: 'Basic Materials', industry: 'Coal Mining', isFnO: true },
  { name: 'Coforge', symbol: 'COFORGE', nseSymbol: 'COFORGE.NS', aliases: ['coforge', 'niit tech'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Colgate-Palmolive India', symbol: 'COLPAL', nseSymbol: 'COLPAL.NS', aliases: ['colpal', 'colgate'], sector: 'Consumer Goods', industry: 'Personal Care', isFnO: true },
  { name: 'Container Corporation of India', symbol: 'CONCOR', nseSymbol: 'CONCOR.NS', aliases: ['concor', 'container corporation'], sector: 'Industrials', industry: 'Logistics', isFnO: true },
  { name: 'Crompton Greaves Consumer Electricals', symbol: 'CROMPTON', nseSymbol: 'CROMPTON.NS', aliases: ['crompton', 'crompton greaves'], sector: 'Consumer Discretionary', industry: 'Electrical Appliances', isFnO: true },
  { name: 'Cummins India', symbol: 'CUMMINSIND', nseSymbol: 'CUMMINSIND.NS', aliases: ['cumminsind', 'cummins'], sector: 'Industrials', industry: 'Engines & Generators', isFnO: true },
  { name: 'Dabur India', symbol: 'DABUR', nseSymbol: 'DABUR.NS', aliases: ['dabur', 'dabur india'], sector: 'Consumer Goods', industry: 'Personal Care', isFnO: true },
  { name: 'Dalmia Bharat', symbol: 'DALBHARAT', nseSymbol: 'DALBHARAT.NS', aliases: ['dalbharat', 'dalmia bharat'], sector: 'Basic Materials', industry: 'Cement', isFnO: true },
  { name: 'Delhivery', symbol: 'DELHIVERY', nseSymbol: 'DELHIVERY.NS', aliases: ['delhivery'], sector: 'Industrials', industry: 'Logistics', isFnO: true },
  { name: 'Divi\'s Laboratories', symbol: 'DIVISLAB', nseSymbol: 'DIVISLAB.NS', aliases: ['divislab', 'divis lab', 'divi\'s lab'], sector: 'Healthcare', industry: 'Active Pharma Ingredients', isFnO: true },
  { name: 'Dixon Technologies', symbol: 'DIXON', nseSymbol: 'DIXON.NS', aliases: ['dixon', 'dixon tech'], sector: 'Technology', industry: 'Electronics Manufacturing', isFnO: true },
  { name: 'DLF Limited', symbol: 'DLF', nseSymbol: 'DLF.NS', aliases: ['dlf', 'dlf limited'], sector: 'Real Estate', industry: 'Real Estate Development', isFnO: true },
  { name: 'Avenue Supermarts (DMart)', symbol: 'DMART', nseSymbol: 'DMART.NS', aliases: ['dmart', 'avenue supermarts'], sector: 'Consumer Discretionary', industry: 'Retail', isFnO: true },
  { name: 'Dr. Reddy\'s Laboratories', symbol: 'DRREDDY', nseSymbol: 'DRREDDY.NS', aliases: ['drreddy', 'dr reddy', 'dr reddys', 'dr. reddy', 'dr. reddy\'s', 'dr. reddys'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Eicher Motors', symbol: 'EICHERMOT', nseSymbol: 'EICHERMOT.NS', aliases: ['eichermot', 'eicher motors', 'royal enfield'], sector: 'Automobile', industry: 'Motorcycles', isFnO: true },
  { name: 'Eternal Limited (Zomato)', symbol: 'ETERNAL', nseSymbol: 'ETERNAL.NS', aliases: ['eternal', 'zomato', 'blinkit'], sector: 'Consumer Discretionary', industry: 'Quick Commerce', isFnO: true },
  { name: 'Federal Bank', symbol: 'FEDERALBNK', nseSymbol: 'FEDERALBNK.NS', aliases: ['federalbnk', 'federal bank'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Fortis Healthcare', symbol: 'FORTIS', nseSymbol: 'FORTIS.NS', aliases: ['fortis', 'fortis healthcare'], sector: 'Healthcare', industry: 'Healthcare Facilities', isFnO: true },
  { name: 'GAIL (India)', symbol: 'GAIL', nseSymbol: 'GAIL.NS', aliases: ['gail', 'gail india'], sector: 'Energy', industry: 'Gas Utilities', isFnO: true },
  { name: 'Glenmark Pharmaceuticals', symbol: 'GLENMARK', nseSymbol: 'GLENMARK.NS', aliases: ['glenmark', 'glenmark pharma'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'GMR Airports Infrastructure', symbol: 'GMRAIRPORT', nseSymbol: 'GMRAIRPORT.NS', aliases: ['gmrairport', 'gmr airport', 'gmr infra', 'gmrinfra'], sector: 'Industrials', industry: 'Airports', isFnO: true },
  { name: 'Godfrey Phillips India', symbol: 'GODFRYPHLP', nseSymbol: 'GODFRYPHLP.NS', aliases: ['godfryphlp', 'godfrey phillips'], sector: 'Consumer Goods', industry: 'Tobacco', isFnO: true },
  { name: 'Godrej Consumer Products', symbol: 'GODREJCP', nseSymbol: 'GODREJCP.NS', aliases: ['godrejcp', 'godrej consumer'], sector: 'Consumer Goods', industry: 'Personal Care', isFnO: true },
  { name: 'Godrej Properties', symbol: 'GODREJPROPERTY', nseSymbol: 'GODREJPROPERTY.NS', aliases: ['godrejproperty', 'godrej properties', 'godrejprop'], sector: 'Real Estate', industry: 'Real Estate Development', isFnO: true },
  { name: 'Grasim Industries', symbol: 'GRASIM', nseSymbol: 'GRASIM.NS', aliases: ['grasim', 'grasim industries'], sector: 'Basic Materials', industry: 'Diversified Materials', isFnO: true },
  { name: 'GE Vernova T&D India', symbol: 'GVT&D', nseSymbol: 'GVT&D.NS', aliases: ['gvt&d', 'ge t&d', 'ge vernova'], sector: 'Industrials', industry: 'Electrical Equipment', isFnO: true },
  { name: 'Hindustan Aeronautics', symbol: 'HAL', nseSymbol: 'HAL.NS', aliases: ['hal', 'hindustan aeronautics'], sector: 'Industrials', industry: 'Aerospace & Defense', isFnO: true },
  { name: 'Havells India', symbol: 'HAVELLS', nseSymbol: 'HAVELLS.NS', aliases: ['havells', 'havells india'], sector: 'Consumer Discretionary', industry: 'Electrical Appliances', isFnO: true },
  { name: 'HCL Technologies', symbol: 'HCLTECH', nseSymbol: 'HCLTECH.NS', aliases: ['hcltech', 'hcl tech', 'hcl technologies'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'HDFC Asset Management', symbol: 'HDFCAMC', nseSymbol: 'HDFCAMC.NS', aliases: ['hdfcamc', 'hdfc amc', 'hdfc mutual fund'], sector: 'Financial Services', industry: 'Asset Management', isFnO: true },
  { name: 'HDFC Bank', symbol: 'HDFCBANK', nseSymbol: 'HDFCBANK.NS', aliases: ['hdfcbank', 'hdfc bank', 'hdfc'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'HDFC Life Insurance', symbol: 'HDFCLIFE', nseSymbol: 'HDFCLIFE.NS', aliases: ['hdfclife', 'hdfc life'], sector: 'Financial Services', industry: 'Life Insurance', isFnO: true },
  { name: 'Hero MotoCorp', symbol: 'HEROMOTOCO', nseSymbol: 'HEROMOTOCO.NS', aliases: ['heromotoco', 'hero motocorp', 'hero'], sector: 'Automobile', industry: 'Two Wheelers', isFnO: true },
  { name: 'Hindalco Industries', symbol: 'HINDALCO', nseSymbol: 'HINDALCO.NS', aliases: ['hindalco', 'hindalco industries', 'novelis'], sector: 'Basic Materials', industry: 'Aluminium', isFnO: true },
  { name: 'Hindustan Petroleum', symbol: 'HINDPETRO', nseSymbol: 'HINDPETRO.NS', aliases: ['hindpetro', 'hpcl', 'hindustan petroleum'], sector: 'Energy', industry: 'Oil Refining', isFnO: true },
  { name: 'Hindustan Unilever', symbol: 'HINDUNILVR', nseSymbol: 'HINDUNILVR.NS', aliases: ['hindunilvr', 'hul', 'hindustan unilever'], sector: 'Consumer Goods', industry: 'FMCG', isFnO: true },
  { name: 'Hindustan Zinc', symbol: 'HINDZINC', nseSymbol: 'HINDZINC.NS', aliases: ['hindzinc', 'hindustan zinc'], sector: 'Basic Materials', industry: 'Zinc Mining', isFnO: true },
  { name: 'Housing & Urban Development Corp', symbol: 'HUDCO', nseSymbol: 'HUDCO.NS', aliases: ['hudco'], sector: 'Financial Services', industry: 'Housing Finance', isFnO: true },
  { name: 'Hyundai Motor India', symbol: 'HYUNDAI', nseSymbol: 'HYUNDAI.NS', aliases: ['hyundai', 'hyundai motor india'], sector: 'Automobile', industry: 'Passenger Vehicles', isFnO: true },
  { name: 'ICICI Bank', symbol: 'ICICIBANK', nseSymbol: 'ICICIBANK.NS', aliases: ['icicibank', 'icici bank', 'icici'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'ICICI Lombard General Insurance', symbol: 'ICICIGI', nseSymbol: 'ICICIGI.NS', aliases: ['icicigi', 'icici lombard'], sector: 'Financial Services', industry: 'General Insurance', isFnO: true },
  { name: 'ICICI Prudential Life Insurance', symbol: 'ICICIPRULI', nseSymbol: 'ICICIPRULI.NS', aliases: ['icicipruli', 'icici pru', 'icici prudential'], sector: 'Financial Services', industry: 'Life Insurance', isFnO: true },
  { name: 'Vodafone Idea', symbol: 'IDEA', nseSymbol: 'IDEA.NS', aliases: ['idea', 'vodafone idea', 'vodafone'], sector: 'Telecommunications', industry: 'Telecom Services', isFnO: true },
  { name: 'IDFC First Bank', symbol: 'IDFCFIRSTB', nseSymbol: 'IDFCFIRSTB.NS', aliases: ['idfcfirstb', 'idfc first bank', 'idfc first'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Indian Energy Exchange', symbol: 'IEX', nseSymbol: 'IEX.NS', aliases: ['iex', 'indian energy exchange'], sector: 'Financial Services', industry: 'Energy Exchange', isFnO: true },
  { name: 'Indian Hotels Company', symbol: 'INDHOTEL', nseSymbol: 'INDHOTEL.NS', aliases: ['indhotel', 'indian hotels', 'taj hotels'], sector: 'Consumer Discretionary', industry: 'Hotels', isFnO: true },
  { name: 'Indian Bank', symbol: 'INDIANBANK', nseSymbol: 'INDIANBANK.NS', aliases: ['indianbank', 'indian bank'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'InterGlobe Aviation (IndiGo)', symbol: 'INDIGO', nseSymbol: 'INDIGO.NS', aliases: ['indigo', 'interglobe aviation'], sector: 'Industrials', industry: 'Airlines', isFnO: true },
  { name: 'IndusInd Bank', symbol: 'INDUSINDBK', nseSymbol: 'INDUSINDBK.NS', aliases: ['indusindbk', 'indusind bank', 'indusind'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Indus Towers', symbol: 'INDUSTOWER', nseSymbol: 'INDUSTOWER.NS', aliases: ['industower', 'indus towers'], sector: 'Telecommunications', industry: 'Telecom Towers', isFnO: true },
  { name: 'Infosys', symbol: 'INFY', nseSymbol: 'INFY.NS', aliases: ['infy', 'infosys'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Inox Wind', symbol: 'INOXWIND', nseSymbol: 'INOXWIND.NS', aliases: ['inoxwind', 'inox wind'], sector: 'Industrials', industry: 'Wind Energy', isFnO: true },
  { name: 'Indian Oil Corporation', symbol: 'IOC', nseSymbol: 'IOC.NS', aliases: ['ioc', 'indian oil'], sector: 'Energy', industry: 'Oil Refining', isFnO: true },
  { name: 'IRCTC', symbol: 'IRCTC', nseSymbol: 'IRCTC.NS', aliases: ['irctc', 'indian railway catering'], sector: 'Consumer Discretionary', industry: 'Railways & Ticketing', isFnO: true },
  { name: 'Indian Renewable Energy Dev', symbol: 'IREDA', nseSymbol: 'IREDA.NS', aliases: ['ireda'], sector: 'Financial Services', industry: 'Renewable Finance', isFnO: true },
  { name: 'Indian Railway Finance Corp', symbol: 'IRFC', nseSymbol: 'IRFC.NS', aliases: ['irfc'], sector: 'Financial Services', industry: 'Railway Finance', isFnO: true },
  { name: 'ITC Limited', symbol: 'ITC', nseSymbol: 'ITC.NS', aliases: ['itc', 'itc limited'], sector: 'Consumer Goods', industry: 'Diversified FMCG', isFnO: true },
  { name: 'Jindal Steel & Power', symbol: 'JINDALSTEL', nseSymbol: 'JINDALSTEL.NS', aliases: ['jindalstel', 'jindal steel', 'jspl'], sector: 'Basic Materials', industry: 'Steel', isFnO: true },
  { name: 'Jio Financial Services', symbol: 'JIOFIN', nseSymbol: 'JIOFIN.NS', aliases: ['jiofin', 'jio financial'], sector: 'Financial Services', industry: 'Fintech', isFnO: true },
  { name: 'JSW Energy', symbol: 'JSWENERGY', nseSymbol: 'JSWENERGY.NS', aliases: ['jswenergy', 'jsw energy'], sector: 'Utilities', industry: 'Power Generation', isFnO: true },
  { name: 'JSW Steel', symbol: 'JSWSTEEL', nseSymbol: 'JSWSTEEL.NS', aliases: ['jswsteel', 'jsw steel'], sector: 'Basic Materials', industry: 'Steel', isFnO: true },
  { name: 'Jubilant FoodWorks', symbol: 'JUBLFOOD', nseSymbol: 'JUBLFOOD.NS', aliases: ['jublfood', 'jubilant foodworks', 'dominos india'], sector: 'Consumer Discretionary', industry: 'Restaurants', isFnO: true },
  { name: 'Kalyan Jewellers India', symbol: 'KALYANKJIL', nseSymbol: 'KALYANKJIL.NS', aliases: ['kalyankjil', 'kalyan jewellers'], sector: 'Consumer Discretionary', industry: 'Jewellery', isFnO: true },
  { name: 'Kaynes Technology India', symbol: 'KAYNES', nseSymbol: 'KAYNES.NS', aliases: ['kaynes', 'kaynes tech'], sector: 'Technology', industry: 'Electronics Manufacturing', isFnO: true },
  { name: 'KEI Industries', symbol: 'KEI', nseSymbol: 'KEI.NS', aliases: ['kei', 'kei industries'], sector: 'Industrials', industry: 'Wires & Cables', isFnO: true },
  { name: 'KFin Technologies', symbol: 'KFINTECH', nseSymbol: 'KFINTECH.NS', aliases: ['kfintech', 'kfin tech'], sector: 'Financial Services', industry: 'Financial Tech', isFnO: true },
  { name: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK', nseSymbol: 'KOTAKBANK.NS', aliases: ['kotakbank', 'kotak bank', 'kotak'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'KPIT Technologies', symbol: 'KPITTECH', nseSymbol: 'KPITTECH.NS', aliases: ['kpittech', 'kpit tech', 'kpit'], sector: 'Technology', industry: 'Automotive Software', isFnO: true },
  { name: 'Laurus Labs', symbol: 'LAURUSLABS', nseSymbol: 'LAURUSLABS.NS', aliases: ['lauruslabs', 'laurus labs'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'LIC Housing Finance', symbol: 'LICHSGFIN', nseSymbol: 'LICHSGFIN.NS', aliases: ['lichsgfin', 'lic housing finance'], sector: 'Financial Services', industry: 'Housing Finance', isFnO: true },
  { name: 'Life Insurance Corp of India', symbol: 'LICI', nseSymbol: 'LICI.NS', aliases: ['lici', 'lic india', 'lic'], sector: 'Financial Services', industry: 'Life Insurance', isFnO: true },
  { name: 'Macrotech Developers (Lodha)', symbol: 'LODHA', nseSymbol: 'LODHA.NS', aliases: ['lodha', 'macrotech'], sector: 'Real Estate', industry: 'Real Estate Development', isFnO: true },
  { name: 'Larsen & Toubro', symbol: 'LT', nseSymbol: 'LT.NS', aliases: ['lt', 'larsen & toubro', 'l&t', 'larsen and toubro'], sector: 'Industrials', industry: 'Engineering', isFnO: true },
  { name: 'L&T Finance', symbol: 'LTF', nseSymbol: 'LTF.NS', aliases: ['ltf', 'l&t finance', 'lt finance'], sector: 'Financial Services', industry: 'NBFC', isFnO: true },
  { name: 'LTIMindtree', symbol: 'LTIM', nseSymbol: 'LTIM.NS', aliases: ['ltim', 'ltimindtree', 'mindtree'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Lupin Limited', symbol: 'LUPIN', nseSymbol: 'LUPIN.NS', aliases: ['lupin'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Mahindra & Mahindra', symbol: 'M&M', nseSymbol: 'M_M.NS', aliases: ['m&m', 'mahindra & mahindra', 'mahindra'], sector: 'Automobile', industry: 'Automobiles', isFnO: true },
  { name: 'Manappuram Finance', symbol: 'MANAPPURAM', nseSymbol: 'MANAPPURAM.NS', aliases: ['manappuram', 'manappuram finance'], sector: 'Financial Services', industry: 'Gold Finance', isFnO: true },
  { name: 'Mankind Pharma', symbol: 'MANKIND', nseSymbol: 'MANKIND.NS', aliases: ['mankind', 'mankind pharma'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Marico Limited', symbol: 'MARICO', nseSymbol: 'MARICO.NS', aliases: ['marico'], sector: 'Consumer Goods', industry: 'Personal Care', isFnO: true },
  { name: 'Maruti Suzuki India', symbol: 'MARUTI', nseSymbol: 'MARUTI.NS', aliases: ['maruti', 'maruti suzuki'], sector: 'Automobile', industry: 'Passenger Vehicles', isFnO: true },
  { name: 'Max Healthcare Institute', symbol: 'MAXHEALTH', nseSymbol: 'MAXHEALTH.NS', aliases: ['maxhealth', 'max healthcare'], sector: 'Healthcare', industry: 'Healthcare Facilities', isFnO: true },
  { name: 'Mazagon Dock Shipbuilders', symbol: 'MAZDOCK', nseSymbol: 'MAZDOCK.NS', aliases: ['mazdock', 'mazagon dock'], sector: 'Industrials', industry: 'Shipbuilding', isFnO: true },
  { name: 'Multi Commodity Exchange', symbol: 'MCX', nseSymbol: 'MCX.NS', aliases: ['mcx', 'multi commodity exchange'], sector: 'Financial Services', industry: 'Financial Exchange', isFnO: true },
  { name: 'Max Financial Services', symbol: 'MFSL', nseSymbol: 'MFSL.NS', aliases: ['mfsl', 'max financial'], sector: 'Financial Services', industry: 'Life Insurance', isFnO: true },
  { name: 'Samvardhana Motherson', symbol: 'MOTHERSON', nseSymbol: 'MOTHERSON.NS', aliases: ['motherson', 'motherson sumi'], sector: 'Automobile', industry: 'Auto Components', isFnO: true },
  { name: 'Motilal Oswal Financial Services', symbol: 'MOTILALOFS', nseSymbol: 'MOTILALOFS.NS', aliases: ['motilalofs', 'motilal oswal'], sector: 'Financial Services', industry: 'Financial Tech', isFnO: true },
  { name: 'Mphasis', symbol: 'MPHASIS', nseSymbol: 'MPHASIS.NS', aliases: ['mphasis'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Muthoot Finance', symbol: 'MUTHOOTFIN', nseSymbol: 'MUTHOOTFIN.NS', aliases: ['muthootfin', 'muthoot finance'], sector: 'Financial Services', industry: 'Gold Finance', isFnO: true },
  { name: 'Nippon Life India Asset Mgmt', symbol: 'NAM-INDIA', nseSymbol: 'NAM-INDIA.NS', aliases: ['nam-india', 'nippon life india', 'nam india'], sector: 'Financial Services', industry: 'Asset Management', isFnO: true },
  { name: 'National Aluminium Company', symbol: 'NATIONALUM', nseSymbol: 'NATIONALUM.NS', aliases: ['nationalum', 'nalco', 'national aluminium'], sector: 'Basic Materials', industry: 'Aluminium', isFnO: true },
  { name: 'Info Edge (Naukri)', symbol: 'NAUKRI', nseSymbol: 'NAUKRI.NS', aliases: ['naukri', 'info edge'], sector: 'Technology', industry: 'Internet Classifics', isFnO: true },
  { name: 'NBCC (India)', symbol: 'NBCC', nseSymbol: 'NBCC.NS', aliases: ['nbcc'], sector: 'Industrials', industry: 'Construction', isFnO: true },
  { name: 'Nestlé India', symbol: 'NESTLEIND', nseSymbol: 'NESTLEIND.NS', aliases: ['nestleind', 'nestle india', 'nestle', 'nestlé'], sector: 'Consumer Goods', industry: 'Packaged Foods', isFnO: true },
  { name: 'NHPC Limited', symbol: 'NHPC', nseSymbol: 'NHPC.NS', aliases: ['nhpc'], sector: 'Utilities', industry: 'Hydroelectric Power', isFnO: true },
  { name: 'NMDC Limited', symbol: 'NMDC', nseSymbol: 'NMDC.NS', aliases: ['nmdc'], sector: 'Basic Materials', industry: 'Iron Ore Mining', isFnO: true },
  { name: 'NTPC Limited', symbol: 'NTPC', nseSymbol: 'NTPC.NS', aliases: ['ntpc'], sector: 'Utilities', industry: 'Power Generation', isFnO: true },
  { name: 'Oberoi Realty', symbol: 'OBEROIRLTY', nseSymbol: 'OBEROIRLTY.NS', aliases: ['oberoirlty', 'oberoi realty'], sector: 'Real Estate', industry: 'Real Estate Development', isFnO: true },
  { name: 'Oracle Financial Services Software', symbol: 'OFSS', nseSymbol: 'OFSS.NS', aliases: ['ofss', 'oracle financial'], sector: 'Technology', industry: 'IT Software', isFnO: true },
  { name: 'Oil India', symbol: 'OIL', nseSymbol: 'OIL.NS', aliases: ['oil', 'oil india'], sector: 'Energy', industry: 'Oil Exploration', isFnO: true },
  { name: 'Oil & Natural Gas Corp', symbol: 'ONGC', nseSymbol: 'ONGC.NS', aliases: ['ongc', 'oil and natural gas'], sector: 'Energy', industry: 'Oil Exploration', isFnO: true },
  { name: 'Page Industries', symbol: 'PAGEIND', nseSymbol: 'PAGEIND.NS', aliases: ['pageind', 'jockey india'], sector: 'Consumer Discretionary', industry: 'Apparel', isFnO: true },
  { name: 'Patanjali Foods', symbol: 'PATANJALI', nseSymbol: 'PATANJALI.NS', aliases: ['patanjali', 'ruchi soya'], sector: 'Consumer Goods', industry: 'FMCG', isFnO: true },
  { name: 'One97 Communications (Paytm)', symbol: 'PAYTM', nseSymbol: 'PAYTM.NS', aliases: ['paytm', 'one97'], sector: 'Financial Services', industry: 'Fintech', isFnO: true },
  { name: 'Persistent Systems', symbol: 'PERSISTENT', nseSymbol: 'PERSISTENT.NS', aliases: ['persistent', 'persistent systems'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Petronet LNG', symbol: 'PETRONET', nseSymbol: 'PETRONET.NS', aliases: ['petronet', 'petronet lng'], sector: 'Energy', industry: 'Gas Distribution', isFnO: true },
  { name: 'The Phoenix Mills', symbol: 'PHOENIXLTD', nseSymbol: 'PHOENIXLTD.NS', aliases: ['phoenixltd', 'phoenix mills'], sector: 'Real Estate', industry: 'Retail Malls', isFnO: true },
  { name: 'Pidilite Industries', symbol: 'PIDILITIND', nseSymbol: 'PIDILITIND.NS', aliases: ['pidilitind', 'pidilite', 'fevicol'], sector: 'Basic Materials', industry: 'Adhesives', isFnO: true },
  { name: 'PI Industries', symbol: 'PIIND', nseSymbol: 'PIIND.NS', aliases: ['piind', 'pi industries'], sector: 'Basic Materials', industry: 'Agrochemicals', isFnO: true },
  { name: 'Punjab National Bank', symbol: 'PNB', nseSymbol: 'PNB.NS', aliases: ['pnb', 'punjab national bank'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'PNB Housing Finance', symbol: 'PNBHOUSING', nseSymbol: 'PNBHOUSING.NS', aliases: ['pnbhousing', 'pnb housing'], sector: 'Financial Services', industry: 'Housing Finance', isFnO: true },
  { name: 'PB Fintech (Policybazaar)', symbol: 'POLICYBZR', nseSymbol: 'POLICYBZR.NS', aliases: ['policybzr', 'policybazaar'], sector: 'Financial Services', industry: 'Fintech', isFnO: true },
  { name: 'Polycab India', symbol: 'POLYCAB', nseSymbol: 'POLYCAB.NS', aliases: ['polycab'], sector: 'Industrials', industry: 'Wires & Cables', isFnO: true },
  { name: 'Power Grid Corp of India', symbol: 'POWERGRID', nseSymbol: 'POWERGRID.NS', aliases: ['powergrid', 'power grid'], sector: 'Utilities', industry: 'Power Transmission', isFnO: true },
  { name: 'Hitachi Energy India', symbol: 'POWERINDIA', nseSymbol: 'POWERINDIA.NS', aliases: ['powerindia', 'hitachi energy'], sector: 'Industrials', industry: 'Electrical Equipment', isFnO: true },
  { name: 'Premier Energies', symbol: 'PREMIERENE', nseSymbol: 'PREMIERENE.NS', aliases: ['premierene', 'premier energies'], sector: 'Utilities', industry: 'Solar Energy', isFnO: true },
  { name: 'Prestige Estates Projects', symbol: 'PRESTIGE', nseSymbol: 'PRESTIGE.NS', aliases: ['prestige', 'prestige estates'], sector: 'Real Estate', industry: 'Real Estate Development', isFnO: true },
  { name: 'Radico Khaitan', symbol: 'RADICO', nseSymbol: 'RADICO.NS', aliases: ['radico', 'radico khaitan'], sector: 'Consumer Goods', industry: 'Beverages', isFnO: true },
  { name: 'RBL Bank', symbol: 'RBLBANK', nseSymbol: 'RBLBANK.NS', aliases: ['rblbank', 'rbl bank'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'REC Limited', symbol: 'RECLTD', nseSymbol: 'RECLTD.NS', aliases: ['recltd', 'rec limited', 'rec'], sector: 'Financial Services', industry: 'Power NBFC', isFnO: true },
  { name: 'Reliance Industries', symbol: 'RELIANCE', nseSymbol: 'RELIANCE.NS', aliases: ['reliance', 'ril', 'jio'], sector: 'Energy', industry: 'Integrated Oil & Gas', isFnO: true },
  { name: 'Rail Vikas Nigam', symbol: 'RVNL', nseSymbol: 'RVNL.NS', aliases: ['rvnl', 'rail vikas nigam'], sector: 'Industrials', industry: 'Railways Infrastructure', isFnO: true },
  { name: 'Steel Authority of India', symbol: 'SAIL', nseSymbol: 'SAIL.NS', aliases: ['sail', 'steel authority'], sector: 'Basic Materials', industry: 'Steel', isFnO: true },
  { name: 'SBI Cards & Payment Services', symbol: 'SBICARD', nseSymbol: 'SBICARD.NS', aliases: ['sbicard', 'sbi card'], sector: 'Financial Services', industry: 'Credit Cards', isFnO: true },
  { name: 'SBI Life Insurance', symbol: 'SBILIFE', nseSymbol: 'SBILIFE.NS', aliases: ['sbilife', 'sbi life'], sector: 'Financial Services', industry: 'Life Insurance', isFnO: true },
  { name: 'State Bank of India', symbol: 'SBIN', nseSymbol: 'SBIN.NS', aliases: ['sbin', 'sbi', 'state bank of india'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'Shree Cement', symbol: 'SHREECEM', nseSymbol: 'SHREECEM.NS', aliases: ['shreecem', 'shree cement'], sector: 'Basic Materials', industry: 'Cement', isFnO: true },
  { name: 'Shriram Finance', symbol: 'SHRIRAMFIN', nseSymbol: 'SHRIRAMFIN.NS', aliases: ['shriramfin', 'shriram finance'], sector: 'Financial Services', industry: 'NBFC', isFnO: true },
  { name: 'Siemens India', symbol: 'SIEMENS', nseSymbol: 'SIEMENS.NS', aliases: ['siemens'], sector: 'Industrials', industry: 'Capital Goods', isFnO: true },
  { name: 'Solar Industries India', symbol: 'SOLARINDS', nseSymbol: 'SOLARINDS.NS', aliases: ['solarinds', 'solar industries'], sector: 'Basic Materials', industry: 'Explosives', isFnO: true },
  { name: 'Sona BLW Precision Forgings', symbol: 'SONACOMS', nseSymbol: 'SONACOMS.NS', aliases: ['sonacoms', 'sona coms', 'sona blw'], sector: 'Automobile', industry: 'Auto Components', isFnO: true },
  { name: 'SRF Limited', symbol: 'SRF', nseSymbol: 'SRF.NS', aliases: ['srf'], sector: 'Basic Materials', industry: 'Chemicals', isFnO: true },
  { name: 'Sun Pharmaceutical', symbol: 'SUNPHARMA', nseSymbol: 'SUNPHARMA.NS', aliases: ['sunpharma', 'sun pharma', 'sun pharmaceutical'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Supreme Industries', symbol: 'SUPREMEIND', nseSymbol: 'SUPREMEIND.NS', aliases: ['supremeind', 'supreme industries'], sector: 'Industrials', industry: 'Plastics', isFnO: true },
  { name: 'Suzlon Energy', symbol: 'SUZLON', nseSymbol: 'SUZLON.NS', aliases: ['suzlon', 'suzlon energy'], sector: 'Industrials', industry: 'Wind Energy', isFnO: true },
  { name: 'Swiggy Limited', symbol: 'SWIGGY', nseSymbol: 'SWIGGY.NS', aliases: ['swiggy'], sector: 'Consumer Discretionary', industry: 'Quick Commerce', isFnO: true },
  { name: 'Tata Consumer Products', symbol: 'TATACONSUM', nseSymbol: 'TATACONSUM.NS', aliases: ['tataconsum', 'tata consumer'], sector: 'Consumer Goods', industry: 'FMCG', isFnO: true },
  { name: 'Tata Elxsi', symbol: 'TATAELXSI', nseSymbol: 'TATAELXSI.NS', aliases: ['tataelxsi', 'tata elxsi'], sector: 'Technology', industry: 'ER&D', isFnO: true },
  { name: 'Tata Motors', symbol: 'TATAMOTORS', nseSymbol: 'TATAMOTORS.NS', aliases: ['tatamotors', 'tata motors', 'tatamtrdvr', 'tata motors dvr', 'tmpv', 'tmcv', 'tata motors passenger vehicles'], sector: 'Automobile', industry: 'Passenger & Commercial Vehicles', isFnO: true },
  { name: 'Tata Power', symbol: 'TATAPOWER', nseSymbol: 'TATAPOWER.NS', aliases: ['tatapower', 'tata power'], sector: 'Utilities', industry: 'Integrated Power', isFnO: true },
  { name: 'Tata Steel', symbol: 'TATASTEEL', nseSymbol: 'TATASTEEL.NS', aliases: ['tatasteel', 'tata steel'], sector: 'Basic Materials', industry: 'Steel', isFnO: true },
  { name: 'Tata Consultancy Services', symbol: 'TCS', nseSymbol: 'TCS.NS', aliases: ['tcs', 'tata consultancy'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Tech Mahindra', symbol: 'TECHM', nseSymbol: 'TECHM.NS', aliases: ['techm', 'tech mahindra'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Tube Investments of India', symbol: 'TIINDIA', nseSymbol: 'TIINDIA.NS', aliases: ['tiindia', 'tube investments'], sector: 'Industrials', industry: 'Auto Ancillaries', isFnO: true },
  { name: 'Titan Company', symbol: 'TITAN', nseSymbol: 'TITAN.NS', aliases: ['titan', 'tanishq'], sector: 'Consumer Discretionary', industry: 'Jewellery', isFnO: true },
  { name: 'Torrent Pharmaceuticals', symbol: 'TORNTPHARM', nseSymbol: 'TORNTPHARM.NS', aliases: ['torntpharm', 'torrent pharma'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true },
  { name: 'Trent Limited', symbol: 'TRENT', nseSymbol: 'TRENT.NS', aliases: ['trent', 'zudio', 'westside'], sector: 'Consumer Discretionary', industry: 'Apparel Retail', isFnO: true },
  { name: 'TVS Motor Company', symbol: 'TVSMOTOR', nseSymbol: 'TVSMOTOR.NS', aliases: ['tvsmotor', 'tvs motor', 'tvs'], sector: 'Automobile', industry: 'Two Wheelers', isFnO: true },
  { name: 'UltraTech Cement', symbol: 'ULTRACEMCO', nseSymbol: 'ULTRACEMCO.NS', aliases: ['ultracemco', 'ultratech cement', 'ultratech'], sector: 'Basic Materials', industry: 'Cement', isFnO: true },
  { name: 'Union Bank of India', symbol: 'UNIONBANK', nseSymbol: 'UNIONBANK.NS', aliases: ['unionbank', 'union bank'], sector: 'Financial Services', industry: 'Public Bank', isFnO: true },
  { name: 'United Spirits (McDowell)', symbol: 'UNITDSPR', nseSymbol: 'UNITDSPR.NS', aliases: ['unitdspr', 'united spirits', 'mcdowell'], sector: 'Consumer Goods', industry: 'Beverages', isFnO: true },
  { name: 'Uno Minda', symbol: 'UNOMINDA', nseSymbol: 'UNOMINDA.NS', aliases: ['unominda', 'minda industries'], sector: 'Automobile', industry: 'Auto Components', isFnO: true },
  { name: 'UPL Limited', symbol: 'UPL', nseSymbol: 'UPL.NS', aliases: ['upl', 'united phosphorus'], sector: 'Basic Materials', industry: 'Agrochemicals', isFnO: true },
  { name: 'Varun Beverages', symbol: 'VBL', nseSymbol: 'VBL.NS', aliases: ['vbl', 'varun beverages'], sector: 'Consumer Goods', industry: 'Beverages', isFnO: true },
  { name: 'Vedanta Limited', symbol: 'VEDL', nseSymbol: 'VEDL.NS', aliases: ['vedl', 'vedanta'], sector: 'Basic Materials', industry: 'Metals & Mining', isFnO: true },
  { name: 'Voltas Limited', symbol: 'VOLTAS', nseSymbol: 'VOLTAS.NS', aliases: ['voltas'], sector: 'Consumer Discretionary', industry: 'Air Conditioners', isFnO: true },
  { name: 'Waaree Energies', symbol: 'WAAREEENER', nseSymbol: 'WAAREEENER.NS', aliases: ['waareeener', 'waaree energies', 'waaree'], sector: 'Utilities', industry: 'Solar Energy', isFnO: true },
  { name: 'Wipro Limited', symbol: 'WIPRO', nseSymbol: 'WIPRO.NS', aliases: ['wipro'], sector: 'Technology', industry: 'IT Services', isFnO: true },
  { name: 'Yes Bank', symbol: 'YESBANK', nseSymbol: 'YESBANK.NS', aliases: ['yesbank', 'yes bank'], sector: 'Financial Services', industry: 'Private Bank', isFnO: true },
  { name: 'Zydus Lifesciences', symbol: 'ZYDUSLIFE', nseSymbol: 'ZYDUSLIFE.NS', aliases: ['zyduslife', 'zydus life', 'cadila'], sector: 'Healthcare', industry: 'Pharmaceuticals', isFnO: true }
];

export class FNORegistryService {
  private static instance: FNORegistryService;
  private companiesMap: Map<string, FNOCompany> = new Map();
  private aliasIndex: Map<string, FNOCompany> = new Map();
  private canonicalSymbolSet: Set<string> = new Set();

  private constructor() {
    this.buildIndexes();
  }

  public static getInstance(): FNORegistryService {
    if (!FNORegistryService.instance) {
      FNORegistryService.instance = new FNORegistryService();
    }
    return FNORegistryService.instance;
  }

  private buildIndexes() {
    this.companiesMap.clear();
    this.aliasIndex.clear();
    this.canonicalSymbolSet = new Set(CANONICAL_FNO_204_SYMBOLS.map(s => s.toUpperCase()));

    for (const comp of FNO_COMPANIES_REGISTRY) {
      const symUpper = comp.symbol.toUpperCase();
      this.companiesMap.set(symUpper, comp);

      // Index symbol and aliases
      this.aliasIndex.set(comp.symbol.toLowerCase(), comp);
      this.aliasIndex.set(comp.name.toLowerCase(), comp);

      for (const alias of comp.aliases) {
        this.aliasIndex.set(alias.toLowerCase(), comp);
      }
    }
  }

  public getAllCompanies(): FNOCompany[] {
    return Array.from(this.companiesMap.values());
  }

  public isFNOCompany(symbol: string): boolean {
    if (!symbol) return false;
    return this.canonicalSymbolSet.has(symbol.trim().toUpperCase());
  }

  public getBySymbol(symbol: string): FNOCompany | undefined {
    if (!symbol) return undefined;
    return this.companiesMap.get(symbol.toUpperCase().trim());
  }

  public findByAlias(term: string): FNOCompany | undefined {
    if (!term) return undefined;
    return this.aliasIndex.get(term.toLowerCase().trim());
  }

  public getCanonicalSymbols(): readonly string[] {
    return CANONICAL_FNO_204_SYMBOLS;
  }
}
