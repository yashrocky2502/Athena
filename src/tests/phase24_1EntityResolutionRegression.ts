import { runTelegramQualityGateRegressionSuite } from '../news/NewsEngine/TelegramQualityGateRegression';

export async function runPhase24_1RegressionSuite(): Promise<{ success: boolean; results: string[] }> {
  console.log("=== RUNNING PHASE 24.1 ENTITY RESOLUTION REGRESSION SUITE ===");
  const qgResult = await runTelegramQualityGateRegressionSuite();
  
  const results: string[] = [];
  qgResult.results.forEach(r => {
    results.push(`[Phase 24.1] ${r.passed ? '✅ PASS' : '❌ FAIL'}: ${r.name} - ${r.reason}`);
  });

  console.log(`Phase 24.1 Results: ${qgResult.passedCount} passed, ${qgResult.failedCount} failed.`);
  return {
    success: qgResult.success,
    results
  };
}

if (process.argv[1] && process.argv[1].endsWith('phase24_1EntityResolutionRegression.ts')) {
  runPhase24_1RegressionSuite().then(res => {
    process.exit(res.success ? 0 : 1);
  });
}
