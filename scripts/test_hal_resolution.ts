import { findFNOEntityInHeadline } from '../src/newsCoreV2/fno/FNOUniverse';

const headline = "HAL shares rally 45% since April. Is the stock still attractive after Q1 earnings?";
const result = findFNOEntityInHeadline(headline);

console.log('Headline:', headline);
console.log('Result:', JSON.stringify(result, null, 2));
