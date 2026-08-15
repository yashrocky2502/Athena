import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface ChartCoreProps {
  data: any[];
  height?: number;
  isFullscreen?: boolean;
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
  };
  showVolume?: boolean;
}

export const ChartCore: React.FC<ChartCoreProps> = ({ 
  data, 
  height = 300, 
  isFullscreen = false,
  colors = { backgroundColor: 'transparent', textColor: '#94a3b8' },
  showVolume = true
}) => {
  const backgroundColor = colors.backgroundColor || 'transparent';
  const textColor = colors.textColor || '#94a3b8';

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor: textColor,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      width: chartContainerRef.current.clientWidth,
      height: isFullscreen ? chartContainerRef.current.clientHeight : height,
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
    });
    
    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    
    seriesRef.current = candlestickSeries;

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // set as an overlay
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8, // volume at the bottom 20% of the chart
          bottom: 0,
        },
      });

      volumeSeriesRef.current = volumeSeries;
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: isFullscreen ? chartContainerRef.current.clientHeight : height
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height, isFullscreen, backgroundColor, textColor, showVolume]);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      seriesRef.current.setData(data.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(data.map(d => ({
          time: d.time,
          value: d.volume || 0,
          color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        })));
      }

      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
