import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NewsCategoryChips, CategoryName } from './news/NewsCategoryChips';
import { NewsCard } from './news/NewsCard';
import { ArticleReader } from './news/ArticleReader';
import { NewsSkeletonLoader } from './news/NewsSkeletonLoader';
import { NewsDiagnosticsPanel, formatISTTime } from './NewsDiagnosticsPanel';
import { safeLocalStorage } from '../services/storage/safeStorage';
import { 
  Newspaper, RefreshCw, AlertCircle, 
  Search, Clock, X, Activity, CheckCircle2, AlertTriangle,
  BookOpen, ExternalLink, Cpu, Radio, Sparkles
} from 'lucide-react';

type SentimentFilter = 'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type CategoryFeedState = {
  articles: any[];
  page: number;
  totalPages: number;
  totalCount: number;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  requestGeneration: number;
};

const ALL_CATEGORIES: CategoryName[] = [
  'All', 'Results', 'Crypto', 'IPO', 'F&O', 'Economy',
  'Market', 'Corporate', 'Commodities', 'Global', 'Technology', 'Exchange'
];

export default function NewsPage({ developerMode = false }: { developerMode?: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryName>('All');
  const selectedCategoryRef = useRef<CategoryName>(selectedCategory);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Isolated Category Feed States
  const [categoryFeeds, setCategoryFeeds] = useState<Record<string, CategoryFeedState>>(() => {
    const initial: Record<string, CategoryFeedState> = {};
    for (const cat of ALL_CATEGORIES) {
      initial[cat] = {
        articles: [],
        page: 1,
        totalPages: 1,
        totalCount: 0,
        loading: true,
        error: null,
        lastFetchedAt: null,
        requestGeneration: 0
      };
    }
    return initial;
  });

  // Streaming & Status State
  const [streamStatus, setStreamStatus] = useState<"CONNECTED" | "RECONNECTING" | "OFFLINE">("CONNECTED");
  const [newArticlesCount, setNewArticlesCount] = useState<number>(0);
  const [breakingNewsArticle, setBreakingNewsArticle] = useState<any | null>(null);

  // Diagnostics Modal & Live Push Toast State
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [livePushToast, setLivePushToast] = useState<{ count: number; headline: string; publisher: string; time: string } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Metrics Modal state
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Lazy Rendering State (per-category view slice)
  const [visibleCount, setVisibleCount] = useState(50);
  const [serverCategoryCounts, setServerCategoryCounts] = useState<Record<string, number>>({});

  // V2 News Feed Lifecycle and Sync State
  const [lifecycleState, setLifecycleState] = useState<'IDLE' | 'HYDRATING_CACHE' | 'SYNCING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [lastCacheWriteAt, setLastCacheWriteAt] = useState<string | null>(null);
  const [lastSuccessfulAutoSyncAt, setLastSuccessfulAutoSyncAt] = useState<string | null>(() => {
    return safeLocalStorage.getItem('athena_last_successful_auto_sync') || null;
  });

  // Manual Sync & Auto Sync Telemetry State
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastManualSync, setLastManualSync] = useState<Date | null>(() => {
    const saved = safeLocalStorage.getItem('athena_last_manual_sync');
    return saved ? new Date(saved) : null;
  });
  const [nextAutoSyncSec, setNextAutoSyncSec] = useState<number>(60);
  const [syncNotification, setSyncNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const lastSeenServerSyncRef = useRef<string | null>(null);
  const feedAbortControllersRef = useRef<Record<string, AbortController>>({});
  const categoryRequestGenerationRef = useRef<Record<string, number>>({});

  // Article Reader Modal State
  const [activeArticle, setActiveArticle] = useState<any | null>(null);
  const [activeArticleContent, setActiveArticleContent] = useState<any | null>(null);
  const [loadingActiveContent, setLoadingActiveContent] = useState<boolean>(false);
  const [errorActiveContent, setErrorActiveContent] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // Fetch V2 Sync Status using selectedCategoryRef.current to avoid stale closures
  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("/api/v4/news/status");
      if (res.ok) {
        const data = await res.json();
        setStreamStatus("CONNECTED");
        if (data.lastSuccessfulSyncAt && data.lastSuccessfulSyncAt !== lastSeenServerSyncRef.current) {
          lastSeenServerSyncRef.current = data.lastSuccessfulSyncAt;
          setLastSuccessfulAutoSyncAt(data.lastSuccessfulSyncAt);
          safeLocalStorage.setItem('athena_last_successful_auto_sync', data.lastSuccessfulSyncAt);
          const activeCat = selectedCategoryRef.current;
          loadNewsFeed(1, activeCat, false);
        }
      }
    } catch (err) {
      console.warn("[NewsPage] V2 status check warning:", err);
    }
  };

  // Canonical Feed Integrity Guard
  const assertCanonicalFeedIntegrity = (articlesList: any[], requestedCategory: string) => {
    if (!requestedCategory || requestedCategory.toLowerCase() === 'all') {
      return { valid: true, mixedCount: 0, validArticles: articlesList };
    }
    const target = requestedCategory.toLowerCase();
    let mixedCount = 0;
    const validArticles = articlesList.filter(art => {
      const primary = (art.primaryCategory || art.category || '').toLowerCase();
      if (target === 'f&o' || target === 'fno') {
        const isFno = art.fno?.eligible || art.isFO;
        if (!isFno) mixedCount++;
        return isFno;
      }
      const matches = primary === target;
      if (!matches) mixedCount++;
      return matches;
    });
    return { valid: mixedCount === 0, mixedCount, validArticles };
  };

  // Primary V2 Category-Isolated News Feed Loader
  const loadNewsFeed = async (pageToLoad = 1, categoryToLoad = selectedCategory, append = false) => {
    if (!categoryRequestGenerationRef.current[categoryToLoad]) {
      categoryRequestGenerationRef.current[categoryToLoad] = 0;
    }
    const requestGeneration = ++categoryRequestGenerationRef.current[categoryToLoad];

    setCategoryFeeds(prev => ({
      ...prev,
      [categoryToLoad]: {
        ...(prev[categoryToLoad] || { articles: [], page: 1, totalPages: 1, totalCount: 0, loading: true, error: null, lastFetchedAt: null, requestGeneration: 0 }),
        requestGeneration,
        loading: !append
      }
    }));

    if (feedAbortControllersRef.current[categoryToLoad]) {
      feedAbortControllersRef.current[categoryToLoad].abort();
    }

    const controller = new AbortController();
    feedAbortControllersRef.current[categoryToLoad] = controller;
    const timeoutId = setTimeout(() => {
      if (feedAbortControllersRef.current[categoryToLoad] === controller) {
        controller.abort();
      }
    }, 30000); // 30s timeout

    try {
      setLifecycleState('SYNCING');

      const isV3Enabled = (import.meta as any).env?.VITE_NEWS_CORE_V3_ENABLED === 'true';
      const feedBaseUrl = isV3Enabled ? '/api/v5/news/feed' : '/api/v4/news/feed';
      const url = `${feedBaseUrl}?page=${pageToLoad}&limit=50&category=${encodeURIComponent(categoryToLoad)}`;
      const feedRes = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
        return; // Discard obsolete response
      }

      if (!feedRes.ok) {
        throw new Error(`News Core V2 HTTP ${feedRes.status}`);
      }

      const feedData = await feedRes.json();

      if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
        return;
      }

      if (feedData.status === 'success' && Array.isArray(feedData.articles)) {
        const feedList = feedData.articles;

        const integrity = assertCanonicalFeedIntegrity(feedList, categoryToLoad);
        if (!integrity.valid && categoryToLoad !== 'All') {
          console.warn(`[NEWS_FEED_MUTATION] source=loadNewsFeed category=${categoryToLoad} received=${feedList.length} mixed=${integrity.mixedCount} ACTION=REJECTED_CONTAMINATED_FEED`);
          return; // Reject contaminated response
        }

        if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
          return;
        }

        setCategoryFeeds(prev => {
          if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
            return prev;
          }
          const existing = prev[categoryToLoad] || { articles: [], page: 1, totalPages: 1, totalCount: 0, loading: false, error: null, lastFetchedAt: null, requestGeneration };
          const newList = append ? [...existing.articles, ...feedList] : feedList;
          const seen = new Set();
          const uniqueArticles = newList.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });

          return {
            ...prev,
            [categoryToLoad]: {
              ...existing,
              articles: uniqueArticles,
              page: feedData.page || pageToLoad,
              totalPages: feedData.totalPages || 1,
              totalCount: feedData.totalCount || uniqueArticles.length,
              loading: false,
              error: null,
              lastFetchedAt: Date.now(),
              requestGeneration
            }
          };
        });

        if (feedData.categoryCounts) {
          setServerCategoryCounts(feedData.categoryCounts);
        }

        setLifecycleState('COMPLETED');
        const nowStr = new Date().toISOString();
        setLastCacheWriteAt(nowStr);
        setLastSuccessfulAutoSyncAt(nowStr);
        safeLocalStorage.setItem('athena_last_successful_auto_sync', nowStr);

        if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
          return;
        }

        // Pagination cache integrity: accumulated locally known feed
        const existingArticlesForCache = append ? (categoryFeeds[categoryToLoad]?.articles || []) : [];
        const combinedCacheList = append ? [...existingArticlesForCache, ...feedList] : feedList;
        const seenCache = new Set();
        const accumulatedCacheArticles = combinedCacheList.filter(item => {
          if (seenCache.has(item.id)) return false;
          seenCache.add(item.id);
          return true;
        });

        safeLocalStorage.setItem(`athena.newsFeed.v2.snapshot.v2.${categoryToLoad}`, JSON.stringify({
          category: categoryToLoad,
          articles: accumulatedCacheArticles,
          page: feedData.page || pageToLoad,
          totalPages: feedData.totalPages || 1,
          totalCount: feedData.totalCount || accumulatedCacheArticles.length,
          savedAt: nowStr
        }));
      } else {
        throw new Error(feedData.message || 'Invalid News Core V2 payload');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAborted = err.name === 'AbortError' || (typeof err.message === 'string' && err.message.toLowerCase().includes('abort'));
      if (isAborted) {
        return;
      }
      if (categoryToLoad !== selectedCategoryRef.current || requestGeneration !== categoryRequestGenerationRef.current[categoryToLoad]) {
        return;
      }
      console.error("[NewsPage] News Core V2 Feed error:", err);
      setLifecycleState('FAILED');
      setCategoryFeeds(prev => ({
        ...prev,
        [categoryToLoad]: {
          ...(prev[categoryToLoad] || { articles: [], page: 1, totalPages: 1, totalCount: 0, loading: false, error: null, lastFetchedAt: null, requestGeneration }),
          loading: false,
          error: err.message || 'Failed to connect to News Core V2'
        }
      }));
    } finally {
      if (feedAbortControllersRef.current[categoryToLoad] === controller) {
        delete feedAbortControllersRef.current[categoryToLoad];
      }
    }
  };

  // Manual Trigger for V2 Sync
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncNotification(null);
    try {
      const res = await fetch("/api/v4/news/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const now = new Date();
        setLastManualSync(now);
        safeLocalStorage.setItem('athena_last_manual_sync', now.toISOString());
        
        setSyncNotification({
          type: 'success',
          message: `V2 Sync Complete: ${data.itemsProcessed || 0} processed, ${data.newAdded || 0} new.`
        });
        const activeCat = selectedCategoryRef.current;
        await loadNewsFeed(1, activeCat, false);
      } else {
        throw new Error(`Sync error HTTP ${res.status}`);
      }
    } catch (err: any) {
      setSyncNotification({
        type: 'error',
        message: err.message || 'Manual sync failed'
      });
    } finally {
      setIsSyncing(false);
      setNextAutoSyncSec(60);
      setTimeout(() => setSyncNotification(null), 5000);
    }
  };

  // Metrics Modal Loader
  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/v4/news/status');
      if (res.ok) {
        const data = await res.json();
        setMetricsData({
          summary: {
            totalProviders: data.activeCollectors || 11,
            healthyProviders: data.activeCollectors || 11,
            degradedProviders: 0,
            totalArticlesReturned: data.apiCount || 0,
            totalValidArticles: data.storageCount || 0,
            totalDuplicatesRemoved: (data.duplicateIds || 0) + (data.duplicateCanonicalUrls || 0),
            totalInvalidUrls: 0,
            lastGlobalRefresh: data.lastSuccessfulSyncAt || new Date().toISOString()
          }
        });
      }
    } catch (err) {
      console.warn("[NewsPage] Failed to fetch V2 metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // 60-second Countdown Auto-Sync Scheduler using selectedCategoryRef.current
  useEffect(() => {
    const timer = setInterval(() => {
      setNextAutoSyncSec((prev) => {
        if (prev <= 1) {
          fetch("/api/v4/news/sync", { method: "POST" })
            .then(res => res.json())
            .then(() => {
              const activeCat = selectedCategoryRef.current;
              loadNewsFeed(1, activeCat, false);
            })
            .catch(e => console.warn("[NewsPage] Auto-sync background error:", e));
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic Status Polling
  useEffect(() => {
    const interval = setInterval(fetchSyncStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  // Instant Category-Scoped Startup Hydration with Strict Cache Validation
  useEffect(() => {
    const hydrateCache = () => {
      setLifecycleState('HYDRATING_CACHE');
      try {
        const cachedStr = safeLocalStorage.getItem(`athena.newsFeed.v2.snapshot.v2.${selectedCategory}`);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed && parsed.category === selectedCategory && Array.isArray(parsed.articles)) {
            const integrity = assertCanonicalFeedIntegrity(parsed.articles, selectedCategory);
            const hasUniqueIds = new Set(parsed.articles.map((a: any) => a.id)).size === parsed.articles.length;
            const hasSanePagination = typeof parsed.page === 'number' && typeof parsed.totalPages === 'number' && typeof parsed.totalCount === 'number';

            if (integrity.valid && hasUniqueIds && hasSanePagination) {
              setCategoryFeeds(prev => ({
                ...prev,
                [selectedCategory]: {
                  ...(prev[selectedCategory] || { articles: [], page: 1, totalPages: 1, totalCount: 0, loading: false, error: null, lastFetchedAt: null, requestGeneration: 0 }),
                  articles: parsed.articles,
                  page: parsed.page || 1,
                  totalPages: parsed.totalPages || 1,
                  totalCount: parsed.totalCount || parsed.articles.length,
                  loading: false
                }
              }));
            } else {
              console.warn(`[NewsPage] Discarding invalid/contaminated cache snapshot for ${selectedCategory}`);
              safeLocalStorage.removeItem(`athena.newsFeed.v2.snapshot.v2.${selectedCategory}`);
            }
          }
        }
      } catch (e) {
        console.warn("[NewsPage] Failed to parse category snapshot cache:", e);
      }
      setLifecycleState('IDLE');
    };

    hydrateCache();

    return () => {
      Object.values(feedAbortControllersRef.current).forEach(c => (c as AbortController).abort());
    };
  }, [selectedCategory]);

  // Whenever selectedCategory changes, fetch page 1 for that specific category
  useEffect(() => {
    setVisibleCount(50);
    loadNewsFeed(1, selectedCategory, false);
  }, [selectedCategory]);

  // Active Category Feed Derived State (Strict Isolation: NO All fallback)
  const currentFeed = categoryFeeds[selectedCategory] || {
    articles: [],
    page: 1,
    totalPages: 1,
    totalCount: 0,
    loading: true,
    error: null
  };

  const targetCategoryArticles = currentFeed.articles;
  const loading = currentFeed.loading;
  const error = currentFeed.error;
  const currentPage = currentFeed.page;
  const totalPages = currentFeed.totalPages;
  const totalCount = currentFeed.totalCount;

  // V2 Category Classification & Pre-grouped Data
  const classifiedArrays = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const cat of ALL_CATEGORIES) {
      if (cat === 'All') {
        map[cat] = categoryFeeds['All']?.articles || [];
      } else if (cat === 'F&O') {
        map[cat] = (categoryFeeds[cat]?.articles || []).filter(a => a.isFO || a.fno?.eligible);
      } else {
        map[cat] = (categoryFeeds[cat]?.articles || []).filter(a => (a.primaryCategory || a.category || '').toLowerCase() === cat.toLowerCase());
      }
    }
    return map;
  }, [categoryFeeds]);

  const categoryCounts = useMemo(() => {
    if (Object.keys(serverCategoryCounts).length > 0) {
      return serverCategoryCounts;
    }
    const counts: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) {
      counts[cat] = categoryFeeds[cat]?.totalCount || (classifiedArrays[cat] ? classifiedArrays[cat].length : 0);
    }
    return counts;
  }, [categoryFeeds, serverCategoryCounts, classifiedArrays]);

  const verifiedCategoryArticles = useMemo(() => {
    if (selectedCategory === 'All') return targetCategoryArticles;
    const catLower = selectedCategory.toLowerCase();
    return targetCategoryArticles.filter(a => {
      if (catLower === 'f&o' || catLower === 'fno') {
        return !!(a.fno?.eligible || a.isFO);
      }
      const primary = (a.primaryCategory || a.category || '').toLowerCase();
      return primary === catLower;
    });
  }, [targetCategoryArticles, selectedCategory]);

  // Client-side search & sentiment filtering
  const filteredArticles = useMemo(() => {
    let result = [...verifiedCategoryArticles];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((a) => {
        const titleMatch = (a.title || a.headline || '').toLowerCase().includes(q);
        const summaryMatch = (a.summary || a.body || '').toLowerCase().includes(q);
        const sourceMatch = (a.publisher || a.source || '').toLowerCase().includes(q);
        const tickerMatch = Array.isArray(a.tickers) && a.tickers.some((t: string) => t.toLowerCase().includes(q));
        const fnoSymbolMatch = a.fnoSymbol && a.fnoSymbol.toLowerCase().includes(q);
        return titleMatch || summaryMatch || sourceMatch || tickerMatch || fnoSymbolMatch;
      });
    }

    if (sentimentFilter !== 'ALL') {
      result = result.filter((a) => a.sentiment === sentimentFilter);
    }

    return result;
  }, [verifiedCategoryArticles, searchQuery, sentimentFilter]);

  const visibleArticles = useMemo(() => {
    return filteredArticles.slice(0, visibleCount);
  }, [filteredArticles, visibleCount]);

  const handleOpenArticleContent = (article: any) => {
    setActiveArticle(article);
    setActiveArticleContent({
      cleanText: article.body || article.summary || article.headline,
      title: article.headline
    });
    setActiveSummary({
      summary: article.summary || article.body || article.headline,
      sentiment: article.sentiment || 'NEUTRAL',
      impactScore: article.impactScore || 5,
      keyPoints: article.keyPoints || []
    });
  };

  return (
    <div className="flex flex-col gap-6 p-3 sm:p-6 max-w-7xl mx-auto w-full font-sans text-slate-100">
      {/* TOP HEADER & TELEMETRY BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 p-4 sm:p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-100">Athena Terminal News Core V2</h1>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-semibold">Isolated Feed Architecture</span>
            </div>
            <p className="text-xs text-slate-400">Real-time financial intelligence stream • Total Records: <span className="font-mono font-semibold text-slate-200">{totalCount}</span></p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync News Now'}</span>
          </button>

          {/* Auto-Sync Countdown Badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auto-sync in {nextAutoSyncSec}s</span>
          </div>

          {/* Metrics Audit Modal Button */}
          <button
            onClick={() => {
              setShowMetricsModal(true);
              loadMetrics();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Provider Audit</span>
          </button>

          {/* Diagnostics Panel Toggle */}
          <button
            onClick={() => setShowDiagnosticsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition-all cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Diagnostics</span>
          </button>
        </div>
      </div>

      {/* SYNC NOTIFICATION TOAST */}
      {syncNotification && (
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
          syncNotification.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {syncNotification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{syncNotification.message}</span>
          </div>
          <button onClick={() => setSyncNotification(null)} className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search news, tickers, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sentiment Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 border border-slate-800 rounded-xl text-xs w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL'] as SentimentFilter[]).map((st) => (
            <button
              key={st}
              onClick={() => setSentimentFilter(st)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                sentimentFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* CATEGORY TABS BAR */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 py-1.5 -mx-3 md:-mx-4 px-3 md:px-4 shadow-lg">
        <NewsCategoryChips
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          categoryCounts={categoryCounts}
        />
      </div>

      {/* MAIN CONTENT AREA */}
      {loading && targetCategoryArticles.length === 0 ? (
        <NewsSkeletonLoader />
      ) : error && targetCategoryArticles.length === 0 ? (
        <div className="p-8 bg-rose-950/20 border border-rose-500/30 rounded-2xl text-center flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <h3 className="text-base font-semibold text-rose-200">Unable to load News Feed</h3>
          <p className="text-xs text-rose-300 max-w-md">{error}</p>
          <button
            onClick={() => loadNewsFeed(1, selectedCategory, false)}
            className="mt-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Retry Connection
          </button>
        </div>
      ) : visibleArticles.length === 0 ? (
        <div className="p-10 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
          <p className="text-sm font-semibold text-slate-300">No news articles found for this selection.</p>
          <p className="text-xs text-slate-500">Try clearing search terms or selecting another category tab.</p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
              setSentimentFilter('ALL');
            }}
            className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleArticles.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                onOpenArticleContent={handleOpenArticleContent}
              />
            ))}
          </div>

          {/* Lazy Load Button */}
          {visibleCount < filteredArticles.length ? (
            <div className="flex justify-center my-6">
              <button
                onClick={() => setVisibleCount((prev) => prev + 15)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                Show More Articles ({filteredArticles.length - visibleCount} loaded)
              </button>
            </div>
          ) : currentPage < totalPages ? (
            <div className="flex justify-center my-6">
              <button
                onClick={() => {
                  loadNewsFeed(currentPage + 1, selectedCategory, true).then(() => {
                    setVisibleCount((prev) => prev + 15);
                  });
                }}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                {lifecycleState === 'SYNCING' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Load More Historical Articles (Page {currentPage + 1} of {totalPages})</span>
                )}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ARTICLE READER MODAL */}
      {activeArticle && (
        <ArticleReader
          article={activeArticle}
          activeArticleContent={activeArticleContent}
          loadingActiveContent={loadingActiveContent}
          errorActiveContent={errorActiveContent}
          activeSummary={activeSummary}
          loadingSummary={loadingSummary}
          onClose={() => setActiveArticle(null)}
          onRetry={() => handleOpenArticleContent(activeArticle)}
        />
      )}

      {/* DIAGNOSTICS MODAL */}
      {showDiagnosticsModal && (
        <NewsDiagnosticsPanel
          isOpen={showDiagnosticsModal}
          onClose={() => setShowDiagnosticsModal(false)}
        />
      )}

      {/* AUDIT METRICS MODAL */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-100 text-base sm:text-lg">Ingestion & Provider Audit</h2>
                  <p className="text-xs text-slate-400">News Core V2 Live Pipeline Telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setShowMetricsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-xs">
              {loadingMetrics ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>Loading News Core V2 metrics...</span>
                </div>
              ) : metricsData && metricsData.summary ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-slate-400 text-[11px]">Active Collectors</span>
                    <span className="font-mono font-bold text-lg text-slate-100">{metricsData.summary.totalProviders}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-emerald-400 text-[11px]">Valid Canonical Articles</span>
                    <span className="font-mono font-bold text-lg text-emerald-400">{metricsData.summary.totalValidArticles}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-indigo-500/20 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-indigo-400 text-[11px]">Deduplicated Items</span>
                    <span className="font-mono font-bold text-lg text-indigo-400">{metricsData.summary.totalDuplicatesRemoved}</span>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-slate-400 text-[11px]">Total Raw Ingested</span>
                    <span className="font-mono font-bold text-lg text-slate-100">{metricsData.summary.totalArticlesReturned}</span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-6">Telemetry unavailable</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
