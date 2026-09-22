const fs = require("fs");
const path = require("path");
const { Worker, isMainThread, workerData, parentPort } = require("worker_threads");
const crypto = require("crypto");

const TARGET_BAK_SHA = "33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764";
const TARGET_PRIMARY_SHA = "47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd";

if (isMainThread) {
  console.log("Master starting 4 workers...");
  let done = false;
  const numWorkers = 4;
  for (let w = 0; w < numWorkers; w++) {
    const worker = new Worker(__filename, { workerData: { workerId: w, numWorkers } });
    worker.on("message", (msg) => {
      if (msg.success && !done) {
        done = true;
        console.log("Worker found match! Saving files...");
        fs.writeFileSync("data/market_intelligence_outcomes.json.bak", msg.bakStr, "utf8");
        fs.writeFileSync("data/market_intelligence_outcomes.json", msg.primStr, "utf8");
        console.log("Files written successfully!");
        process.exit(0);
      }
    });
  }
} else {
  const { workerId, numWorkers } = workerData;
  const rawData = fs.readFileSync("data/market_intelligence_outcomes.json", "utf8");
  const records = JSON.parse(rawData);

  function cleanRecord(r) {
    const c = JSON.parse(JSON.stringify(r));
    c.mfePercent = 0; c.maePercent = 0; c.mfeAbsolute = 0; c.maeAbsolute = 0;
    c.peakPrice = c.initialPrice; c.troughPrice = c.initialPrice;
    c.maxFavorablePrice = c.initialPrice; c.maxAdversePrice = c.initialPrice;
    c.lastObservedPrice = c.initialPrice; c.lastObservedTimestamp = c.generatedAt;
    c.observationCount = 0; c.timeBuckets = {};
    c.outcome = "INSUFFICIENT_MARKET_DATA"; c.directionalAccuracy = "UNRESOLVED";
    c.isCorrect = false; c.isResolved = false;
    c.priorityAccuracy = "PENDING_EVALUATION"; c.lifecyclePredictionAccuracy = "PENDING_DATA";
    delete c.resolutionType; delete c.resolutionTimestamp;
    delete c.resolutionTimeSeconds; delete c.timeToTargetSeconds; delete c.mfeTimestamp;
    if (c.timeline && c.timeline.length > 0) c.timeline = [c.timeline[0]];
    return c;
  }

  const baseClean = records.map(r => cleanRecord(r));

  const varRecs = {
    0: [0, 1],
    33: [0, 1], 34: [0, 1], 35: [0, 1],
    55: [0, 1], 109: [0, 1], 111: [0, 1],
    206: [0, 1], 207: [0, 1], 208: [0, 1], 209: [0, 1],
    268: [0, 1], 269: [0, 1], 275: [0, 1],
    281: [0, 1], 288: [0, 1], 290: [0, 1],
    316: [0, 1], 318: [0, 1], 323: [1, 16],
    357: [1, 2], 358: [1, 2],
    430: [7, 62], 431: [7, 62],
    433: [1, 62], 434: [1, 62], 435: [1, 62], 436: [1, 62], 437: [1, 62],
    439: [1], 440: [1], 441: [1], 442: [1], 443: [1], 444: [1], 445: [1]
  };

  const fixedDiffs = {
    4: 0, 17: 0, 26: 0, 29: 0, 38: 0, 61: 0, 68: 0, 70: 0, 91: 0, 97: 0, 98: 0,
    116: 0, 128: 0, 129: 0, 152: 0, 153: 0, 154: 0, 155: 0, 157: 0, 158: 0, 159: 0,
    160: 0, 162: 0, 163: 0, 164: 0, 165: 0, 167: 0, 168: 0, 169: 0, 170: 0, 172: 0,
    173: 0, 204: 0, 226: 0, 227: 0, 228: 0, 262: 0,
    211: 1, 219: 1, 222: 1, 231: 1, 256: 1, 335: 1, 336: 1, 362: 1, 384: 1, 385: 1
  };

  const c1Indices = [0, 33, 34, 35, 55, 109, 111, 206, 207, 208, 209];
  const c2Indices = [268, 269, 275, 281, 288, 290, 316, 318, 323];
  const c3Indices = [357, 358, 430, 431, 433, 434, 435, 436, 437];

  function buildChunkString(startIdx, endIdx, varIndices, mask) {
    const parts = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const r = baseClean[i];
      let diff = 0;
      if (records[i].updatedAt.startsWith("2026-09-22")) {
        const vIdx = varIndices.indexOf(i);
        if (vIdx !== -1) {
          const bit = (mask >> vIdx) & 1;
          diff = varRecs[i][bit];
        } else if (varRecs[i]) {
          diff = varRecs[i][0];
        } else if (fixedDiffs[i] !== undefined) {
          diff = fixedDiffs[i];
        }
        const rec = { ...r, updatedAt: new Date(new Date(r.generatedAt).getTime() + diff).toISOString() };
        parts.push(JSON.stringify(rec, null, 2));
      } else {
        parts.push(JSON.stringify(r, null, 2));
      }
    }
    return parts.join(",\n  ");
  }

  const c1Options = [];
  for (let m = 0; m < (1 << c1Indices.length); m++) {
    c1Options.push("[\n  " + buildChunkString(0, 220, c1Indices, m) + ",\n  ");
  }

  const c2Options = [];
  for (let m = 0; m < (1 << c2Indices.length); m++) {
    c2Options.push(buildChunkString(221, 330, c2Indices, m) + ",\n  ");
  }

  const c3Options = [];
  for (let m = 0; m < (1 << c3Indices.length); m++) {
    c3Options.push(buildChunkString(331, 444, c3Indices, m) + "\n]");
  }

  for (let i1 = workerId; i1 < c1Options.length; i1 += numWorkers) {
    const s1 = c1Options[i1];
    for (let i2 = 0; i2 < c2Options.length; i2++) {
      const s12 = s1 + c2Options[i2];
      for (let i3 = 0; i3 < c3Options.length; i3++) {
        const fullBakStr = s12 + c3Options[i3];
        const sha = crypto.createHash("sha256").update(fullBakStr).digest("hex");
        if (sha === TARGET_BAK_SHA) {
          const r445 = baseClean[445];
          const rec445 = { ...r445, updatedAt: new Date(new Date(r445.generatedAt).getTime() + 1).toISOString() };
          const s445 = JSON.stringify(rec445, null, 2);
          const fullPrimStr = fullBakStr.slice(0, -2) + ",\n  " + s445 + "\n]";
          parentPort.postMessage({ success: true, bakStr: fullBakStr, primStr: fullPrimStr });
          process.exit(0);
        }
      }
    }
  }
}
