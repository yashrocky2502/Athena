import React from 'react';
import { Maximize2 } from 'lucide-react';

interface MaximizeButtonProps {
  onClick: () => void;
  className?: string;
}

export const MaximizeButton: React.FC<MaximizeButtonProps> = ({ onClick, className = "" }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-9 w-9 flex items-center justify-center bg-slate-900/40 backdrop-blur-md hover:bg-indigo-500/20 text-slate-400 hover:text-white rounded-full border border-white/10 hover:border-indigo-500/30 transition-all duration-300 active:scale-90 group shadow-xl ${className}`}
      title="Maximize Chart"
    >
      <Maximize2 size={16} className="group-hover:scale-110 transition-transform duration-300" />
    </button>
  );
};
