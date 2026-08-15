import { SearchManager } from "../../mcp/SearchManager";
import { CompanyResolverService } from "../../services/CompanyResolverService";

async function runPAT() {
  const results = {
    gate5_cache: { name: "Intelligence Cache Validation", status: "PENDING" },
    gate7_resolution: { name: "Company Resolution Validation", status: "PENDING" },
  };

  console.log("--- Starting PAT ---");

  // Gate 5: Cache Check
  // Mock localStorage and fetch for node environment
  (global as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  (global as any).fetch = async (url: string) => {
    return {
      ok: true,
      json: async () => ({ results: [] }),
      text: async () => JSON.stringify({ results: [] })
    };
  };
  
  const sm = SearchManager.getInstance();
  const query = "Reliance Industries news";
  
  console.log("Gate 5: Testing Cache...");
  const t0 = Date.now();
  await sm.search(query, "PAT");
  const t1 = Date.now();
  await sm.search(query, "PAT");
  const t2 = Date.now();
  
  // Logic: First call should take significant time, second should be near instant (cache hit)
  const firstLat = t1 - t0;
  const secondLat = t2 - t1;
  
  if (secondLat < firstLat / 2) {
    results.gate5_cache.status = "PASS";
    console.log(`Gate 5 PASS: Latencies ${firstLat}ms -> ${secondLat}ms`);
  } else {
    results.gate5_cache.status = "FAIL";
    console.log(`Gate 5 FAIL: Latencies ${firstLat}ms -> ${secondLat}ms`);
  }

  // Gate 7: Resolution Check
  const cr = CompanyResolverService.getInstance();
  console.log("Gate 7: Testing Resolution...");
  const aliases = ["RIL", "RELIANCE", "Reliance Industries"];
  const resolved = await Promise.all(aliases.map(a => cr.resolveCompany(a)));
  
  const allSame = resolved.every(r => r !== null && r.symbol === resolved[0]?.symbol);
  
  if (allSame && resolved[0] !== null) {
    results.gate7_resolution.status = "PASS";
    console.log(`Gate 7 PASS: Resolved to ${resolved[0].name}`);
  } else {
    results.gate7_resolution.status = "FAIL";
    console.log(`Gate 7 FAIL: Resolved to ${JSON.stringify(resolved)}`);
  }

  console.log("--- PAT Results ---");
  console.log(JSON.stringify(results, null, 2));
}

runPAT().catch(console.error);
