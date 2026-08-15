import { ArticleContent } from '../news/NewsEngine/ArticleContent';

export function removeCircular<T>(obj: T): T {
  const seen = new WeakSet();
  function clean(val: any): any {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (val instanceof Error) {
      return {
        name: val.name,
        message: val.message,
        stack: val.stack
      };
    }
    if (seen.has(val)) {
      return undefined;
    }
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map(item => clean(item)).filter(item => item !== undefined);
    }

    const resObj: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      if (key === 'socket' || key === '_implicitHeader' || key === 'req' || key === 'res' || key === '_events') {
        continue;
      }
      const cleanedVal = clean(val[key]);
      if (cleanedVal !== undefined) {
        resObj[key] = cleanedVal;
      }
    }
    return resObj as T;
  }
  return clean(obj);
}

// Test circular object
const circularObj: any = {
  status: 'success',
  content: {
    id: 'test-123',
    headline: 'Test Headline',
  }
};
circularObj.content.self = circularObj;
circularObj.content.child = circularObj.content;

console.log('Testing circular serialization...');
try {
  JSON.stringify(circularObj);
  console.log('UNEXPECTED: direct JSON.stringify did not fail');
} catch (err: any) {
  console.log('Expected failure caught:', err.message);
}

const cleaned = removeCircular(circularObj);
const json = JSON.stringify(cleaned);
console.log('Cleaned JSON successfully generated:', json);
