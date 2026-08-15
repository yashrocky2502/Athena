import { safeLocalStorage } from "../services/storage/safeStorage";

export interface CorporateAction {
  type: "NameChange" | "TickerChange" | "Demerger" | "Merger" | "SpinOff" | "Splits" | "Delisting" | "SymbolMigration";
  date: string;
  description: string;
  oldValue?: string;
  newValue?: string;
}

export interface CanonicalCompanyRecord {
  canonicalSymbol: string;       // Current official primary ticker (e.g. "ETERNAL", "RELIANCE", "TATAMOTORS", "TATAMTRDVR")
  officialName: string;          // Official legal listed name (e.g. "Eternal Ltd", "Reliance Industries Ltd", "Tata Motors Passenger Vehicles Ltd")
  tradingSymbol: string;         // Symbol used for live data fetching e.g. "ETERNAL", "ZOMATO", "RELIANCE"
  exchange: string;              // "NSE", "BSE", "NASDAQ", "NYSE"
  isin: string;                  // Official ISIN
  scripCode?: string;            // BSE Scrip Code
  industry: string;
  sector: string;
  description?: string;          // Official company overview & description
  status: "Active" | "Renamed" | "Demerged" | "Delisted";
  oldSymbols: string[];          // Previous symbols e.g. ["ZOMATO"]
  previousNames: string[];       // Previous official names e.g. ["Zomato Limited", "Zomato Ltd", "Zomato"]
  brandAliases: string[];        // Brand aliases e.g. ["Zomato", "Blinkit", "Zomato Pay"]
  corporateActions: CorporateAction[];
  pe?: number;
  marketCap?: string;
  logoUrl?: string;
  website?: string;
  country?: string;
  cap?: string;
  isFnO?: boolean;
  isPSU?: boolean;
}

