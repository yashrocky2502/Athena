import React from 'react';
import { NewsArticle } from '../../news/models/NewsArticle';
import { ExternalLink, Building2, TrendingUp, TrendingDown, Minus, BookOpen, ShieldCheck, Activity } from 'lucide-react';
import { FNORelevanceEngine } from '../../news/FNO/FNORelevanceEngine';

interface NewsCardProps {
  article: NewsArticle;
  onOpenOriginalArticle?: (article: NewsArticle) => void;
  onOpenArticleContent?: (article: NewsArticle) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  onOpenOriginalArticle,
  onOpenArticleContent,
}) => {
  const getPublisherInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const pubDate = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - pubDate.getTime();
    if (isNaN(diff) || diff < 0) return 'Just now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 2) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const isSameDay = pubDate.getDate() === now.getDate() &&
      pubDate.getMonth() === now.getMonth() &&
      pubDate.getFullYear() === now.getFullYear();
    if (isSameDay) return 'Today';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = pubDate.getDate() === yesterday.getDate() &&
      pubDate.getMonth() === yesterday.getMonth() &&
      pubDate.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Yesterday';

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const sentiment = (article.sentiment || 'neutral').toLowerCase();

  // Evaluate Phase 20.5 F&O Audit
  const fnoAudit = (article as any).fnoAudit || FNORelevanceEngine.evaluateAudit(article);

  const renderSentimentChip = () => {
    if (article.isExchangeDocument) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm">
          <Building2 className="w-3 h-3 text-amber-400" />
          Official
        </span>
      );
    }
    if (sentiment === 'bullish' || sentiment === 'positive') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingUp className="w-3 h-3" />
          Bullish
        </span>
      );
    }
    if (sentiment === 'bearish' || sentiment === 'negative') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <TrendingDown className="w-3 h-3" />
          Bearish
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
        <Minus className="w-3 h-3 text-slate-400" />
        Neutral
      </span>
    );
  };

  const getCategoryColor = (category?: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('f&o')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    if (cat.includes('market')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (cat.includes('economy')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (cat.includes('corporate')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (cat.includes('crypto')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (cat.includes('ai') || cat.includes('tech')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700/80';
  };

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenOriginalArticle) {
      onOpenOriginalArticle(article);
    } else if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenContent = () => {
    if (onOpenArticleContent) {
      onOpenArticleContent(article);
    } else {
      if (onOpenOriginalArticle) {
        onOpenOriginalArticle(article);
      } else if (article.url) {
        window.open(article.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div 
      onClick={handleOpenContent}
      className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/90 rounded-2xl p-4 md:p-5 transition-all duration-200 flex flex-col gap-3 shadow-md hover:shadow-xl group cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
            {getPublisherInitials(article.publisher || 'News')}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate">
              {article.publisher || 'Financial Source'}
            </span>
            <span className="text-[11px] text-slate-400 shrink-0">• {getTimeAgo(article.publishedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {article.relatedSources && article.relatedSources.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm">
              <ShieldCheck className="w-3 h-3 text-blue-400" />
              Verified by {article.relatedSources.length + 1} Sources
            </span>
          )}
          {article.qualityScore && article.qualityScore >= 80 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Score: {article.qualityScore}/100
            </span>
          )}
          {article.category && (
            <span
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${getCategoryColor(
                article.category
              )}`}
            >
              {article.category}
            </span>
          )}
          {renderSentimentChip()}
        </div>
      </div>

      {/* Headline & Optional Image */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <h3
            onClick={(e) => {
              e.stopPropagation();
              handleOpenContent();
            }}
            className="font-display font-bold text-base md:text-lg text-slate-100 group-hover:text-indigo-300 transition-colors cursor-pointer leading-snug line-clamp-2"
          >
            {article.title}
          </h3>

          {/* Short description */}
          {article.description && (
            <p className="mt-2 text-xs md:text-sm text-slate-300/90 leading-relaxed line-clamp-3">
              {article.description}
            </p>
          )}
        </div>

        {article.image && (
          <img
            src={article.image}
            alt={article.title}
            className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-xl border border-slate-800 shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Phase 20.5 Audit Badge for F&O Included Articles */}
      {fnoAudit && fnoAudit.fnoDecision === 'INCLUDE' && (
        <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs flex flex-col gap-1.5 my-1">
          <div className="flex items-center justify-between flex-wrap gap-2 font-mono">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                [{fnoAudit.fnoRelevance}] {fnoAudit.fnoSymbol || 'F&O'}
              </span>
              <span className="text-[11px] text-slate-400">Score: {fnoAudit.fnoScore}/100</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              OPTIONS SELLER: {fnoAudit.optionsSellerRelevance}
            </span>
          </div>
          <p className="text-[11px] text-slate-300/90 font-mono leading-tight">
            <span className="font-bold text-indigo-400">REASONS: </span>
            {fnoAudit.fnoReasons.join('; ')}
          </p>
        </div>
      )}

      {/* Footer / Buttons */}
      <div className="flex flex-col gap-3 pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {article.companyName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60 truncate">
                <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
                {article.companyName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (article.isExchangeDocument) {
                  window.open(article.url, '_blank', 'noopener,noreferrer');
                } else {
                  handleOpenContent();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-all min-h-[38px] cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>{article.isExchangeDocument ? 'Read Document' : 'Read Article'}</span>
            </button>
            {article.url && (
              <button
                onClick={handleOpenOriginal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 transition-all min-h-[38px] cursor-pointer"
              >
                <span>Source</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {article.relatedSources && article.relatedSources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 w-full pt-2 border-t border-slate-800/40">
            <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider py-0.5 mr-1">Covered By:</span>
            {article.relatedSources.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {src.publisher}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
