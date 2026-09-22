const fs = require("fs");
const crypto = require("crypto");

const recs = JSON.parse(fs.readFileSync("data/market_intelligence_outcomes.json", "utf8"));
const TARGET_PRIMARY_SHA = "47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd";
const TARGET_BAK_SHA = "33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764";

// Define the 13 clusters
const clusters = [
  [0],
  [4],
  [17],
  [26, 29, 33, 34, 35, 38],
  [55, 61, 68, 70],
  [91, 97, 98],
  [109, 111, 116, 128, 129],
  [152, 153, 154, 155, 157, 158, 159, 160, 162, 163, 164, 165, 167, 168, 169, 170, 172, 173],
  [204, 206, 207, 208, 209, 211, 219, 222, 226, 227, 228, 231],
  [256, 262, 268, 269, 275, 281, 288, 290],
  [316, 318, 323, 335, 336],
  [357, 358, 362, 384, 385],
  [430, 431, 433, 434, 435, 436, 437, 439, 440, 441, 442, 443, 444, 445]
];

console.log(`Testing 2^${clusters.length} = ${1 << clusters.length} cluster combinations...`);

let found = false;
const total = 1 << clusters.length;

for (let mask = 0; mask < total; mask++) {
  const clusterOffsets = clusters.map((_, i) => (mask & (1 << i)) ? 1 : 0);

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

    // Find cluster index
    const cIdx = clusters.findIndex(c => c.includes(idx));
    const offset = cIdx !== -1 ? clusterOffsets[cIdx] : 0;
    const g = new Date(clone.generatedAt).getTime();
    clone.updatedAt = new Date(g + offset).toISOString();

    return clone;
  });

  const primaryStr = JSON.stringify(clean, null, 2);
  const primarySha = crypto.createHash("sha256").update(primaryStr).digest("hex");

  if (primarySha === TARGET_PRIMARY_SHA) {
    const bakStr = JSON.stringify(clean.slice(0, 445), null, 2);
    const bakSha = crypto.createHash("sha256").update(bakStr).digest("hex");
    console.log("EXACT MATCH FOUND!", { mask, primarySha, bakSha, bakMatch: bakSha === TARGET_BAK_SHA });
    fs.writeFileSync("data/market_intelligence_outcomes.json", primaryStr, "utf8");
    fs.writeFileSync("data/market_intelligence_outcomes.json.bak", bakStr, "utf8");
    console.log("Written restored files successfully!");
    found = true;
    break;
  }
}

if (!found) {
  console.log("No match found with uniform cluster offsets.");
}
