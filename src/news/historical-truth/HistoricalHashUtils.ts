/**
 * ATHENA — PHASE 23: HISTORICAL MARKET TRUTH
 * HistoricalHashUtils.ts
 * 
 * Deterministic cryptographic hashing and serialization utilities for state checkpoints,
 * snapshots, and look-ahead validation.
 */

export class HistoricalHashUtils {
  /**
   * Deterministically stringifies an object by sorting keys recursively
   */
  public static deterministicStringify(obj: any): string {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.deterministicStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map(k => `${JSON.stringify(k)}:${this.deterministicStringify(obj[k])}`);
    return '{' + parts.join(',') + '}';
  }

  /**
   * Fast, deterministic 64-bit FNV-1a / Murmur-like hash producing 16-hex characters
   */
  public static hashObject(obj: any): string {
    const str = this.deterministicStringify(obj);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `h_${hex1}${hex2}`;
  }

  /**
   * Generates a unique provenance ID
   */
  public static generateProvenanceId(source: string, timestamp: string, sequence: number = 0): string {
    const raw = `${source}_${timestamp}_${sequence}`;
    return `prov_${this.hashObject(raw).slice(2, 12)}`;
  }
}
