import React from "react";
import { 
  BookOpen, 
  Smile, 
  Cpu, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Eye, 
  Calendar, 
  Search, 
  Globe, 
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight
} from "lucide-react";
import { MarketStoryEngine } from "../services/MarketStoryEngine";
import { SectorStoryEngine } from "../services/SectorStoryEngine";
import { MarketStory as MarketStoryType } from "../types";

export default function MarketStory() {
  const [marketStory, setMarketStory] = React.useState<MarketStoryType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load dynamic data from the Intelligence Engine Services
  React.useEffect(() => {
    async function loadData() {
      try {
        const story = await MarketStoryEngine.getInstance().compileMarketStory();
        setMarketStory(story);
      } catch (error) {
        console.error("Failed to compile market story:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const sectorStories = SectorStoryEngine.getInstance().getAllSectors();

  if (isLoading || !marketStory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-mono text-xs animate-pulse tracking-widest uppercase">
          Compiling Daily Intelligence...
        </p>
      </div>
    );
  }

  // Map sector stories to view structure
  const sectors = sectorStories.map(s => ({
    name: s.sector,
    status: s.storyStatus,
    confidence: s.confidence,
    trend: s.trend
  }));

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "strong_up":
        return {
          icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
          label: "Strong Bullish",
          colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        };
      case "up":
        return {
          icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
          label: "Bullish",
          colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        };
      case "down":
        return {
          icon: <TrendingDown className="h-4 w-4 text-red-400" />,
          label: "Bearish",
          colorClass: "bg-red-500/10 border-red-500/20 text-red-400"
        };
      case "flat":
      default:
        return {
          icon: <ArrowRight className="h-4 w-4 text-slate-400" />,
          label: "Consolidating",
          colorClass: "bg-slate-800 border-slate-700 text-slate-400"
        };
    }
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 90) {
      return {
        text: "Institutional Grade",
        barColor: "bg-emerald-500",
        textColor: "text-emerald-400"
      };
    } else if (score >= 80) {
      return {
        text: "Verified Analysis",
        barColor: "bg-indigo-500",
        textColor: "text-indigo-400"
      };
    } else {
      return {
        text: "Indicative State",
        barColor: "bg-amber-500",
        textColor: "text-amber-400"
      };
    }
  };

  const getTimelineEventStyles = (type: string) => {
    const norm = type.toLowerCase();
    if (norm.includes("open") || norm.includes("covering") || norm.includes("rally") || norm.includes("recovery")) {
      return {
        bulletBorder: "border-emerald-500",
        bulletDot: "bg-emerald-400",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      };
    } else if (norm.includes("pre") || norm.includes("positioning") || norm.includes("instit")) {
      return {
        bulletBorder: "border-indigo-500",
        bulletDot: "bg-indigo-400",
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
      };
    } else {
      return {
        bulletBorder: "border-slate-700",
        bulletDot: "bg-slate-500",
        badgeClass: "bg-slate-800 text-slate-400 border-slate-700"
      };
    }
  };

  return (
    <div className="flex flex-col gap-6" id="market-story-page-root">
      
      {/* HEADER HERO BANNER */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-900 p-6 rounded-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-md font-mono font-bold tracking-wider uppercase">
              PLATFORM DAILY INTELLIGENCE
            </span>
            <h1 className="font-display font-black text-2xl md:text-3xl text-white mt-2.5 tracking-tight flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-indigo-400" />
              {marketStory.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {marketStory.summary}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-xs text-slate-500 font-mono block font-bold">DATE OF COMPILATION</span>
            <span className="text-sm font-bold text-slate-300 font-display mt-0.5 block">{marketStory.compilationDate}</span>
          </div>
        </div>
      </div>

      {/* THREE COLUMN GRID - OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Market Story */}
        <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <BookOpen className="h-4.5 w-4.5 text-indigo-400" />
              Today's Market Narrative
            </h3>
          </div>
          <div className="text-slate-300 text-xs md:text-sm leading-relaxed flex-grow">
            <p className="mb-2">
              {marketStory.narrative}
            </p>
          </div>
        </div>

        {/* Market Mood */}
        <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Smile className="h-4.5 w-4.5 text-indigo-400" />
              Market Mood
            </h3>
          </div>
          <div className="flex flex-col justify-center items-center gap-4 flex-grow py-2">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center w-full">
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">CURRENT STATE</span>
              <span className={`text-lg font-bold font-display mt-1 block ${marketStory.mood === 'BEARISH' ? 'text-red-400' : 'text-emerald-400'}`}>
                {marketStory.mood}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal text-center max-w-[240px]">
              {marketStory.moodDescription}
            </p>
          </div>
        </div>

      </div>

      {/* KEY DRIVERS & SECTOR CORNER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Key Drivers */}
        <div className="bg-slate-900/35 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Cpu className="h-4.5 w-4.5 text-indigo-400" />
              Key Drivers
            </h3>
          </div>
          <ul className="flex flex-col gap-3 flex-grow">
            {marketStory.keyDrivers?.map((driver, idx) => {
              const parts = driver.split(":");
              const title = parts[0] || "";
              const desc = parts.slice(1).join(":") || "";
              return (
                <li key={idx} className="text-xs text-slate-300 bg-slate-950/40 border border-slate-900/80 p-3 rounded-lg">
                  <span className="font-mono text-[10px] text-indigo-400 font-bold block mb-1">
                    {(idx + 1).toString().padStart(2, '0')}. {title.trim()}
                  </span>
                  {desc.trim()}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Winning Sectors */}
        <div className="bg-slate-900/35 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <ArrowUpRight className="h-4.5 w-4.5 text-emerald-400" />
              Winning Sectors
            </h3>
          </div>
          <ul className="flex flex-col gap-2.5 flex-grow">
            {marketStory.winningSectors?.slice(0, 3).map((sec, idx) => (
              <li key={idx} className="flex items-center justify-between text-xs text-slate-300 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg">
                <span className="font-medium text-slate-200">{sec.name}</span>
                <span className="font-mono text-emerald-400 font-bold">{sec.changePercent}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weak Sectors */}
        <div className="bg-slate-900/35 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <ArrowDownRight className="h-4.5 w-4.5 text-red-400" />
              Weak Sectors
            </h3>
          </div>
          <ul className="flex flex-col gap-2.5 flex-grow">
            {marketStory.weakSectors?.slice(0, 3).map((sec, idx) => (
              <li key={idx} className="flex items-center justify-between text-xs text-slate-300 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
                <span className="font-medium text-slate-200">{sec.name}</span>
                <span className="font-mono text-red-400 font-bold">{sec.changePercent}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* SECTOR SUMMARY GRID */}
      <div className="bg-slate-900/20 border border-slate-900/60 p-5 rounded-xl text-left flex flex-col gap-4" id="sector-summary-grid-section">
        <div className="border-b border-slate-900 pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-indigo-400" />
              Sector Summary Grid
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Comprehensive macro-narrative status, algorithmic trend vectors, and model factual confidence scores</p>
          </div>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider self-start md:self-auto">
            Sector Matrix
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {sectors.map((sec, idx) => {
            const trendBadge = getTrendBadge(sec.trend);
            const confInfo = getConfidenceLevel(sec.confidence);
            return (
              <div 
                key={idx}
                className="bg-slate-900/30 hover:bg-slate-900/50 border border-slate-900 hover:border-slate-850 p-4.5 rounded-xl text-left flex flex-col justify-between transition-all duration-200 gap-4"
                id={`sector-card-${idx}`}
              >
                {/* Sector Name and Trend Badge */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display font-bold text-xs text-white leading-snug">
                      {sec.name}
                    </span>
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold tracking-tight uppercase flex-shrink-0 ${trendBadge.colorClass}`}>
                      {trendBadge.icon}
                      <span>{trendBadge.label}</span>
                    </div>
                  </div>

                  {/* Story Status (Narrative) */}
                  <p className="text-[11px] text-slate-400 leading-normal font-sans">
                    {sec.status}
                  </p>
                </div>

                {/* Confidence Meter and Text */}
                <div className="border-t border-slate-950/60 pt-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Confidence:</span>
                    <span className={`font-bold ${confInfo.textColor}`}>
                      {sec.confidence}% <span className="text-[8px] text-slate-600 font-normal">({confInfo.text})</span>
                    </span>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${confInfo.barColor}`}
                      style={{ width: `${sec.confidence}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SURPRISES & WATCHLISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biggest Surprise */}
        <div className="bg-slate-900/25 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
              Biggest Surprise
            </h3>
          </div>
          <div className="bg-slate-950/40 border border-slate-900 rounded-lg p-4 text-xs text-slate-300 leading-relaxed flex-grow">
            <p>
              {marketStory.biggestSurprise}
            </p>
          </div>
        </div>

        {/* Things to Watch Tomorrow */}
        <div className="bg-slate-900/25 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Eye className="h-4.5 w-4.5 text-indigo-400" />
              Things to Watch Tomorrow
            </h3>
          </div>
          <ul className="flex flex-col gap-2.5 flex-grow">
            {marketStory.thingsToWatchTomorrow?.map((item, idx) => (
              <li key={idx} className="flex gap-2.5 items-start text-xs text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* CHRONOLOGICAL TIMELINE */}
      <div className="bg-slate-900/25 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
        <div className="border-b border-slate-900 pb-3 mb-2 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-indigo-400" />
              Chronological Market Timeline
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Chronicle of today's key macroeconomic inflection points</p>
          </div>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
            Today's Log
          </span>
        </div>
        
        <div className="relative border-l border-slate-800/80 ml-4 pl-6 md:pl-8 flex flex-col gap-6 py-3">
          {marketStory.timeline?.map((event, idx) => {
            const styles = getTimelineEventStyles(event.type);
            return (
              <div className="relative group" key={idx}>
                <span className={`absolute -left-[31px] md:-left-[39px] top-1.5 h-4 w-4 rounded-full border-2 ${styles.bulletBorder} bg-slate-950 flex items-center justify-center transition-all`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${styles.bulletDot}`}></span>
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>{event.time}</span>
                  <span className={`${styles.badgeClass} px-1.5 py-0.2 rounded border font-bold uppercase text-[9px]`}>
                    {event.type}
                  </span>
                </div>
                <h4 className="font-display font-bold text-xs text-white mt-1">{event.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  {event.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED HIDDEN STORY & GLOBAL CONTEXT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Hidden Story */}
        <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Search className="h-4.5 w-4.5 text-indigo-400" />
              Hidden Story
            </h3>
          </div>
          <div className="text-slate-300 text-xs md:text-sm leading-relaxed flex-grow">
            <p>
              {marketStory.hiddenStory}
            </p>
          </div>
        </div>

        {/* Global Context */}
        <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-xl text-left flex flex-col gap-3">
          <div className="border-b border-slate-900 pb-2.5">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Globe className="h-4.5 w-4.5 text-indigo-400" />
              Global Context
            </h3>
          </div>
          <div className="text-slate-300 text-xs md:text-sm leading-relaxed flex-grow">
            <p>
              {marketStory.globalContext}
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
