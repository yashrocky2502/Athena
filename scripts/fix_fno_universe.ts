import fs from 'fs';

let content = fs.readFileSync('src/newsCoreV2/fno/FNOUniverse.ts', 'utf8');
const oldBlock = `      if (alias.length < 3) {
        // Exact word boundary check for short aliases like "VI", "L&T", "SBI"
        const aliasRegex = new RegExp(\`\\\\b\${escapeRegExp(alias)}\\\\b\`, "i");
        if (aliasRegex.test(headline)) {
          return { company, matchedAlias: alias };
        }
      } else {
        if (lowerHeadline.includes(alias.toLowerCase())) {
          return { company, matchedAlias: alias };
        }
      }`;
const newBlock = `      // Exact word boundary check for all aliases
      const aliasRegex = new RegExp(\`\\\\b\${escapeRegExp(alias)}\\\\b\`, "i");
      if (aliasRegex.test(headline)) {
        return { company, matchedAlias: alias };
      }`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('src/newsCoreV2/fno/FNOUniverse.ts', content);