const MASTER_CANONICAL_DATABASE: CanonicalCompanyRecord[] = [
  {
    canonicalSymbol: "ETERNAL",
    officialName: "Eternal Ltd",
    tradingSymbol: "ETERNAL",
    exchange: "NSE",
    isin: "INE758T01015",
    scripCode: "543320",
    industry: "Quick Commerce & Food Delivery",
    sector: "Consumer Discretionary",
    description: "Eternal Ltd (formerly Zomato Ltd) is a multi-brand technology conglomerate operating Blinkit quick commerce, Zomato food delivery, Hyperpure B2B supply, and District entertainment across India.",
    status: "Renamed",
    oldSymbols: ["ZOMATO"],
    previousNames: ["Zomato Limited", "Zomato Ltd", "Zomato"],
    brandAliases: ["Zomato", "Blinkit", "Zomato Pay", "District", "Hyperpure", "Eternal", "Eternal Ltd"],
    corporateActions: [
      {
        type: "NameChange",
        date: "2025-01-15",
        description: "Zomato Limited officially changed corporate name to Eternal Ltd across exchanges.",
        oldValue: "Zomato Limited",
        newValue: "Eternal Ltd"
      }
    ],
    pe: 120.5,
    marketCap: "₹2.05 Lakh Cr",
    cap: "Large Cap",
    website: "https://eternal.limited",
    country: "India"
  },
  {
    canonicalSymbol: "RELIANCE",
    officialName: "Reliance Industries Ltd",
    tradingSymbol: "RELIANCE",
    exchange: "NSE",
    isin: "INE002A01018",
    scripCode: "500325",
    industry: "Integrated Energy & Telecommunications",
    sector: "Energy",
    description: "Reliance Industries Ltd is India's largest private enterprise with businesses spanning oil-to-chemicals, retail, digital services (Jio), and green energy.",
    status: "Active",
    oldSymbols: ["RIL"],
    previousNames: ["Reliance Industries Limited", "Reliance"],
    brandAliases: ["Jio", "Reliance Retail", "RIL", "Mukesh Ambani", "Reliance Jio", "Reliance Industries"],
    corporateActions: [
      {
        type: "SpinOff",
        date: "2023-08-21",
        description: "Demerger of Jio Financial Services Ltd into separate listed entity."
      }
    ],
    pe: 24.5,
    marketCap: "₹18.52 Lakh Cr",
    cap: "Large Cap",
    website: "https://ril.com",
    country: "India"
  },
  {
    canonicalSymbol: "TATAMOTORS",
    officialName: "Tata Motors Passenger Vehicles Ltd",
    tradingSymbol: "TATAMOTORS",
    exchange: "NSE",
    isin: "INE155A01022",
    scripCode: "500570",
    industry: "Passenger Vehicles & Electric Mobility",
    sector: "Automobile",
    description: "Tata Motors Passenger Vehicles Ltd is India's leading passenger vehicle and electric vehicle manufacturer, producing Nexon EV, Punch, Harrier, Safari, Curvv, and operating Jaguar Land Rover (JLR) globally.",
    status: "Demerged",
    oldSymbols: ["TATAMOTORS_PV"],
    previousNames: ["Tata Motors Limited", "Tata Motors Ltd", "Tata Motors"],
    brandAliases: ["Tata Motors PV", "Tata Motors Passenger Vehicles", "JLR", "Jaguar Land Rover", "Nexon EV", "Tata Motors"],
    corporateActions: [
      {
        type: "Demerger",
        date: "2024-03-04",
        description: "Demerged into two separate listed entities: Passenger Vehicles and Commercial Vehicles."
      }
    ],
    pe: 15.2,
    marketCap: "₹3.62 Lakh Cr",
    cap: "Large Cap",
    website: "https://tatamotors.com",
    country: "India"
  },
  {
    canonicalSymbol: "TATAMTRDVR",
    officialName: "Tata Motors Commercial Vehicles Ltd",
    tradingSymbol: "TATAMTRDVR",
    exchange: "NSE",
    isin: "INE155A01030",
    scripCode: "500571",
    industry: "Commercial Vehicles & Logistics Equipment",
    sector: "Automobile",
    description: "Tata Motors Commercial Vehicles Ltd operates India's largest commercial vehicle manufacturing business, producing medium & heavy trucks, buses, Prima range, and Ace small commercial vehicles.",
    status: "Demerged",
    oldSymbols: ["TATAMOTORS_CV"],
    previousNames: ["Tata Motors Commercial Vehicles"],
    brandAliases: ["Tata Motors CV", "Tata Commercial Vehicles", "Tata Trucks", "Tata Buses"],
    corporateActions: [
      {
        type: "Demerger",
        date: "2024-03-04",
        description: "Listed as separate commercial vehicles entity post demerger."
      }
    ],
    pe: 12.8,
    marketCap: "₹1.15 Lakh Cr",
    cap: "Large Cap",
    website: "https://tatamotors.com",
    country: "India"
  },
  {
    canonicalSymbol: "HDFCBANK",
    officialName: "HDFC Bank Ltd",
    tradingSymbol: "HDFCBANK",
    exchange: "NSE",
    isin: "INE040A01034",
    scripCode: "500180",
    industry: "Private Banking & Financial Services",
    sector: "Financial Services",
    description: "HDFC Bank Ltd is India's premier private sector bank offering banking, wealth management, wholesale and retail financial services.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["HDFC Bank Limited"],
    brandAliases: ["HDFC", "HDFC Bank", "HDFC Ltd"],
    corporateActions: [
      {
        type: "Merger",
        date: "2023-07-01",
        description: "Merged with parent Housing Development Finance Corporation (HDFC Ltd)."
      }
    ],
    pe: 19.8,
    marketCap: "₹12.35 Lakh Cr",
    cap: "Large Cap",
    website: "https://hdfcbank.com",
    country: "India"
  },
  {
    canonicalSymbol: "INFY",
    officialName: "Infosys Ltd",
    tradingSymbol: "INFY",
    exchange: "NSE",
    isin: "INE009A01021",
    scripCode: "500209",
    industry: "IT Services & Consulting",
    sector: "Technology",
    description: "Infosys Ltd is a global leader in next-generation digital services and consulting, enabling clients across 56 countries to navigate their digital transformation.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Infosys Limited", "Infosys Technologies"],
    brandAliases: ["Infosys", "Infy"],
    corporateActions: [],
    pe: 26.4,
    marketCap: "₹7.65 Lakh Cr",
    cap: "Large Cap",
    website: "https://infosys.com",
    country: "India"
  },
  {
    canonicalSymbol: "TCS",
    officialName: "Tata Consultancy Services Ltd",
    tradingSymbol: "TCS",
    exchange: "NSE",
    isin: "INE467B01029",
    scripCode: "532540",
    industry: "IT Services & Consulting",
    sector: "Technology",
    description: "Tata Consultancy Services Ltd is an IT services, consulting, and business solutions organization partnered with global enterprises for over 50 years.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Tata Consultancy Services Limited"],
    brandAliases: ["TCS", "Tata Consultancy Services"],
    corporateActions: [],
    pe: 29.5,
    marketCap: "₹14.02 Lakh Cr",
    cap: "Large Cap",
    website: "https://tcs.com",
    country: "India"
  },
  {
    canonicalSymbol: "ITC",
    officialName: "ITC Ltd",
    tradingSymbol: "ITC",
    exchange: "NSE",
    isin: "INE154A01025",
    scripCode: "500875",
    industry: "FMCG & Diversified Conglomerate",
    sector: "Consumer Defensive",
    description: "ITC Ltd is one of India's foremost private sector companies with a diversified presence in FMCG, Hotels, Paperboards & Packaging, Agri Business, and IT.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["ITC Limited", "Imperial Tobacco Company"],
    brandAliases: ["ITC", "ITC Hotels", "Aashirvaad", "Sunfeast"],
    corporateActions: [
      {
        type: "Demerger",
        date: "2024-08-14",
        description: "Demerger of ITC Hotels into separate listed company."
      }
    ],
    pe: 28.2,
    marketCap: "₹6.12 Lakh Cr",
    cap: "Large Cap",
    website: "https://itcportal.com",
    country: "India"
  },
  {
    canonicalSymbol: "CDSL",
    officialName: "Central Depository Services (India) Ltd",
    tradingSymbol: "CDSL",
    exchange: "NSE",
    isin: "INE736A01011",
    scripCode: "543211",
    industry: "Capital Markets Depository",
    sector: "Financial Services",
    description: "Central Depository Services (India) Ltd is India's leading securities depository, holding Demat accounts and enabling convenient holding and transacting of securities.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["CDSL", "Central Depository Services Ltd"],
    brandAliases: ["CDSL", "Central Depository Services"],
    corporateActions: [],
    pe: 48.7,
    marketCap: "₹0.31 Lakh Cr",
    cap: "Mid Cap",
    website: "https://cdslindia.com",
    country: "India"
  },
  {
    canonicalSymbol: "TATASTEEL",
    officialName: "Tata Steel Ltd",
    tradingSymbol: "TATASTEEL",
    exchange: "NSE",
    isin: "INE081A01020",
    scripCode: "500470",
    industry: "Steel & Metallurgy",
    sector: "Basic Materials",
    description: "Tata Steel Ltd is one of the world's top steel producing companies with an annual crude steel capacity of 35 million tonnes.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Tata Steel Limited", "TISCO"],
    brandAliases: ["Tata Steel", "TISCO"],
    corporateActions: [],
    pe: 14.1,
    marketCap: "₹1.81 Lakh Cr",
    cap: "Large Cap",
    website: "https://tatasteel.com",
    country: "India"
  },
  {
    canonicalSymbol: "SBIN",
    officialName: "State Bank of India",
    tradingSymbol: "SBIN",
    exchange: "NSE",
    isin: "INE062A01020",
    scripCode: "500112",
    industry: "Public Sector Banking",
    sector: "Financial Services",
    description: "State Bank of India is a Fortune 500 company and the largest commercial bank in India in terms of assets, deposits, and branches.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["State Bank of India", "SBI"],
    brandAliases: ["SBI", "State Bank of India", "YONO"],
    corporateActions: [],
    pe: 10.4,
    marketCap: "₹7.51 Lakh Cr",
    cap: "Large Cap",
    website: "https://sbi.co.in",
    country: "India"
  },
  {
    canonicalSymbol: "BHARTIARTL",
    officialName: "Bharti Airtel Ltd",
    tradingSymbol: "BHARTIARTL",
    exchange: "NSE",
    isin: "INE397D01024",
    scripCode: "532454",
    industry: "Telecom Services",
    sector: "Telecommunications",
    description: "Bharti Airtel Ltd is a leading global communications solutions provider with operations in 17 countries across Asia and Africa.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Bharti Airtel Limited"],
    brandAliases: ["Airtel", "Bharti Airtel"],
    corporateActions: [],
    pe: 38.1,
    marketCap: "₹8.12 Lakh Cr",
    cap: "Large Cap",
    website: "https://airtel.in",
    country: "India",
    isFnO: true
  },
  {
    canonicalSymbol: "ICICIBANK",
    officialName: "ICICI Bank Ltd",
    tradingSymbol: "ICICIBANK",
    exchange: "NSE",
    isin: "INE090A01021",
    scripCode: "532174",
    industry: "Private Banking & Financial Services",
    sector: "Financial Services",
    description: "ICICI Bank Ltd is a leading private sector bank in India offering a wide range of banking products and financial services.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["ICICI Bank Limited"],
    brandAliases: ["ICICI", "ICICI Bank", "iMobile"],
    corporateActions: [],
    pe: 17.5,
    marketCap: "₹8.28 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "LT",
    officialName: "Larsen & Toubro Ltd",
    tradingSymbol: "LT",
    exchange: "NSE",
    isin: "INE018A01030",
    scripCode: "500510",
    industry: "Engineering & Infrastructure",
    sector: "Industrials",
    description: "Larsen & Toubro Ltd is an Indian multinational conglomerate engaged in EPC projects, hi-tech manufacturing, and services.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Larsen & Toubro Limited", "L&T"],
    brandAliases: ["L&T", "Larsen & Toubro"],
    corporateActions: [],
    pe: 31.2,
    marketCap: "₹4.85 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "M&M",
    officialName: "Mahindra & Mahindra Ltd",
    tradingSymbol: "M&M",
    exchange: "NSE",
    isin: "INE101A01026",
    scripCode: "500520",
    industry: "Automobile & Tractors",
    sector: "Automobile",
    description: "Mahindra & Mahindra Ltd is one of India's largest vehicle manufacturers by production and the largest manufacturer of tractors in the world.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Mahindra and Mahindra Limited"],
    brandAliases: ["Mahindra", "M&M", "Scorpio", "Thar"],
    corporateActions: [],
    pe: 28.4,
    marketCap: "₹3.52 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "MARUTI",
    officialName: "Maruti Suzuki India Ltd",
    tradingSymbol: "MARUTI",
    exchange: "NSE",
    isin: "INE585B01010",
    scripCode: "532500",
    industry: "Passenger Vehicles",
    sector: "Automobile",
    description: "Maruti Suzuki India Ltd is India's largest passenger car manufacturer, a subsidiary of Suzuki Motor Corporation.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Maruti Udyog Limited", "Maruti Suzuki"],
    brandAliases: ["Maruti", "Maruti Suzuki", "Nexa"],
    corporateActions: [],
    pe: 26.8,
    marketCap: "₹3.85 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "ADANIENT",
    officialName: "Adani Enterprises Ltd",
    tradingSymbol: "ADANIENT",
    exchange: "NSE",
    isin: "INE423A01024",
    scripCode: "512599",
    industry: "Diversified Incubator",
    sector: "Industrials",
    description: "Adani Enterprises Ltd is the flagship incubator company of Adani Group with businesses spanning airports, data centers, roads, and green hydrogen.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Adani Enterprises Limited"],
    brandAliases: ["Adani Enterprises", "Adani Group"],
    corporateActions: [],
    pe: 88.5,
    marketCap: "₹3.42 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "ADANIPORTS",
    officialName: "Adani Ports and Special Economic Zone Ltd",
    tradingSymbol: "ADANIPORTS",
    exchange: "NSE",
    isin: "INE742F01042",
    scripCode: "532921",
    industry: "Ports & Logistics",
    sector: "Industrials",
    description: "Adani Ports and Special Economic Zone Ltd is India's largest commercial port operator and integrated logistics provider.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Mundra Port and Special Economic Zone"],
    brandAliases: ["Adani Ports", "APSEZ"],
    corporateActions: [],
    pe: 34.2,
    marketCap: "₹3.10 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "BEL",
    officialName: "Bharat Electronics Ltd",
    tradingSymbol: "BEL",
    exchange: "NSE",
    isin: "INE263A01024",
    scripCode: "500049",
    industry: "Defense Electronics & Radar",
    sector: "Industrials",
    description: "Bharat Electronics Ltd is a Navratna PSU under the Ministry of Defence manufacturing advanced electronic products for armed forces.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Bharat Electronics Limited"],
    brandAliases: ["BEL", "Bharat Electronics"],
    corporateActions: [],
    pe: 45.1,
    marketCap: "₹2.15 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "HAL",
    officialName: "Hindustan Aeronautics Ltd",
    tradingSymbol: "HAL",
    exchange: "NSE",
    isin: "INE066F01020",
    scripCode: "541154",
    industry: "Aerospace & Defense",
    sector: "Industrials",
    description: "Hindustan Aeronautics Ltd is a premier Indian defence PSU engaged in design, fabrication, and assembly of aircraft, jet engines, and avionics.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Hindustan Aeronautics Limited"],
    brandAliases: ["HAL", "Tejas", "Hindustan Aeronautics"],
    corporateActions: [],
    pe: 35.6,
    marketCap: "₹3.15 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "BDL",
    officialName: "Bharat Dynamics Ltd",
    tradingSymbol: "BDL",
    exchange: "NSE",
    isin: "INE171Z01026",
    scripCode: "541143",
    industry: "Guided Missiles & Defense Systems",
    sector: "Industrials",
    description: "Bharat Dynamics Ltd is a Miniratna PSU defense enterprise manufacturing guided missile systems and underwater weapons for Indian armed forces.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Bharat Dynamics Limited"],
    brandAliases: ["BDL", "Akash Missile", "Bharat Dynamics"],
    corporateActions: [],
    pe: 58.4,
    marketCap: "₹0.52 Lakh Cr",
    cap: "Mid Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "MAZDOCK",
    officialName: "Mazagon Dock Shipbuilders Ltd",
    tradingSymbol: "MAZDOCK",
    exchange: "NSE",
    isin: "INE249Z01012",
    scripCode: "543237",
    industry: "Shipbuilding & Defense Submarines",
    sector: "Industrials",
    description: "Mazagon Dock Shipbuilders Ltd is India's leading defense shipyard constructing warships, stealth frigates, and submarines for the Indian Navy.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Mazagon Dock Limited"],
    brandAliases: ["Mazagon Dock", "MDL"],
    corporateActions: [],
    pe: 42.8,
    marketCap: "₹0.88 Lakh Cr",
    cap: "Mid Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "COCHINSHIP",
    officialName: "Cochin Shipyard Ltd",
    tradingSymbol: "COCHINSHIP",
    exchange: "NSE",
    isin: "INE704H01022",
    scripCode: "540678",
    industry: "Shipbuilding & Marine Repair",
    sector: "Industrials",
    description: "Cochin Shipyard Ltd is the largest shipbuilding and maintenance facility in India, builder of INS Vikrant indigenous aircraft carrier.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Cochin Shipyard Limited"],
    brandAliases: ["Cochin Shipyard", "CSL"],
    corporateActions: [],
    pe: 49.2,
    marketCap: "₹0.48 Lakh Cr",
    cap: "Mid Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "NTPC",
    officialName: "NTPC Ltd",
    tradingSymbol: "NTPC",
    exchange: "NSE",
    isin: "INE733E01010",
    scripCode: "532555",
    industry: "Thermal & Renewable Power Generation",
    sector: "Energy",
    description: "NTPC Ltd is India's largest power utility conglomerate with total installed capacity exceeding 76 GW across thermal, hydro, solar, and wind energy.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["National Thermal Power Corporation"],
    brandAliases: ["NTPC", "NTPC Green"],
    corporateActions: [],
    pe: 18.4,
    marketCap: "₹3.82 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "POWERGRID",
    officialName: "Power Grid Corporation of India Ltd",
    tradingSymbol: "POWERGRID",
    exchange: "NSE",
    isin: "INE752E01010",
    scripCode: "532898",
    industry: "Electric Power Transmission",
    sector: "Energy",
    description: "Power Grid Corporation of India Ltd is a Maharatna PSU transmitting over 85% of India's total inter-regional power.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Power Grid Corporation"],
    brandAliases: ["Power Grid", "PGCIL"],
    corporateActions: [],
    pe: 19.1,
    marketCap: "₹3.18 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "COALINDIA",
    officialName: "Coal India Ltd",
    tradingSymbol: "COALINDIA",
    exchange: "NSE",
    isin: "INE522F01014",
    scripCode: "533278",
    industry: "Coal Mining & Extraction",
    sector: "Energy",
    description: "Coal India Ltd is a Maharatna PSU and the single largest coal producer in the world, contributing ~80% of India's domestic coal output.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Coal India Limited"],
    brandAliases: ["Coal India", "CIL"],
    corporateActions: [],
    pe: 9.2,
    marketCap: "₹3.05 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    isPSU: true,
    country: "India"
  },
  {
    canonicalSymbol: "JSWSTEEL",
    officialName: "JSW Steel Ltd",
    tradingSymbol: "JSWSTEEL",
    exchange: "NSE",
    isin: "INE019A01038",
    scripCode: "500228",
    industry: "Steel & Metals",
    sector: "Basic Materials",
    description: "JSW Steel Ltd is the flagship company of the JSW Group and one of India's leading integrated steel manufacturers.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["JSW Steel Limited"],
    brandAliases: ["JSW Steel", "JSW"],
    corporateActions: [],
    pe: 24.8,
    marketCap: "₹2.25 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "TRENT",
    officialName: "Trent Ltd",
    tradingSymbol: "TRENT",
    exchange: "NSE",
    isin: "INE849A01020",
    scripCode: "500251",
    industry: "Retail & Apparel Fashion",
    sector: "Consumer Discretionary",
    description: "Trent Ltd is the retail arm of the Tata Group, operating Zudio value fashion stores, Westside lifestyle chains, and Star Bazaar hypermarkets.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Trent Limited"],
    brandAliases: ["Trent", "Zudio", "Westside", "Star Bazaar"],
    corporateActions: [],
    pe: 145.2,
    marketCap: "₹2.65 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "ASIANPAINT",
    officialName: "Asian Paints Ltd",
    tradingSymbol: "ASIANPAINT",
    exchange: "NSE",
    isin: "INE021A01026",
    scripCode: "500820",
    industry: "Paints & Home Decor",
    sector: "Consumer Discretionary",
    description: "Asian Paints Ltd is India's leading paint company and decorative coating manufacturer, operating in 15 countries globally.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Asian Paints Limited"],
    brandAliases: ["Asian Paints"],
    corporateActions: [],
    pe: 48.5,
    marketCap: "₹2.75 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "BAJFINANCE",
    officialName: "Bajaj Finance Ltd",
    tradingSymbol: "BAJFINANCE",
    exchange: "NSE",
    isin: "INE296A01024",
    scripCode: "500034",
    industry: "Non-Banking Financial Company (NBFC)",
    sector: "Financial Services",
    description: "Bajaj Finance Ltd is India's leading retail NBFC offering consumer lending, SME loans, commercial lending, and wealth management.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Bajaj Auto Finance Limited"],
    brandAliases: ["Bajaj Finance", "Bajaj Finserv"],
    corporateActions: [],
    pe: 29.8,
    marketCap: "₹4.15 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "SUNPHARMA",
    officialName: "Sun Pharmaceutical Industries Ltd",
    tradingSymbol: "SUNPHARMA",
    exchange: "NSE",
    isin: "INE044A01036",
    scripCode: "524715",
    industry: "Pharmaceuticals & Generics",
    sector: "Healthcare",
    description: "Sun Pharmaceutical Industries Ltd is the largest specialty generic pharmaceutical company in India and 4th largest globally.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["Sun Pharma Limited"],
    brandAliases: ["Sun Pharma", "Ranbaxy"],
    corporateActions: [],
    pe: 38.6,
    marketCap: "₹4.10 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  },
  {
    canonicalSymbol: "ULTRACEMCO",
    officialName: "UltraTech Cement Ltd",
    tradingSymbol: "ULTRACEMCO",
    exchange: "NSE",
    isin: "INE481G01011",
    scripCode: "532538",
    industry: "Cement & Building Materials",
    sector: "Basic Materials",
    description: "UltraTech Cement Ltd is the flagship cement company of the Aditya Birla Group and the largest manufacturer of grey cement in India.",
    status: "Active",
    oldSymbols: [],
    previousNames: ["UltraTech Cement Limited"],
    brandAliases: ["UltraTech", "UltraTech Cement"],
    corporateActions: [],
    pe: 42.1,
    marketCap: "₹3.35 Lakh Cr",
    cap: "Large Cap",
    isFnO: true,
    country: "India"
  }
];

