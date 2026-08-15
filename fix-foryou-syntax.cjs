const fs = require('fs');
let code = fs.readFileSync('src/components/ForYouDashboard.tsx', 'utf-8');

code = code.replace(/    \}\n\n    const interval = setInterval/, "    const interval = setInterval");
code = code.replace(/      const watchlists = WatchlistService.getInstance\(\).getWatchlists\(\);[\s\S]*?setWatchlistIntelligence\(intelligence\);\n      \}/, "");

fs.writeFileSync('src/components/ForYouDashboard.tsx', code);
