import { CanonicalSummaryPipelineTest } from './CanonicalSummaryPipelineTest.ts';

async function main() {
  console.log('Running Canonical Summary Pipeline Regression Suite...');
  const res = await CanonicalSummaryPipelineTest.runAllTests();
  console.log('=== TEST RESULTS ===');
  for (const r of res.results) {
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'}: ${r.name}`);
    if (r.error) console.log(`   Error: ${r.error}`);
    if (r.details) console.log(`   Details:`, JSON.stringify(r.details));
  }
  console.log(`\nOverall Result: ${res.passed ? 'ALL PASSED' : 'SOME FAILED'}`);
  if (!res.passed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
