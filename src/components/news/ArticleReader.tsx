import React from 'react';
import { AlertCircle } from 'lucide-react';
import { NewsArticle } from '../../news/models/NewsArticle';
import { TraderArticleDossier } from './TraderArticleDossier';

interface ArticleReaderProps {
  article: NewsArticle;
  activeArticleContent: any;
  loadingActiveContent: boolean;
  errorActiveContent: string | null;
  activeSummary: any;
  loadingSummary: boolean;
  onClose: () => void;
  onRetry: () => void;
  relatedArticles?: NewsArticle[];
  onOpenRelated?: (article: NewsArticle) => void;
}

export function ArticleReader({
  article,
  activeArticleContent,
  loadingActiveContent,
  errorActiveContent,
  activeSummary,
  onClose,
  onRetry
}: ArticleReaderProps) {
  if (loadingActiveContent) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl p-8 items-center justify-center gap-6">
          <div className="w-full max-w-lg flex flex-col gap-4">
            <div className="h-6 w-3/4 bg-slate-800 animate-pulse rounded-md mx-auto" />
            <div className="h-4 w-1/2 bg-slate-800 animate-pulse rounded-md mx-auto" />
            <div className="mt-8 space-y-4">
              <div className="h-4 w-full bg-slate-800 animate-pulse rounded-md" />
              <div className="h-4 w-5/6 bg-slate-800 animate-pulse rounded-md" />
              <div className="h-4 w-full bg-slate-800 animate-pulse rounded-md" />
              <div className="h-4 w-4/5 bg-slate-800 animate-pulse rounded-md" />
              <div className="h-4 w-full bg-slate-800 animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorActiveContent) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-8 text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <h3 className="text-lg font-bold text-slate-100">Extraction Failed</h3>
          <p className="text-sm text-slate-400">{errorActiveContent}</p>
          <div className="flex gap-3 mt-4">
            <button onClick={onRetry} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all">
              Retry Extraction
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeArticleContent && !article) return null;

  return (
    <TraderArticleDossier
      article={article}
      onClose={onClose}
      onOpenOriginal={() => {
        const url = activeArticleContent?.finalUrl || activeArticleContent?.url || article?.url;
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }}
    />
  );
}
