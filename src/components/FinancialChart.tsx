import React, { useState } from 'react';
import { MaximizeButton } from './MaximizeButton';
import { ChartFullscreen } from './ChartFullscreen';
import { ChartCore } from './ChartCore';

interface FinancialChartProps {
  data: any[]; // Expecting { time: string, open: number, high: number, low: number, close: number }
  height?: number;
  symbol?: string;
  title?: string;
  price?: number;
  changePercent?: number;
  isFullscreen?: boolean;
  currency?: string;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ 
  data, 
  height = 300,
  symbol = "UNKNOWN",
  title = "Market Data",
  price = 0,
  changePercent = 0,
  isFullscreen = false,
  currency = '₹'
}) => {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <div className={`w-full relative group ${isFullscreen ? 'h-full' : ''}`} style={{ height: isFullscreen ? '100%' : height }}>
      <ChartCore 
        data={data} 
        height={height} 
        isFullscreen={isFullscreen} 
      />
      
      {!isFullscreen && (
        <>
          <div className="absolute top-3 right-3 z-20">
            <MaximizeButton 
              onClick={() => setShowFullscreen(true)} 
            />
          </div>
          <ChartFullscreen
            isOpen={showFullscreen}
            onClose={() => setShowFullscreen(false)}
            symbol={symbol}
            title={title}
            price={price}
            changePercent={changePercent}
            data={data}
            currency={currency}
          />
        </>
      )}
    </div>
  );
};
