import React from 'react';

export const NewsSkeletonLoader: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((idx) => (
        <div
          key={idx}
          className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-800 rounded-full" />
              <div className="w-24 h-4 bg-slate-800 rounded" />
            </div>
            <div className="w-16 h-3 bg-slate-800 rounded" />
          </div>

          <div className="w-3/4 h-5 bg-slate-800 rounded" />
          <div className="w-full h-4 bg-slate-800/60 rounded" />
          <div className="w-5/6 h-4 bg-slate-800/60 rounded" />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-5 bg-slate-800 rounded-full" />
              <div className="w-12 h-5 bg-slate-800 rounded-full" />
            </div>
            <div className="w-20 h-7 bg-slate-800 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
};
