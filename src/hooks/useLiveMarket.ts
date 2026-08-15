import { useState, useEffect, useRef } from "react";
import { LiveMarketEngine } from "../services/LiveMarketEngine";
import { MarketIndex, TrendingStock } from "../types";

export function useLiveMarket(
  symbols: string[],
  type: "index" | "watchlist" | "company" | "portfolio" | "background"
) {
  const [stocks, setStocks] = useState<TrendingStock[]>([]);
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const symbolsRef = useRef<string[]>(symbols);

  // Keep ref updated to compare array equality
  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbols]);

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const engine = LiveMarketEngine.getInstance();

    // 1. Hydrate from Cache immediately
    const initialStocks: TrendingStock[] = [];
    const initialIndices: MarketIndex[] = [];

    symbols.forEach(sym => {
      const cached = engine.getCachedValue(sym);
      if (cached) {
        if (type === "index") {
          initialIndices.push(cached);
        } else {
          initialStocks.push(cached);
        }
      }
    });

    if (initialStocks.length > 0) {
      setStocks(initialStocks);
    } else {
      setStocks([]);
    }

    if (initialIndices.length > 0) {
      setIndices(initialIndices);
    } else {
      setIndices([]);
    }

    // 2. Subscribe to Live Stream
    const subId = engine.subscribe({
      type,
      symbols,
      callback: (data) => {
        if (data.stocks && data.stocks.length > 0) {
          setStocks(prev => {
            const next = [...prev];
            data.stocks.forEach(newStock => {
              const idx = next.findIndex(s => s.symbol === newStock.symbol);
              if (idx !== -1) {
                next[idx] = newStock;
              } else {
                next.push(newStock);
              }
            });
            return next;
          });
        }

        if (data.indices && data.indices.length > 0) {
          setIndices(prev => {
            const next = [...prev];
            data.indices.forEach(newInd => {
              const key = newInd.symbol || newInd.name;
              const idx = next.findIndex(i => (i.symbol || i.name) === key);
              if (idx !== -1) {
                next[idx] = newInd;
              } else {
                next.push(newInd);
              }
            });
            return next;
          });
        }
      }
    });

    return () => {
      engine.unsubscribe(subId);
    };
  }, [JSON.stringify(symbols), type]);

  return { stocks, indices };
}
