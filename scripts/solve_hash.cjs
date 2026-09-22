const fs = require("fs");
const crypto = require("crypto");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

const TARGET_PRIMARY_SHA = "47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd";
const TARGET_BAK_SHA = "33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764";

if (isMainThread) {
  const recs = JSON.parse(fs.readFileSync("data/market_intelligence_outcomes.json", "utf8"));
  const secondBatches = new Map();
  recs.forEach((r, idx) => {
    if (r.updatedAt.startsWith("2026-09-22")) {
      const key = r.generatedAt.slice(0, 19);
      if (!secondBatches.has(key)) secondBatches.set(key, []);
      secondBatches.get(key).push(idx);
    }
  });

  const batchKeys = Array.from(secondBatches.keys());
  const total = 1 << batchKeys.length; // 65536
  const numWorkers = 8;
  const chunkSize = Math.ceil(total / numWorkers);

  console.log(`Main thread launching ${numWorkers} workers for ${total} combinations...`);

  let completedWorkers = 0;
  let found = false;

  for (let i = 0; i < numWorkers; i++) {
    const startMask = i * chunkSize;
    const endMask = Math.min((i + 1) * chunkSize, total);

    const worker = new Worker(__filename, {
      workerData: { startMask, endMask, batchKeys, recs }
    });

    worker.on("message", (msg) => {
      if (msg.success) {
        found = true;
        console.log("MATCH FOUND BY WORKER!", msg);
        fs.writeFileSync("data/market_intelligence_outcomes.json", msg.primaryStr, "utf8");
        fs.writeFileSync("data/market_intelligence_outcomes.json.bak", msg.bakStr, "utf8");
        console.log("Written restored files successfully!");
        process.exit(0);
      }
    });

    worker.on("exit", () => {
      completedWorkers++;
      if (completedWorkers === numWorkers && !found) {
        console.log("All workers finished. No match found.");
      }
    });
  }
} else {
  const { startMask, endMask, batchKeys, recs } = workerData;

  for (let mask = startMask; mask < endMask; mask++) {
    const batchOffsets = {};
    batchKeys.forEach((key, i) => {
      batchOffsets[key] = (mask & (1 << i)) ? 1 : 0;
    });

    const clean = recs.map((r, idx) => {
      if (!r.updatedAt.startsWith("2026-09-22")) return r;

      const clone = { ...r };
      delete clone.resolutionType;
      delete clone.resolutionTimestamp;
      delete clone.resolutionTimeSeconds;
      delete clone.timeToInvalidationSeconds;
      delete clone.mfeTimestamp;
      delete clone.maeTimestamp;
      delete clone.mfePrice;
      delete clone.maePrice;

      clone.mfePercent = 0;
      clone.maePercent = 0;
      clone.mfeAbsolute = 0;
      clone.maeAbsolute = 0;
      clone.peakPrice = clone.initialPrice;
      clone.troughPrice = clone.initialPrice;
      clone.maxFavorablePrice = clone.initialPrice;
      clone.maxAdversePrice = clone.initialPrice;
      clone.lastObservedPrice = clone.initialPrice;
      clone.lastObservedTimestamp = clone.generatedAt;
      clone.observationCount = 0;
      clone.timeBuckets = {};
      clone.outcome = "INSUFFICIENT_MARKET_DATA";
      clone.directionalAccuracy = "UNRESOLVED";
      clone.isCorrect = false;
      clone.isResolved = false;
      clone.priorityAccuracy = "PENDING_EVALUATION";
      clone.lifecyclePredictionAccuracy = "PENDING_DATA";
      clone.timeline = [clone.timeline[0]];

      const key = clone.generatedAt.slice(0, 19);
      const offset = batchOffsets[key];
      const g = new Date(clone.generatedAt).getTime();
      clone.updatedAt = new Date(g + offset).toISOString();

      return clone;
    });

    const primaryStr = JSON.stringify(clean, null, 2);
    const primarySha = crypto.createHash("sha256").update(primaryStr).digest("hex");

    if (primarySha === TARGET_PRIMARY_SHA) {
      const bakStr = JSON.stringify(clean.slice(0, 445), null, 2);
      const bakSha = crypto.createHash("sha256").update(bakStr).digest("hex");
      parentPort.postMessage({ success: true, mask, primarySha, bakSha, primaryStr, bakStr });
      break;
    }
  }
}