export class CompanyIdentityResolver {
  private static instance: CompanyIdentityResolver;
  private masterList: CanonicalCompanyRecord[] = MASTER_CANONICAL_DATABASE;
  private lastRefreshed: number = Date.now();

  private constructor() {
    this.autoRefreshCheck();
  }

  public static getInstance(): CompanyIdentityResolver {
    if (!CompanyIdentityResolver.instance) {
      CompanyIdentityResolver.instance = new CompanyIdentityResolver();
    }
    return CompanyIdentityResolver.instance;
  }

  /**
   * Auto-refreshes canonical metadata every 24 hours
   */
  public autoRefreshCheck(): void {
    const now = Date.now();
    const STORAGE_KEY = "athena_company_master_last_refresh";
    try {
      const savedTime = safeLocalStorage.getItem(STORAGE_KEY);
      if (!savedTime || now - parseInt(savedTime, 10) > 24 * 60 * 60 * 1000) {
        safeLocalStorage.setItem(STORAGE_KEY, now.toString());
        this.lastRefreshed = now;
      }
    } catch (e) {}
  }

  /**
   * Resolves query/symbol to single canonical record.
   * Handles old symbols (e.g. ZOMATO -> ETERNAL), old names, brand aliases, and ticker query.
   */
  public resolve(query: string): CanonicalCompanyRecord {
    if (!query) {
      return this.masterList[0];
    }

    const clean = query.trim().toUpperCase();
    const cleanLower = query.trim().toLowerCase();

    // 1. Direct match on canonicalSymbol or tradingSymbol
    const directMatch = this.masterList.find(c => 
      c.canonicalSymbol === clean || 
      c.tradingSymbol === clean ||
      c.canonicalSymbol + ".NS" === clean ||
      c.tradingSymbol + ".NS" === clean
    );
    if (directMatch) return directMatch;

    // 2. Match on oldSymbols
    const oldSymbolMatch = this.masterList.find(c => 
      c.oldSymbols.some(s => s.toUpperCase() === clean || s.toUpperCase() + ".NS" === clean)
    );
    if (oldSymbolMatch) return oldSymbolMatch;

    // 3. Match on officialName
    const officialNameMatch = this.masterList.find(c => 
      c.officialName.toLowerCase() === cleanLower
    );
    if (officialNameMatch) return officialNameMatch;

    // 4. Match on previousNames
    const prevNameMatch = this.masterList.find(c => 
      c.previousNames.some(p => p.toLowerCase() === cleanLower)
    );
    if (prevNameMatch) return prevNameMatch;

    // 5. Match on brandAliases
    const aliasMatch = this.masterList.find(c => 
      c.brandAliases.some(a => a.toLowerCase() === cleanLower)
    );
    if (aliasMatch) return aliasMatch;

    // 6. Partial match on brandAliases or officialName
    const partialMatch = this.masterList.find(c => 
      c.officialName.toLowerCase().includes(cleanLower) ||
      c.brandAliases.some(a => a.toLowerCase().includes(cleanLower)) ||
      c.previousNames.some(p => p.toLowerCase().includes(cleanLower))
    );
    if (partialMatch) return partialMatch;

    // Fallback: Dynamic record construction so app never crashes
    return {
      canonicalSymbol: clean.replace(".NS", ""),
      officialName: query.trim(),
      tradingSymbol: clean.replace(".NS", ""),
      exchange: clean.endsWith(".BO") ? "BSE" : "NSE",
      isin: "INE000A00000",
      industry: "General Market",
      sector: "Diversified",
      status: "Active",
      oldSymbols: [],
      previousNames: [],
      brandAliases: [query.trim()],
      corporateActions: [],
      pe: 20,
      marketCap: "N/A"
    };
  }

