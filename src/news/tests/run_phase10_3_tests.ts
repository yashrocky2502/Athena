import { runPhase10_3_Tests } from './Phase10_3_EndToEndLiveRealityValidation.test.ts';

async function main() {
  console.log('=== RUNNING PHASE 10.3 END-TO-END LIVE REALITY VALIDATION TEST SUITE ===');
  const res = await runPhase10_3_Tests();
  console.log('\nResults:');
  for (const r of res.results) {
    console.log(`[${r.status}] ${r.test} ${r.error ? `-> ERROR: ${r.error}` : ''}`);
  }
  console.log(`\nOverall: ${res.passed ? 'ALL 35 TESTS PASSED' : 'SOME TESTS FAILED'}`);
  if (!res.passed) process.exit(1);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
