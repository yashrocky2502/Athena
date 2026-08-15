import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const NEWS_CATEGORIES = [
  'All',
  'F&O',
  'Crypto',
  'Commodities',
  'IPO',
  'Results',
  'Market',
  'Corporate',
  'Economy',
  'Global',
  'Technology',
  'Exchange',
] as const;

export type CategoryName = typeof NEWS_CATEGORIES[number];

interface NewsCategoryChipsProps {
  selectedCategory: CategoryName;
  onSelectCategory: (category: CategoryName) => void;
  categoryCounts?: Record<string, number>;
}

export const NewsCategoryChips: React.FC<NewsCategoryChipsProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categoryCounts]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full flex items-center group py-1">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 z-10 p-1.5 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 shadow-md backdrop-blur-md transition-all cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable Tabs Bar */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="w-full flex items-center gap-2 overflow-x-auto scrollbar-none no-scrollbar py-1 px-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {NEWS_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;
          const count = categoryCounts ? categoryCounts[cat] : undefined;

          return (
            <button
              key={cat}
              id={`news-category-chip-${cat.toLowerCase().replace(/[^a-z0-0]/g, '-')}`}
              onClick={() => onSelectCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 min-h-[38px] flex items-center gap-2 cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border-indigo-400/60 scale-[1.02]'
                  : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border-slate-800/90'
              }`}
            >
              <span>{cat}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-800/80 text-slate-400 group-hover:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 z-10 p-1.5 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 shadow-md backdrop-blur-md transition-all cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
