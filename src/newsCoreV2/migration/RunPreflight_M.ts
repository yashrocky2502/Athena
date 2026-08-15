
import { Phase23_5_M_Reconciliation } from './Phase23_5_M_Reconciliation.ts';

async function run() {
    const migration = new Phase23_5_M_Reconciliation(true); // DRY-RUN
    const report = await migration.execute();
    
    console.log('\n--- MIGRATION PREFLIGHT REPORT ---');
    console.log(JSON.stringify(report, null, 2));
    
    // Verification against user projections
    const projectedCount = 1698;
    const actualCount = report.uniques.finalCanonicalCount;
    
    if (Math.abs(actualCount - projectedCount) < 50) {
        console.log(`\n[VERIFICATION] SUCCESS: Actual count ${actualCount} is within acceptable variance of projected ${projectedCount}.`);
    } else {
        console.warn(`\n[VERIFICATION] WARNING: Actual count ${actualCount} deviates significantly from projected ${projectedCount}.`);
    }
}

run().catch(console.error);
