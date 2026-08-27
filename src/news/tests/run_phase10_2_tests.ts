import { runPhase10_2_Tests } from './Phase10_2_LiveIntelligenceUXIntegration.test';

async function main() {
  console.log('=== RUNNING PHASE 10.2 TEST SUITE ===');
  const res = await runPhase10_2_Tests();
  console.log('\nResults:');
  for (const r of res.results) {
    console.log(`[${r.status}] ${r.test} ${r.error ? `-> ERROR: ${r.error}` : ''}`);
  }
  console.log(`\nOverall: ${res.passed ? 'ALL PASSED' : 'SOME TESTS FAILED'}`);
  if (!res.passed) process.exit(1);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
