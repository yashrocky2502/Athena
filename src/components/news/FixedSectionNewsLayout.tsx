import React, { useState, useEffect } from 'react';
import { 
  Flame, TrendingUp, BarChart3, Zap, Landmark, Building2, 
  Scale, Coins, Gem, Globe2, Laptop, PiggyBank, Layers, 
  Tag, Compass, ExternalLink, ChevronRight, Clock, ShieldCheck, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { NewsSectionId, getAllSectionDefinitions } from '../../news/types/NewsSection';
import { NewsCard } from './NewsCard';

interface FixedSectionNewsLayoutProps {
  onOpenArticle: (article: any) => void;
  developerMode?: boolean;
}

const SECTION_ICONS: Record<NewsSectionId, React.ReactNode> = {
  [NewsSectionId.BREAKING]: <Flame className="w-5 h-5 text-rose-500 animate-pulse" />,
  [NewsSectionId.MARKET]: <TrendingUp className="w-5 h-5 text-emerald-400" />,
  [NewsSectionId.RESULTS]: <BarChart3 className="w-5 h-5 text-indigo-400" />,
  [NewsSectionId.FNO]: <Zap className="w-5 h-5 text-amber-400" />,
  [NewsSectionId.ECONOMY]: <Landmark className="w-5 h-5 text-cyan-400" />,
  [NewsSectionId.CORPORATE]: <Building2 className="w-5 h-5 text-blue-400" />,
  [NewsSectionId.IPO]: <Coins className="w-5 h-5 text-purple-400" />,
  [NewsSectionId.REGULATORY]: <Scale className="w-5 h-5 text-rose-400" />,
  [NewsSectionId.EXCHANGE]: <Layers className="w-5 h-5 text-teal-400" />,
  [NewsSectionId.COMMODITIES]: <Gem className="w-5 h-5 text-yellow-400" />,
  [NewsSectionId.GLOBAL]: <Globe2 className="w-5 h-5 text-sky-400" />,
  [NewsSectionId.TECHNOLOGY]: <Laptop className="w-5 h-5 text-violet-400" />,
  [NewsSectionId.BANKING]: <PiggyBank className="w-5 h-5 text-emerald-300" />,
  [NewsSectionId.SECTORS]: <Compass className="w-5 h-5 text-orange-400" />,
  [NewsSectionId.STOCKS]: <Tag className="w-5 h-5 text-pink-400" />,
  [NewsSectionId.MACRO]: <Landmark className="w-5 h-5 text-indigo-300" />,
};

export const FixedSectionNewsLayout: React.FC<FixedSectionNewsLayoutProps> = ({
  onOpenArticle,
  developerMode
}) => {
  const [sectionsMeta, setSectionsMeta] = useState<any[]>([]);
  const [sectionFeeds, setSectionFeeds] = useState<Record<string, { articles: any[]; totalCount: number; explanation: string }>>({});
  const [activeSectionView, setActiveSectionView] = useState<NewsSectionId | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeSectionFeedData, setActiveSectionFeedData] = useState<any | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [loadingSectionFeed, setLoadingSectionFeed] = useState<boolean>(false);

  // Load section taxonomy and top items for main sections
  useEffect(() => {
    const loadAllSections = async () => {
      setLoading(true);
      try {
        const secDefs = getAllSectionDefinitions();
        setSectionsMeta(secDefs);

        const feedMap: Record<string, { articles: any[]; totalCount: number; explanation: string }> = {};

        // Fetch top 4 articles per section in parallel
        await Promise.all(
          secDefs.map(async (sec) => {
            try {
              const res = await fetch(`/api/v5/news/feed/section/${sec.id}?page=1&limit=4`);
              if (res.ok) {
                const data = await res.json();
                feedMap[sec.id] = {
                  articles: data.articles || [],
                  totalCount: data.totalCount || 0,
                  explanation: data.explanation || sec.explanation
                };
              }
            } catch (err) {
              console.warn(`Failed to load section ${sec.id}:`, err);
            }
          })
        );

        setSectionFeeds(feedMap);
      } catch (err) {
        console.error('Failed to load fixed sections:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAllSections();
  }, []);

  // Fetch full section feed when a user clicks "View All"
  const handleViewSectionAll = async (secId: NewsSectionId, page = 1) => {
    setActiveSectionView(secId);
    setActivePage(page);
    setLoadingSectionFeed(true);
    try {
      const res = await fetch(`/api/v5/news/feed/section/${secId}?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setActiveSectionFeedData(data);
      }
    } catch (err) {
      console.error(`Failed to load section feed for ${secId}:`, err);
    } finally {
      setLoadingSectionFeed(false);
    }
  };

  const breakingData = sectionFeeds[NewsSectionId.BREAKING] || { articles: [], totalCount: 0, explanation: '' };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-xs font-medium">Initializing Fixed News Sections & Intelligence Router...</span>
      </div>
    );
  }

  // Active full section view modal / layout
  if (activeSectionView && activeSectionFeedData) {
    const secDef = sectionsMeta.find(s => s.id === activeSectionView);
    return (
      <div className="flex flex-col gap-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/60">
              {SECTION_ICONS[activeSectionView]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">{secDef?.name || activeSectionView}</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono">
                  {activeSectionFeedData.totalCount} Articles
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeSectionFeedData.explanation}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveSectionView(null);
              setActiveSectionFeedData(null);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            ← Back to All Sections
          </button>
        </div>

        {loadingSectionFeed ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading section feed...</span>
          </div>
        ) : activeSectionFeedData.articles.length === 0 ? (
          <div className="p-8 bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs rounded-2xl">
            No articles currently routed to this section.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSectionFeedData.articles.map((article: any) => (
              <NewsCard key={article.id} article={article} onOpenArticleContent={onOpenArticle} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {activeSectionFeedData.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 my-4">
            <button
              disabled={activePage <= 1}
              onClick={() => handleViewSectionAll(activeSectionView, activePage - 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 font-mono">
              Page {activePage} of {activeSectionFeedData.totalPages}
            </span>
            <button
              disabled={activePage >= activeSectionFeedData.totalPages}
              onClick={() => handleViewSectionAll(activeSectionView, activePage + 1)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. HIGH PRIORITY BREAKING NEWS BANNER OVERLAY */}
      {breakingData.articles.length > 0 && (
        <section className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border border-rose-500/30 p-4 sm:p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Flame className="w-4 h-4 animate-bounce" />
              </span>
              <h2 className="font-extrabold text-sm sm:text-base text-rose-200 tracking-wide uppercase">
                🔥 BREAKING NEWS OVERLAY
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-semibold">
                {breakingData.totalCount} Urgent
              </span>
            </div>
            <button
              onClick={() => handleViewSectionAll(NewsSectionId.BREAKING)}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {breakingData.articles.slice(0, 2).map((article: any) => (
              <div
                key={article.id}
                onClick={() => onOpenArticle(article)}
                className="bg-slate-900/90 border border-rose-500/20 hover:border-rose-500/50 p-3.5 rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-rose-300">{article.publisher}</span>
                    <span className="font-mono">{article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-2 leading-snug">
                    {article.headline || article.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {article.tickers && article.tickers.slice(0, 3).map((t: string) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20">
                    HIGH IMPACT
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. GRID OF FIXED SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sectionsMeta
          .filter(sec => sec.id !== NewsSectionId.BREAKING)
          .map((sec) => {
            const secData = sectionFeeds[sec.id] || { articles: [], totalCount: 0, explanation: sec.explanation };
            return (
              <div
                key={sec.id}
                className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg backdrop-blur-md transition-all"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                      {SECTION_ICONS[sec.id as NewsSectionId]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-slate-100">{sec.name}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
                          {secData.totalCount}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{secData.explanation}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewSectionAll(sec.id)}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Top Articles List */}
                <div className="flex flex-col gap-2.5">
                  {secData.articles.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">No active articles in this section</p>
                  ) : (
                    secData.articles.slice(0, 3).map((article: any) => (
                      <div
                        key={article.id}
                        onClick={() => onOpenArticle(article)}
                        className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/60 transition-all cursor-pointer flex items-start justify-between gap-3 group"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                            {article.headline || article.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="font-medium text-slate-300">{article.publisher}</span>
                            <span>•</span>
                            <span className="font-mono">{article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                            {article.isFnO && (
                              <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono font-semibold border border-amber-500/20">
                                F&O
                              </span>
                            )}
                          </div>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0 transition-colors mt-0.5" />
                      </div>
                    ))
                  )}
                </div>

                {/* Section Footer */}
                {sec.id === NewsSectionId.FNO && (
                  <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-center justify-between">
                    <span>Derivatives volatility & directional bias analytics active</span>
                    <span className="font-mono font-semibold text-amber-400">F&O SECTION</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
