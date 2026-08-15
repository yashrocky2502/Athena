import { useState, useEffect } from "react";

export function useHistoricalData(symbol: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData([]);
    setLoading(true);
    async function fetchData() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(`/api/historical-data?symbol=${encodeURIComponent(symbol)}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const historicalData = await response.json();
        setData(historicalData);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error("Historical data fetch timed out");
        } else {
          console.error("Error fetching historical data:", error);
        }
        setData([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol]);

  return { data, loading };
}