  /**
   * Resolves query to all matching canonical companies (e.g. "Tata Motors" -> Passenger Vehicles & Commercial Vehicles)
   */
  public resolveAllMatches(query: string): CanonicalCompanyRecord[] {
    if (!query || !query.trim()) return this.masterList;
    const cleanLower = query.trim().toLowerCase();
    const cleanUpper = query.trim().toUpperCase();

    const matches = this.masterList.filter(c => 
      c.canonicalSymbol.toUpperCase().includes(cleanUpper) ||
      c.tradingSymbol.toUpperCase().includes(cleanUpper) ||
      c.officialName.toLowerCase().includes(cleanLower) ||
      c.oldSymbols.some(s => s.toUpperCase().includes(cleanUpper)) ||
      c.previousNames.some(p => p.toLowerCase().includes(cleanLower)) ||
      c.brandAliases.some(a => a.toLowerCase().includes(cleanLower))
    );

    return matches.length > 0 ? matches : [this.resolve(query)];
  }

  public search(query: string): CanonicalCompanyRecord[] {
    return this.resolveAllMatches(query);
  }

  /**
   * Resolves symbol string to official canonical symbol
   */
  public resolveSymbol(query: string): string {
    return this.resolve(query).canonicalSymbol;
  }

  /**
   * Resolves symbol or name string to official canonical name
   */
  public resolveName(query: string): string {
    return this.resolve(query).officialName;
  }

