import { NotificationService } from './src/news/NewsEngine/NotificationService';

async function runPAT() {
  console.log("=== ATHENA V8.0 — PRODUCTION NOTIFICATION TEST REPORT ===\n");

  const service = NotificationService.getInstance();

  // Test set representing live ingested articles stream across various categories and sources
  const sampleArticles = [
    // F&O Core Companies
    { id: 'pat_1', headline: 'Reliance Industries Q1 Net Profit rises 12% YoY to ₹18,900 Cr; retail revenue surges', publisher: 'Economic Times', category: 'Results', publishedAt: new Date().toISOString() },
    { id: 'pat_2', headline: 'TCS signs $1.2 Billion AI transformation contract with European banking group', publisher: 'Moneycontrol', category: 'Corporate', publishedAt: new Date().toISOString() },
    { id: 'pat_3', headline: 'Infosys receives SEBI warning regarding disclosure timeline for insider trading', publisher: 'Financial Express', category: 'Regulatory', publishedAt: new Date().toISOString() },
    { id: 'pat_4', headline: 'State Bank of India (SBIN) Q1 Profit jumps 14% to ₹17,035 Cr; GNPA drops to 2.2%', publisher: 'LiveMint', category: 'Banking', publishedAt: new Date().toISOString() },
    { id: 'pat_5', headline: 'ICICI Bank Q1 Net Profit climbs 15% YoY; deposit growth remains robust', publisher: 'Business Standard', category: 'Banking', publishedAt: new Date().toISOString() },
    { id: 'pat_6', headline: 'HDFC Bank board approves ₹15,000 Cr bond issuance for capital expansion', publisher: 'CNBC TV18', category: 'Corporate', publishedAt: new Date().toISOString() },
    { id: 'pat_7', headline: 'Bajaj Finance Q1 Net Profit up 19% to ₹3,912 Cr; AUM expands 31%', publisher: 'NDTV Profit', category: 'Results', publishedAt: new Date().toISOString() },
    { id: 'pat_8', headline: 'Maruti Suzuki reports record quarterly sales of 5.2 lakh units driven by SUV demand', publisher: 'Economic Times', category: 'Corporate', publishedAt: new Date().toISOString() },
    { id: 'pat_9', headline: 'Tata Motors EV sales grow 28% YoY in Q1; JLR margins expand to 8.5%', publisher: 'Moneycontrol', category: 'Results', publishedAt: new Date().toISOString() },
    { id: 'pat_10', headline: 'Bharat Electronics (BEL) bags ₹2,400 Cr defence contract for naval radar systems', publisher: 'Financial Express', category: 'Order Win', publishedAt: new Date().toISOString() },
    { id: 'pat_11', headline: 'Hyundai Motor India Ltd Q1 Net Profit rises 15% to ₹1,480 Cr', publisher: 'Moneycontrol', category: 'Results', publishedAt: new Date().toISOString() },
    { id: 'pat_12', headline: 'Mazagon Dock Shipbuilders wins ₹4,500 Cr defence order for stealth frigates', publisher: 'Business Standard', category: 'Order Win', publishedAt: new Date().toISOString() },

    // Macro Articles
    { id: 'pat_13', headline: 'IMD issues heavy rainfall alert for West Coast as monsoon intensifies across India', publisher: 'PTI', category: 'Economy', publishedAt: new Date().toISOString() },
    { id: 'pat_14', headline: 'RBI keeps Repo Rate unchanged at 6.50% for 8th consecutive meeting; retains stance', publisher: 'Moneycontrol', category: 'Economy', publishedAt: new Date().toISOString() },
    { id: 'pat_15', headline: 'India CPI Inflation eases to 4.75% in May; food prices remain elevated', publisher: 'Financial Express', category: 'Economy', publishedAt: new Date().toISOString() },
    { id: 'pat_16', headline: 'India GDP Growth estimate revised upward to 7.2% for FY25 by World Bank', publisher: 'LiveMint', category: 'Economy', publishedAt: new Date().toISOString() },

    // Commodity Articles
    { id: 'pat_17', headline: 'Crude oil prices tumble 3% as OPEC+ plans production increase in Q4', publisher: 'Reuters', category: 'Commodity', publishedAt: new Date().toISOString() },
    { id: 'pat_18', headline: 'Gold prices hit record high above $2,420/oz on rate cut bets and central bank buying', publisher: 'CNBC US', category: 'Commodity', publishedAt: new Date().toISOString() },

    // Global Articles
    { id: 'pat_19', headline: 'Nasdaq and S&P 500 advance as tech rally pushes Wall Street to fresh closing highs', publisher: 'Reuters Global', category: 'Global', publishedAt: new Date().toISOString() },
    { id: 'pat_20', headline: 'Federal Reserve holds interest rates steady; Powell hints at possible September rate cut', publisher: 'Bloomberg US', category: 'Global', publishedAt: new Date().toISOString() },

    // Political Articles
    { id: 'pat_21', headline: 'Election Commission announces schedule for upcoming state assembly elections', publisher: 'NDTV', category: 'Politics', publishedAt: new Date().toISOString() },
    
    // Duplicate F&O Articles
    { id: 'pat_22', headline: 'Reliance Industries Q1 Net Profit surges 12% to ₹18,900 Cr; retail outperforms', publisher: 'Moneycontrol', category: 'Results', publishedAt: new Date().toISOString() },
  ];

  let totalArticles = 0;
  let correctlyClassified = 0;
  let misclassified = 0;
  let alertsSent = 0;
  let alertsSuppressed = 0;

  const processedLogs = [];

  for (const rawItem of sampleArticles) {
    totalArticles++;
    const isEligible = service.isEligible(rawItem);
    const notification = await service.processArticle(rawItem);

    if (isEligible) correctlyClassified++;
    else misclassified++;

    if (notification) alertsSent++;
    else alertsSuppressed++;

    processedLogs.push({
      headline: rawItem.headline,
      isEligible,
      sent: !!notification
    });
  }

  console.log("==========================================");
  console.log("FINAL NOTIFICATION ENGINE AUDIT STATISTICS");
  console.log("==========================================");
  console.log(`Total Articles Processed: ${totalArticles}`);
  console.log(`Eligible F&O Articles: ${correctlyClassified}`);
  console.log(`Non-F&O Articles: ${misclassified}`);
  console.log(`Telegram Alerts Sent: ${alertsSent}`);
  console.log(`Telegram Alerts Suppressed: ${alertsSuppressed}`);
  console.table(processedLogs);

  process.exit(0);
}

runPAT().catch(console.error);
