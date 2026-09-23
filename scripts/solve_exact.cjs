const fs = require("fs");
const crypto = require("crypto");

const recs = JSON.parse(fs.readFileSync("data/market_intelligence_outcomes.json", "utf8"));
const TARGET_PRIMARY_SHA = "47abe8c5948ef6e0bab2a1dec565d71dceee8b7b4941fd5b333c4bc24dffc5cd";
const TARGET_BAK_SHA = "33b17bc76094affb24c18cf7c8ea64d69081d4c28d5f21b23b39f003e39b3764";

// Identify modified indices
const modIdxs = [];
recs.forEach((r, i) => { if (r.updatedAt.startsWith("2026-09-22")) modIdxs.push(i); });

// Set up known diffs
const knownDiffs = {};
modIdxs.forEach(i => {
  if (i >= 433) knownDiffs[i] = 1;
  else if (i >= 152 && i <= 204) knownDiffs[i] = 0;
  else if (i >= 226 && i <= 228) knownDiffs[i] = 0;
  else if ([211, 219, 222, 231, 256, 335, 336, 362, 384, 385].includes(i)) knownDiffs[i] = 1;
});
const sureZero = [4, 17, 26, 29, 38, 61, 68, 70, 91, 97, 98, 116, 128, 129, 262];
sureZero.forEach(i => { knownDiffs[i] = 0; });

const groups = [
  { indices: [0], choices: [0, 1] },
  { indices: [33, 34, 35], choices: [0, 1] },
  { indices: [55], choices: [0, 1] },
  { indices: [109, 111], choices: [0, 1] },
  { indices: [206, 207], choices: [0, 1] },
  { indices: [208], choices: [0, 1] },
  { indices: [209], choices: [0, 1] },
  { indices: [268, 269], choices: [0, 1] },
  { indices: [275, 281], choices: [0, 1] },
  { indices: [288, 290], choices: [0, 1] },
  { indices: [316, 318], choices: [0, 1] },
  { indices: [323], choices: [0, 1, 16] },
  { indices: [357], choices: [0, 1, 2] },
  { indices: [358], choices: [0, 1, 2] },
  { indices: [430], choices: [0, 1, 7, 62] },
  { indices: [431], choices: [0, 1, 7, 62] }
];

console.log("Preparing pre-cleaned template...");
const templateClean = recs.map((r, i) => {
  if (!modIdxs.includes(i)) return r;
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
  
  clone.updatedAt = `__UPDATED_AT_PLACEHOLDER_${i}__`;
  return clone;
});

const fullJsonTemplate = JSON.stringify(templateClean, null, 2);

// Identify placeholder order
const placeholderRegex = /__UPDATED_AT_PLACEHOLDER_(\d+)__/g;
let match;
const orderedModIdxs = [];
while ((match = placeholderRegex.exec(fullJsonTemplate)) !== null) {
  orderedModIdxs.push(Number(match[1]));
}

const staticParts = fullJsonTemplate.split(/__UPDATED_AT_PLACEHOLDER_\d+__/);
console.log(`Split template into ${staticParts.length} static parts for ${orderedModIdxs.length} placeholders.`);

// Pre-calculate mapping from record index to ordered position
const idxToOrderedPos = {};
orderedModIdxs.forEach((recordIdx, posIdx) => {
  idxToOrderedPos[recordIdx] = posIdx;
});

// Initialize currentValues array with known diffs
const currentValues = Array(orderedModIdxs.length);
modIdxs.forEach(i => {
  if (knownDiffs[i] !== undefined) {
    const g = new Date(recs[i].generatedAt).getTime();
    const val = new Date(g + knownDiffs[i]).toISOString();
    currentValues[idxToOrderedPos[i]] = val;
  }
});

let totalCombinations = 1;
groups.forEach(g => { totalCombinations *= g.choices.length; });
console.log(`Starting optimized search over ${totalCombinations} combinations...`);

let found = false;

function search(gIdx) {
  if (found) return;
  if (gIdx === groups.length) {
    // Construct final JSON string using fast string concatenation
    let finalStr = staticParts[0];
    for (let j = 0; j < orderedModIdxs.length; j++) {
      finalStr += currentValues[j] + staticParts[j + 1];
    }

    const primarySha = crypto.createHash("sha256").update(finalStr).digest("hex");

    if (primarySha === TARGET_PRIMARY_SHA) {
      console.log("!!! EXACT MATCH FOUND !!!");
      console.log("  Primary SHA:", primarySha);
      
      const parsed = JSON.parse(finalStr);
      const bakStr = JSON.stringify(parsed.slice(0, 445), null, 2);
      const bakSha = crypto.createHash("sha256").update(bakStr).digest("hex");
      console.log("  BAK SHA:    ", bakSha);
      console.log("  BAK Match:  ", bakSha === TARGET_BAK_SHA);
      
      fs.writeFileSync("data/market_intelligence_outcomes.json", finalStr, "utf8");
      fs.writeFileSync("data/market_intelligence_outcomes.json.bak", bakStr, "utf8");
      console.log("Successfully restored dataset files to disk!");
      found = true;
    }
    return;
  }

  const group = groups[gIdx];
  const choices = group.choices;
  for (const choice of choices) {
    // Set updatedAt string for each index in the group
    for (const idx of group.indices) {
      const g = new Date(recs[idx].generatedAt).getTime();
      const val = new Date(g + choice).toISOString();
      currentValues[idxToOrderedPos[idx]] = val;
    }
    search(gIdx + 1);
    if (found) break;
  }
}

const startTime = Date.now();
search(0);
console.log(`Search finished in ${Date.now() - startTime}ms`);
if (!found) {
  console.log("FAIL: No match found.");
}