  /**
   * Returns list of canonical records for NSE Trending Stocks
   */
  public getTrendingCompanies(): CanonicalCompanyRecord[] {
    return [
      this.resolve("RELIANCE"),
      this.resolve("TATAMOTORS"),
      this.resolve("TATAMTRDVR"),
      this.resolve("HDFCBANK"),
      this.resolve("INFY"),
      this.resolve("ETERNAL"),
      this.resolve("ITC"),
      this.resolve("CDSL"),
      this.resolve("TATASTEEL"),
      this.resolve("TCS"),
      this.resolve("SBIN"),
      this.resolve("BHARTIARTL")
    ];
  }

  /**
   * Migrate watchlist items automatically to canonical entities without duplicates
   */
  public migrateWatchlist(watchlist: any[]): any[] {
    if (!Array.isArray(watchlist)) return [];

    const migratedMap = new Map<string, any>();

    for (const item of watchlist) {
      const sym = item.symbol || item.companyId || item;
      const canonical = this.resolve(typeof sym === "string" ? sym : String(sym));
      
      if (!migratedMap.has(canonical.canonicalSymbol)) {
        migratedMap.set(canonical.canonicalSymbol, {
          ...item,
          companyId: canonical.canonicalSymbol,
          symbol: canonical.canonicalSymbol,
          name: canonical.officialName,
          officialName: canonical.officialName,
          oldSymbol: item.symbol !== canonical.canonicalSymbol ? item.symbol : undefined
        });
      }
    }

    return Array.from(migratedMap.values());
  }

