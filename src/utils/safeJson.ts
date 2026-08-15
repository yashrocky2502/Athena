/**
 * Utility to safely clean and serialize objects containing circular references,
 * Error objects, DOM elements, or non-serializable properties.
 */
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
      // Omit Express/Node internal properties or socket cycles
      if (
        key === 'socket' ||
        key === '_implicitHeader' ||
        key === 'req' ||
        key === 'res' ||
        key === '_events' ||
        key === '_eventsCount' ||
        key === '_maxListeners'
      ) {
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

export function safeJsonStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return JSON.stringify(removeCircular(obj), null, space);
  }
}
