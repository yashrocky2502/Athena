import React, { useState } from 'react';
import { MaximizeButton } from './MaximizeButton';
import { ChartFullscreen } from './ChartFullscreen';
import { ChartCore } from './ChartCore';

interface ChartProps {
  data: { time: string; open: number; high: number; low: number; close: number }[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
  symbol: string;
  title?: string;
  price?: number;
  changePercent?: number;
  isFullscreen?: boolean;
  currency?: string;
}

export const TradingViewChart: React.FC<ChartProps> = (props) => {
  const {
    data,
    colors = {},
    symbol,
    title = "Market Data",
    price = 0,
    changePercent = 0,
    isFullscreen = false,
    currency = '₹'
  } = props;

  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <div className={`relative w-full group ${isFullscreen ? 'h-full' : ''}`} style={{ height: isFullscreen ? '100%' : 'auto' }}>
      <ChartCore 
        data={data} 
        isFullscreen={isFullscreen}
        colors={colors}
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