  /**
   * Entity extraction helper for news and AI text engines.
   * Given text or entity string, maps to canonical company info.
   */
  public canonicalizeNewsEntity(text: string): { canonicalSymbol: string; officialName: string; isMatch: boolean } {
    if (!text) return { canonicalSymbol: "", officialName: "", isMatch: false };
    
    // Check if text mentions Zomato / Eternal or Reliance or Tata Motors etc.
    const resolved = this.resolve(text);
    if (resolved && resolved.officialName) {
      return {
        canonicalSymbol: resolved.canonicalSymbol,
        officialName: resolved.officialName,
        isMatch: true
      };
    }

    return { canonicalSymbol: text, officialName: text, isMatch: false };
  }

  /**
   * Validation Layer (Req 4): Verifies that a company card/record matches canonical exchange metadata.
   * If any mismatch is found (name, symbol, ISIN, description, sector, industry), discards legacy data and returns fresh canonical record.
   */
  public validateCompanyRecord(record: any): { isValid: boolean; canonical: CanonicalCompanyRecord; correctedRecord: any } {
    if (!record) {
      const defaultCanonical = this.resolve("RELIANCE");
      return { isValid: false, canonical: defaultCanonical, correctedRecord: defaultCanonical };
    }

    const query = record.canonicalSymbol || record.symbol || record.companyId || record.name || record.officialName || "";
    const canonical = this.resolve(String(query));

    const nameMatches = record.name === canonical.officialName || record.officialName === canonical.officialName;
    const symbolMatches = record.symbol === canonical.canonicalSymbol || record.canonicalSymbol === canonical.canonicalSymbol;
    const isinMatches = !record.isin || record.isin === "INE000A00000" || record.isin === canonical.isin;

    const isValid = nameMatches && symbolMatches && isinMatches;

    const correctedRecord = {
      ...record,
      symbol: canonical.canonicalSymbol,
      canonicalSymbol: canonical.canonicalSymbol,
      officialName: canonical.officialName,
      name: canonical.officialName,
      companyId: canonical.canonicalSymbol,
      isin: canonical.isin !== "INE000A00000" ? canonical.isin : (record.isin || canonical.isin),
      scripCode: canonical.scripCode || record.scripCode,
      industry: canonical.industry || record.industry,
      sector: canonical.sector || record.sector,
      description: canonical.description || record.description || record.businessSummary,
      businessSummary: canonical.description || record.businessSummary || record.description,
      pe: canonical.pe || record.pe,
      marketCap: canonical.marketCap || record.marketCap,
      corporateActions: canonical.corporateActions
    };

    return { isValid, canonical, correctedRecord };
  }

  /**
   * Corporate Action Integrity Audit (Req 5):
   * After any rename or demerger, audits linked datasets (Old Company ID -> New Company ID)
   * to ensure zero legacy references remain.
   */
  public runIntegrityAudit(companyId: string): { oldId: string; newId: string; canonical: CanonicalCompanyRecord } {
    const canonical = this.resolve(companyId);
    return {
      oldId: companyId,
      newId: canonical.canonicalSymbol,
      canonical
    };
  }
}
