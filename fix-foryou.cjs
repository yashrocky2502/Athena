const fs = require('fs');
let code = fs.readFileSync('src/components/ForYouDashboard.tsx', 'utf-8');

const watchlistIntelLogic = `
    // 5. Watchlist Intelligence
    const watchlists = WatchlistService.getInstance().getWatchlists();
    const symbols = watchlists.flatMap(w => w.items.map(i => i.symbol));
    const uniqueSymbols = [...new Set(symbols)].slice(0, 5); // Take top 5 unique
    
    if (uniqueSymbols.length > 0) {
      const fetchWatchlistSummary = async () => {
        try {
          const res = await fetch("/api/ai/watchlist-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: uniqueSymbols })
          });
          if (res.ok) {
            const data = await res.json();
            setWatchlistIntelligence([data]); // wrap in array to use in JSX or update state type
          }
        } catch (e) {
          console.error("Failed to fetch watchlist summary", e);
        }
      };
      fetchWatchlistSummary();
    }
`;

code = code.replace(/\/\/ 5\. Watchlist Intelligence[\s\S]*?setWatchlistIntelligence\(intelligence\);/, watchlistIntelLogic);
fs.writeFileSync('src/components/ForYouDashboard.tsx', code);
