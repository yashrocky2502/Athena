
import { ConsensusEngine } from "./src/services/server/ConsensusEngine";

const symbols = [
  "RELIANCE.NS",
  "TATAMOTORS.NS",
  "INFY.NS",
  "AAPL",
  "HDFCBANK.NS",
  "TCS.NS"
];

async function runAudit() {
  const engine = ConsensusEngine.getInstance();
  
  for (const symbol of symbols) {
    console.log(`\n=== AUDITING: ${symbol} ===`);
    try {
      const start = Date.now();
      const record = await engine.forceRefresh(symbol);
      const duration = Date.now() - start;

      console.log(`Status: Freshly synchronized (Latency: ${duration}ms)`);
      console.log(`Agreement Score: ${record.agreementPercentage}%`);
      console.log(`Providers Queried: ${record.providersQueried.join(", ")}`);
      
      const metricsToAudit = [
        "revenue", "netProfit", "operatingMargin", "marketCap", "price"
      ];

      for (const mKey of metricsToAudit) {
        const metric = (record.metrics as any)[mKey];
        console.log(`\n  [Metric: ${mKey}]`);
        console.log(`  - Winning Value: ${metric.value}`);
        console.log(`  - Winner: ${metric.source}`);
        console.log(`  - Confidence: ${metric.confidenceScore}%`);
        console.log(`  - Supporting Providers: ${metric.supportingProviders.join(", ")}`);
        
        if (metric.conflictDetails) {
          console.log(`  - RAW VALUES (All Providers):`);
          metric.conflictDetails.forEach((c: any) => {
            console.log(`    * ${c.provider}: ${c.value}`);
          });
        } else {
          console.log(`  - RAW VALUES (Consensus): All queried providers returned ${metric.value}`);
        }
      }

      if (record.missingFields.length > 0) {
        console.log(`\n  Missing Fields: ${record.missingFields.join(", ")}`);
      }
      
      const timeouts = record.providersQueried.filter(p => !record.providerLatencies[p]);
      if (timeouts.length > 0) {
        console.log(`\n  Timeouts/Failures: ${timeouts.join(", ")}`);
      }

    } catch (err: any) {
      console.error(`Failed to audit ${symbol}:`, err.message);
    }
  }
}

runAudit();
