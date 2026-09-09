/**
 * ATHENA — PHASE 24: UNIVERSAL EVIDENCE, PROVENANCE, CONFIDENCE & FORENSIC EXPLAINABILITY LAYER
 * EvidenceHashEngine.ts
 * 
 * Deterministic cryptographic hashing engine for evidence objects, evidence chains,
 * DAG relationships, and forensic decision records.
 * 
 * Guarantee: Stable hash across process restart, serialization, network transport,
 * and historical replay. Zero reliance on object memory address, wall clock, or iteration order.
 */

import { EvidenceObject, EvidenceNode, EvidenceEdge, ForensicDecisionRecord } from './types.ts';

export class EvidenceHashEngine {
  /**
   * Deterministic canonical JSON serialization:
   * Recursively sorts object keys and normalizes primitive numbers to avoid float drift.
   */
  public static canonicalStringify(obj: any): string {
    if (obj === null || obj === undefined) {
      return 'null';
    }
    if (typeof obj === 'number') {
      if (Number.isNaN(obj) || !Number.isFinite(obj)) return 'null';
      // Normalize precision to avoid floating point inconsistencies
      return Number(obj.toFixed(6)).toString();
    }
    if (typeof obj === 'boolean') {
      return obj ? 'true' : 'false';
    }
    if (typeof obj === 'string') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      const elements = obj.map(item => EvidenceHashEngine.canonicalStringify(item));
      return '[' + elements.join(',') + ']';
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj).sort();
      const keyValPairs = keys
        .filter(k => obj[k] !== undefined && typeof obj[k] !== 'function')
        .map(k => `${JSON.stringify(k)}:${EvidenceHashEngine.canonicalStringify(obj[k])}`);
      return '{' + keyValPairs.join(',') + '}';
    }
    return JSON.stringify(String(obj));
  }

  /**
   * Pure deterministic SHA-256 implementation (browser & Node.js isomorphic).
   * Generates a 64-character hex string.
   */
  public static sha256(ascii: string): string {
    function rightRotate(value: number, amount: number): number {
      return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i = 0, j = 0;
    let result = '';

    const words: number[] = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    let hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let compositeWordsLength = ((asciiBitLength + 64 >>> 9) << 4) + 15;
    for (i = 0; i <= compositeWordsLength; i++) words[i] = 0;

    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[i >> 2] |= 0x80 << ((3 - i % 4) * 8);
    words[compositeWordsLength] = asciiBitLength;

    const w: number[] = [];
    for (i = 0; i < words[lengthProperty]; i += 16) {
      let [a, b, c, d, e, f, g, h] = hash;

      for (j = 0; j < 64; j++) {
        if (j < 16) {
          w[j] = words[j + i];
        } else {
          const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
          const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
        }

        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      hash[0] = (hash[0] + a) | 0;
      hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0;
      hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0;
      hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0;
      hash[7] = (hash[7] + h) | 0;
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16 ? '0' : '') + b.toString(16));
      }
    }
    return result;
  }

  /**
   * Hashes raw payload of an evidence object (pure 64-char sha256)
   */
  public static computeContentHash(payload: any): string {
    const canonical = EvidenceHashEngine.canonicalStringify(payload);
    return EvidenceHashEngine.sha256(canonical);
  }

  /**
   * Computes deterministic canonical hash (64-char sha256)
   */
  public static computeCanonicalHash(evidence: any): string {
    const canonical = EvidenceHashEngine.canonicalStringify(evidence);
    return EvidenceHashEngine.sha256(canonical);
  }

  /**
   * Hashes canonical EvidenceObject fields (excluding dynamic mutable fields)
   */
  public static computeCanonicalEvidenceHash(evidence: Partial<EvidenceObject>): string {
    const cleanObject = {
      evidenceType: evidence.evidenceType,
      source: evidence.source,
      sourceTier: evidence.sourceTier,
      sourceId: evidence.sourceId,
      symbol: evidence.symbol || null,
      entity: evidence.entity || null,
      sourceTimestamp: evidence.sourceTimestamp,
      availabilityTimestamp: evidence.availabilityTimestamp,
      contentHash: evidence.contentHash,
      schemaVersion: evidence.schemaVersion || 'v24.1',
      version: evidence.version || 1
    };
    const canonical = EvidenceHashEngine.canonicalStringify(cleanObject);
    return 'eh_' + EvidenceHashEngine.sha256(canonical).substring(0, 32);
  }

  /**
   * Hashes an entire evidence chain (DAG), incorporating previous chain hash for tamper-evidence
   */
  public static computeChainHash(nodes: EvidenceNode[], edges: EvidenceEdge[], previousChainHash: string = '00000000'): string {
    // Sort nodes deterministically by nodeId
    const sortedNodes = [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    // Sort edges deterministically by edgeId
    const sortedEdges = [...edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId));

    const chainPayload = {
      previousChainHash,
      nodes: sortedNodes.map(n => ({ id: n.nodeId, evi: n.evidenceId, type: n.evidenceType, ts: n.timestamp })),
      edges: sortedEdges.map(e => ({ id: e.edgeId, src: e.sourceNodeId, tgt: e.targetNodeId, rel: e.relationship, weight: e.weight }))
    };

    const canonical = EvidenceHashEngine.canonicalStringify(chainPayload);
    return 'chain_' + EvidenceHashEngine.sha256(canonical).substring(0, 32);
  }

  /**
   * Hashes a forensic decision record
   */
  public static computeDecisionHash(decision: Partial<ForensicDecisionRecord>): string {
    const cleanDecision = {
      decisionType: decision.decisionType,
      symbol: decision.symbol || null,
      decision: decision.decision,
      confidence: decision.confidence,
      evidenceChainId: decision.evidenceChainId,
      timestamp: decision.timestamp,
      engineVersions: decision.engineVersions
    };
    const canonical = EvidenceHashEngine.canonicalStringify(cleanDecision);
    return 'dec_' + EvidenceHashEngine.sha256(canonical).substring(0, 32);
  }
}
