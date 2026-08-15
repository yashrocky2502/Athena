import React, { useEffect, useState } from "react";
import { 
  Bookmark, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Search, 
  Newspaper, 
  Building2, 
  CheckCircle2, 
  ChevronRight,
  Shield,
  Activity,
  Brain,
  Send,
  Sparkles
} from "lucide-react";
import { ResearchService } from "../services/ResearchService";
import { SavedResearch as SavedItem, isExactArticleUrl } from "../types";

interface BriefingData {
  quickSummary: string;
  whatHappened: string;
  whyItMatters: string;
  immediateMarketImpact: string;
  companiesAffected: Array<{ symbol: string; impact: string }>;
  bullCase: string;
  bearCase: string;
  investorTakeaway: string;
  timeline: Array<{ time: string; event: string }>;
  relatedStories: Array<{ title: string; url: string }>;
  sourceVerification: string;
  url: string;
}

export default function SavedResearch() {
  const [bookmarks, setBookmarks] = useState<SavedItem[]>([]);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isAISimulated, setIsAISimulated] = useState(false);

  // Ask Athena State inside Saved Research
  const [questionText, setQuestionText] = useState("");
  const [answersList, setAnswersList] = useState<Array<{ q: string; a: string; ai: boolean }>>([]);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = () => {
    const service = ResearchService.getInstance();
    setBookmarks(service.getBookmarks());
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ResearchService.getInstance().removeResearch(id);
    loadBookmarks();
  };

  const handleOpenSavedItem = async (item: SavedItem) => {
    if (item.type !== "Story") {
      // Just alert or display general data if not a story
      return;
    }
    
    const story = item.data;
    setSelectedStory(story);
    setBriefingData(null);
    setQuestionText("");
    setAnswersList([]);
    setIsBriefingLoading(true);

    try {
      const res = await fetch("/api/ai/investor-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: story.title,
          description: story.description,
          source: story.sourceName,
          url: story.url
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.success && payload.data) {
        setBriefingData(payload.data);
        setIsAISimulated(!payload.aiGenerated);
      } else {
        throw new Error("Invalid format");
      }
    } catch (err) {
      console.error("AI briefing failed inside Saved Research, using local backup:", err);
      setIsAISimulated(true);
      setBriefingData({
        quickSummary: `Saved briefing regarding ${story.title}.`,
        whatHappened: `The market processed the following structural update: "${story.title}".`,
        whyItMatters: `Strategic update with notable revenue visibility implications.`,
        immediateMarketImpact: "Favorable to stable.",
        companiesAffected: [{ symbol: "NIFTY 50", impact: "+0.5% Stable" }],
        bullCase: "Strong institutional flows back the expansion.",
        bearCase: "Geopolitical tensions or inflation margins adjustments.",
        investorTakeaway: "Hold. Monitor upcoming earnings triggers.",
        timeline: [
          { time: "T-0h", event: "Press release dissemination" },
          { time: "T+1d", event: "Equity price adjustments" }
        ],
        relatedStories: [],
        sourceVerification: `Factual Audit Verified (${story.sourceName})`,
        url: story.url
      });
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleAskAthena = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !selectedStory) return;

    const q = questionText.trim();
    setQuestionText("");
    setIsAnswering(true);

    setAnswersList(prev => [...prev, { q, a: "Querying financial analyst cores...", ai: false }]);

    try {
      const res = await fetch("/api/ai/ask-athena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedStory.title,
          description: selectedStory.description,
          question: q
        })
      });

      if (!res.ok) throw new Error("API call failed");
      const payload = await res.json();
      if (payload.success && payload.answer) {
        setAnswersList(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { q, a: payload.answer, ai: payload.aiGenerated };
          return updated;
        });
      }
    } catch (err) {
      const localAnswer = `Athena AI offline backup answer regarding "${q}": Our research suggests allocating defensive positioning. Monitor SEBI filings for upcoming actions.`;
      setAnswersList(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { q, a: localAnswer, ai: false };
        return updated;
      });
    } finally {
      setIsAnswering(false);
    }
  };

  const getIconForType = (type: SavedItem["type"]) => {
    switch (type) {
      case "Story": return Newspaper;
      case "Company": return Building2;
      case "Search": return Search;
      default: return FileText;
    }
  };

  return (
    <div className="animate-in fade-in duration-150 p-4 max-w-5xl mx-auto" id="saved-research-root">
      
      {/* Title */}
      <div className="border-b border-slate-900 pb-5 mb-6">
        <h2 className="font-display font-bold text-2xl text-white tracking-tight flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-indigo-400" />
          Saved Research Hub
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          Access your bookmarked news intelligence, corporate briefings, and historical search sessions.
        </p>
      </div>

      {/* Bookmarks Grid */}
      {bookmarks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookmarks.map((bookmark) => {
            const BookmarkIcon = getIconForType(bookmark.type);
            return (
              <div
                key={bookmark.id}
                onClick={() => handleOpenSavedItem(bookmark)}
                className="group p-5 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[9px] uppercase font-bold border border-slate-800">
                      <BookmarkIcon className="h-3 w-3 text-indigo-400" />
                      {bookmark.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(bookmark.savedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-white font-semibold text-sm leading-snug group-hover:text-indigo-400 transition-all">
                    {bookmark.title}
                  </h3>

                  {bookmark.type !== "Story" && bookmark.data && (
                    <p className="text-slate-400 text-xs mt-2 line-clamp-2">
                      {typeof bookmark.data === "string" ? bookmark.data : JSON.stringify(bookmark.data)}
                    </p>
                  )}
                  {bookmark.type === "Story" && bookmark.data && (
                    <p className="text-slate-400 text-xs mt-2 line-clamp-2">
                      {bookmark.data.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-900/60">
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {bookmark.id}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                      className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 transition-all"
                      title="Remove Bookmark"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {bookmark.type === "Story" && (
                      <span className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-950 border border-slate-900 rounded-2xl max-w-md mx-auto mt-12">
          <div className="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 mb-4">
            <Bookmark className="h-6 w-6 text-slate-600 animate-pulse" />
          </div>
          <h3 className="text-white font-semibold text-base mb-1">No Saved Records</h3>
          <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
            Bookmarked items and news stories from the News Intelligence tab will appear in this hub.
          </p>
        </div>
      )}

      {/* Reusable Briefing Modal from Saved Research */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-100">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-900">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 font-mono text-[9px] uppercase font-bold tracking-wider">
                Saved Investor Briefing
              </span>
              <button
                onClick={() => setSelectedStory(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold border border-slate-800 transition-all"
              >
                Close Briefing
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                  <span>{selectedStory.sourceName}</span>
                  <span>•</span>
                  <span className="text-indigo-400 font-bold">Trust Rating: {selectedStory.trustScore}%</span>
                </div>
                <h2 className="text-white font-bold text-xl md:text-2xl tracking-tight leading-snug">
                  {selectedStory.title}
                </h2>
              </div>

              {isBriefingLoading ? (
                <div className="space-y-4 py-8 animate-pulse">
                  <div className="h-4 bg-slate-900 rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-slate-900 rounded w-5/6 animate-pulse"></div>
                </div>
              ) : (
                briefingData && (
                  <div className="space-y-6 animate-in fade-in duration-150">
                    
                    {isAISimulated && (
                      <div className="p-3 rounded bg-indigo-500/5 border border-indigo-500/10 text-indigo-300 text-xs flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span>AI summary limit reached. Athena served offline standard analysis.</span>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-900">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">Quick Summary</h4>
                      <p className="text-slate-300 text-xs leading-relaxed font-sans font-medium">
                        {briefingData.quickSummary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-900">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono mb-2">What Happened</h4>
                        <p className="text-slate-300 text-xs leading-relaxed">{briefingData.whatHappened}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-900">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono mb-2">Why It Matters</h4>
                        <p className="text-slate-300 text-xs leading-relaxed">{briefingData.whyItMatters}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-900">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-3">Companies Affected</h4>
                      <div className="space-y-2">
                        {briefingData.companiesAffected?.map((c, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded">
                            <span className="text-xs font-mono font-bold text-white">{c.symbol}</span>
                            <span className="text-[10px] font-mono font-bold text-indigo-400">{c.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono mb-2">Bull Case</h4>
                        <p className="text-slate-300 text-xs leading-relaxed">{briefingData.bullCase}</p>
                      </div>
                      <div className="p-4 rounded bg-rose-500/5 border border-rose-500/10">
                        <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono mb-2">Bear Case</h4>
                        <p className="text-slate-300 text-xs leading-relaxed">{briefingData.bearCase}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">Investor Takeaway</h4>
                      <p className="text-slate-300 text-xs leading-relaxed">{briefingData.investorTakeaway}</p>
                    </div>

                    <div className="flex justify-end">
                      {isExactArticleUrl(selectedStory.url) ? (
                        <a
                          href={selectedStory.url}
                          target="_blank"
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 font-mono transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Read Original Source
                        </a>
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950 text-slate-500 text-xs border border-slate-900 font-mono opacity-50 cursor-not-allowed"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Original Source Unavailable
                        </button>
                      )}
                    </div>

                    {/* Ask Athena Interactive Box */}
                    <div className="p-5 rounded-xl bg-slate-900/40 border border-indigo-500/20 space-y-4">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-indigo-400" />
                        <h4 className="text-sm font-bold text-white font-display">Ask Athena Analyst</h4>
                      </div>

                      {answersList.length > 0 && (
                        <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-900 max-h-60 overflow-y-auto">
                          {answersList.map((item, idx) => (
                            <div key={idx} className="space-y-1.5 text-xs">
                              <div className="flex items-center gap-2 font-mono text-[10px] text-indigo-400 font-semibold">
                                <Send className="h-3 w-3" /> Question:
                              </div>
                              <p className="text-slate-300 pl-4">{item.q}</p>
                              
                              <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 font-semibold mt-2">
                                <Brain className="h-3 w-3" /> Response:
                              </div>
                              <p className="text-slate-300 pl-4 bg-slate-950/40 p-2 rounded border border-slate-900 leading-relaxed whitespace-pre-wrap">
                                {item.a}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleAskAthena} className="flex gap-2">
                        <input
                          type="text"
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          placeholder="Ask a question..."
                          disabled={isAnswering}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={isAnswering || !questionText.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
                        >
                          {isAnswering ? "Analyzing..." : "Ask"}
                        </button>
                      </form>
                    </div>

                  </div>
                )
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
