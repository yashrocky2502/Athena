import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Play,
  Pause,
  RotateCw,
  Server,
  Terminal,
  Send,
  Layers,
  FileText,
  ShieldAlert,
  Cpu,
  BarChart3,
  UserCheck,
  RefreshCw,
  Radio,
  Eye,
  Check,
  X,
  Zap
} from 'lucide-react';

import { CollectorRegistry } from '../collectorRegistry/CollectorRegistry';
import { EconomicTimesCollector } from '../collectors/EconomicTimesCollector';
import { ReutersCollector } from '../collectors/ReutersCollector';
import { MoneycontrolCollector } from '../collectors/MoneycontrolCollector';
import { LiveMintCollector } from '../collectors/LiveMintCollector';

import { ArticleQueue, V3QueueItem } from '../queue/ArticleQueue';
import { ReplayEngine, V3ReplayResult } from '../replay/ReplayEngine';
import { HumanReviewQueue, V3HumanReviewItem } from '../humanReview/HumanReviewQueue';
import { MetricsEngine, V3MetricsSnapshot } from '../metrics/MetricsEngine';
import { ReleaseDashboardEngine, V3ReleaseDashboardSnapshot } from '../operations/ReleaseDashboardEngine';
import { FailureAnalytics, V3RankedFailureReport } from '../operations/FailureAnalytics';
import { TelegramMultiChannelRouter } from '../distribution/telegram/TelegramMultiChannelRouter';
import { TelegramCommandHandler } from '../distribution/telegram/TelegramCommandHandler';
import { NotificationHub, V3NotificationPayload } from '../notificationHub/NotificationHub';
import { V3PublisherId, V3RawArticle } from '../types/V3Types';
import { ClusterRepository } from '../deduplication/ClusterRepository';
import { StoryCluster } from '../deduplication/types/DeduplicationTypes';
import { ClassificationRepository, ClassificationTelemetryStats } from '../classification/ClassificationRepository';
import { ParserTelemetryRepository } from '../parsers/ParserTelemetryRepository';

export const NewsEngineV3OperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'COLLECTORS' | 'CLASSIFICATION' | 'PARSERS' | 'DEDUPLICATION' | 'QUEUE' | 'REPLAY' | 'HUMAN_REVIEW' | 'TELEGRAM' | 'METRICS' | 'ADMIN'
  >('OVERVIEW');
  const [clusters, setClusters] = useState<StoryCluster[]>([]);
  const [classificationStats, setClassificationStats] = useState<ClassificationTelemetryStats | null>(null);
  const [parserStats, setParserStats] = useState<any>(null);

  // State snapshots
  const [releaseSnapshot, setReleaseSnapshot] = useState<V3ReleaseDashboardSnapshot | null>(null);
  const [metricsSnapshot, setMetricsSnapshot] = useState<V3MetricsSnapshot | null>(null);
  const [collectorsHealth, setCollectorsHealth] = useState<Record<string, any>>({});
  const [queueItems, setQueueItems] = useState<V3QueueItem[]>([]);
  const [reviewItems, setReviewItems] = useState<V3HumanReviewItem[]>([]);
  const [replayHistory, setReplayHistory] = useState<V3ReplayResult[]>([]);
  const [notifications, setNotifications] = useState<V3NotificationPayload[]>([]);
  const [failureReport, setFailureReport] = useState<V3RankedFailureReport | null>(null);
  const [telegramStats, setTelegramStats] = useState<Record<string, any>>({});

  // Command console
  const [commandInput, setCommandInput] = useState('');
  const [commandLogs, setCommandLogs] = useState<{ cmd: string; output: string }[]>([]);

  // Replay input
  const [replayArticleId, setReplayArticleId] = useState('RAW_ET_1001');

  // Initialize and poll state
  useEffect(() => {
    const registry = CollectorRegistry.getInstance();
    
    // Register initial collectors if empty
    if (registry.getAll().length === 0) {
      registry.register(new EconomicTimesCollector());
      registry.register(new ReutersCollector());
      registry.register(new MoneycontrolCollector());
      registry.register(new LiveMintCollector());
      registry.initializeAll().catch(() => {});
    }

    // Seed mock human review item for visual demo if empty
    const hr = HumanReviewQueue.getInstance();
    if (hr.getAllItems().length === 0) {
      const sampleArt: V3RawArticle = {
        id: 'RAW_DEMO_01',
        publisherId: 'ECONOMIC_TIMES',
        sourceUrl: 'https://economictimes.indiatimes.com/demo',
        title: 'Reliance Q1 EBITDA rises 14% YoY; Retail revenue surges',
        rawBody: 'Reliance Industries reported quarterly financial numbers...',
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString()
      };
      hr.enqueueForReview(sampleArt, 'METRIC_CONFLICT', 82);
    }

    refreshAllData();

    const interval = setInterval(() => {
      refreshAllData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const refreshAllData = () => {
    const registry = CollectorRegistry.getInstance();
    const queue = ArticleQueue.getInstance();
    const review = HumanReviewQueue.getInstance();
    const replay = ReplayEngine.getInstance();
    const metrics = MetricsEngine.getInstance();
    const release = ReleaseDashboardEngine.getInstance();
    const failures = FailureAnalytics.getInstance();
    const telegram = TelegramMultiChannelRouter.getInstance();
    const notif = NotificationHub.getInstance();
    const clusterRepo = ClusterRepository.getInstance();
    const classRepo = ClassificationRepository.getInstance();

    setCollectorsHealth(registry.health());
    setQueueItems(queue.getAllItems(20));
    setReviewItems(review.getAllItems());
    setReplayHistory(replay.getHistory(10));
    setMetricsSnapshot(metrics.getSnapshot());
    setReleaseSnapshot(release.getSnapshot());
    setFailureReport(failures.getRankedReport());
    setTelegramStats(telegram.getChannelStats());
    setNotifications(notif.getHistory(15));
    setClusters(clusterRepo.getAllClusters());
    setClassificationStats(classRepo.getTelemetryStats());
    setParserStats(ParserTelemetryRepository.getInstance().getStats());
  };

  const handleCollectorAction = async (id: V3PublisherId, action: 'PAUSE' | 'RESUME' | 'RESTART' | 'POLL') => {
    const registry = CollectorRegistry.getInstance();
    const c = registry.get(id);
    if (!c) return;

    if (action === 'PAUSE') registry.disable(id);
    else if (action === 'RESUME') registry.enable(id);
    else if (action === 'RESTART') await c.restart();
    else if (action === 'POLL') await registry.pollSingle(id);

    refreshAllData();
  };

  const handleExecuteReplay = async () => {
    if (!replayArticleId.trim()) return;
    const replayEngine = ReplayEngine.getInstance();
    await replayEngine.replayArticle(replayArticleId.trim(), 'Dashboard Manual Replay');
    refreshAllData();
  };

  const handleReviewAction = (reviewId: string, action: 'APPROVE' | 'REJECT' | 'REPLAY') => {
    const hr = HumanReviewQueue.getInstance();
    hr.processReviewAction(reviewId, action, 'OPERATOR_1', 'Reviewed via Operations Dashboard');
    refreshAllData();
  };

  const handleRunAdminCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    const cmdText = commandInput.trim();
    setCommandInput('');
    const output = await TelegramCommandHandler.processCommand(cmdText);
    setCommandLogs(prev => [...prev, { cmd: cmdText, output }]);
    refreshAllData();
  };

  const getStatusBadge = (status: string) => {
    if (status === 'GREEN' || status === 'RUNNING' || status === 'COMPLETED' || status === 'APPROVED') {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{status}</span>;
    }
    if (status === 'YELLOW' || status === 'RETRYING' || status === 'PROCESSING' || status === 'PENDING_REVIEW') {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">{status}</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-6 space-y-6" id="v3-ops-dashboard">
      {/* HEADER BAR */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-6 h-6 text-indigo-400 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white">ATHENA NEWS ENGINE V3</h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Phase 2.5 Operations</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">Production Operations, Multi-Channel Telegram Observability & Replay Platform</p>
        </div>

        {/* RELEASE STATUS BADGE */}
        {releaseSnapshot && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Release Readiness</div>
              <div className="text-lg font-bold text-white">{releaseSnapshot.overallScore}% Score</div>
            </div>
            {getStatusBadge(releaseSnapshot.releaseStatus)}
          </div>
        )}
      </header>

      {/* TOP METRICS STRIP */}
      {metricsSnapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Articles / Hr</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.articlesPerHour}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Active Sources KPI</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {metricsSnapshot.activeSourcesCount || Object.values(collectorsHealth).filter((c: any) => c.totalArticlesFetched > 0).length} / {Object.keys(collectorsHealth).length || 13}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Avg Latency</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.avgPipelineLatencyMs} <span className="text-xs text-slate-400 font-sans">ms</span></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Pending Queue</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.queueLengthPending}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Quality Gate %</span>
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.qualityGatePassRatePct}%</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Heap Memory</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.memoryUsageMB.heapUsed} <span className="text-xs text-slate-400 font-sans">MB</span></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Active Collectors</span>
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{metricsSnapshot.collectorsActive} / {Object.keys(collectorsHealth).length || 13}</div>
          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <nav className="flex flex-wrap border-b border-slate-800 gap-2">
        {[
          { id: 'OVERVIEW', label: 'Engine Overview', icon: Activity },
          { id: 'COLLECTORS', label: 'Collectors', icon: Server },
          { id: 'CLASSIFICATION', label: 'Classification Engine', icon: FileText },
          { id: 'PARSERS', label: 'Institutional Parsers', icon: Cpu },
          { id: 'DEDUPLICATION', label: `Story Clusters (${clusters.length})`, icon: Database },
          { id: 'QUEUE', label: 'Article Queue & Timeline', icon: Layers },
          { id: 'REPLAY', label: 'Replay Engine', icon: RotateCw },
          { id: 'HUMAN_REVIEW', label: `Human Review (${reviewItems.filter(i => i.status === 'PENDING_REVIEW').length})`, icon: UserCheck },
          { id: 'TELEGRAM', label: 'Telegram & Alerts', icon: Send },
          { id: 'METRICS', label: 'Metrics & Failure Analytics', icon: BarChart3 },
          { id: 'ADMIN', label: 'Admin Command Center', icon: Terminal }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* TAB CONTENT PANELS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Release Blockers Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                Release Gate Assessment
              </h3>
              {releaseSnapshot && getStatusBadge(releaseSnapshot.releaseStatus)}
            </div>

            {releaseSnapshot?.releaseBlockers.length === 0 ? (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>Zero release blockers detected. System meets Phase 2.5 production release criteria.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {releaseSnapshot?.releaseBlockers.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-xs">Collector Health</div>
                <div className="text-lg font-bold text-white font-mono">{releaseSnapshot?.collectorHealthPct}%</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-xs">Parser Confidence</div>
                <div className="text-lg font-bold text-white font-mono">{releaseSnapshot?.parserHealthPct}%</div>
              </div>
            </div>
          </div>

          {/* Quick Notification Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
              <Zap className="w-5 h-5 text-indigo-400" />
              Live Notification Hub Feed
            </h3>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {notifications.slice(-6).reverse().map((n, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-indigo-300">{n.title}</span>
                    <span className="font-mono">{new Date(n.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. COLLECTORS TAB */}
      {activeTab === 'COLLECTORS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Production News Collectors</h3>
            <span className="text-xs text-slate-400">Auto-polling every 30s • Circuit Breaker Protected</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(collectorsHealth).map((c: any) => (
              <div key={c.collectorId} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">{c.name}</span>
                  {getStatusBadge(c.state)}
                </div>

                <div className="space-y-1 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Articles Fetched:</span>
                    <span className="text-slate-200">{c.totalArticlesFetched}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Latency:</span>
                    <span className="text-slate-200">{c.avgLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Health Score:</span>
                    <span className="text-emerald-400">{c.healthPercentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Circuit Breaker:</span>
                    <span className={c.circuitBreakerOpen ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      {c.circuitBreakerOpen ? 'TRIPPED' : 'CLOSED'}
                    </span>
                  </div>
                </div>

                {/* CONTROLS */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  {c.state === 'PAUSED' ? (
                    <button
                      onClick={() => handleCollectorAction(c.collectorId, 'RESUME')}
                      className="flex-1 py-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded flex items-center justify-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCollectorAction(c.collectorId, 'PAUSE')}
                      className="flex-1 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium rounded flex items-center justify-center gap-1"
                    >
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}

                  <button
                    onClick={() => handleCollectorAction(c.collectorId, 'RESTART')}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded flex items-center gap-1"
                    title="Restart Collector"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleCollectorAction(c.collectorId, 'POLL')}
                    className="py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded flex items-center gap-1"
                    title="Poll Now"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLASSIFICATION TAB */}
      {activeTab === 'CLASSIFICATION' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Phase 5 Institutional Classification Engine</h3>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
              100% Deterministic Rule Engine
            </span>
          </div>

          {/* Classification Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Total Classified</div>
              <div className="text-2xl font-bold text-white font-mono">{classificationStats?.totalClassified || 0}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Average Confidence</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{classificationStats?.averageConfidence || 0}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Avg Latency</div>
              <div className="text-2xl font-bold text-white font-mono">{classificationStats?.averageLatencyMs || 0} <span className="text-xs font-sans text-slate-400">ms</span></div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Routing Accuracy</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono">{classificationStats?.routingAccuracy || 100}%</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Rejected Stories</div>
              <div className="text-2xl font-bold text-rose-400 font-mono">{classificationStats?.totalRejected || 0}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Conflicts Resolved</div>
              <div className="text-2xl font-bold text-amber-400 font-mono">{classificationStats?.totalConflicts || 0}</div>
            </div>
          </div>

          {/* Category Distribution Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Live Category Distribution & Routing Targets
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(classificationStats?.categoryDistribution || {
                'QUARTERLY_RESULTS': 0,
                'BROKER_REPORT': 0,
                'DIVIDEND': 0,
                'IPO': 0,
                'ORDER_WIN': 0,
                'MANAGEMENT_CHANGE': 0,
                'RBI_POLICY': 0,
                'MACRO': 0
              }).map(([cat, count]) => (
                <div key={cat} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-slate-300">{cat}</span>
                  <span className="text-sm font-bold text-indigo-400 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2.5 DEDUPLICATION TAB */}
      {activeTab === 'DEDUPLICATION' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-white">Phase 4 Story Clustering & Cross-Publisher Deduplication</h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Deterministic Deduplication Engine
            </span>
          </div>

          {/* Cluster Statistics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Total Active Clusters</div>
              <div className="text-2xl font-bold text-white font-mono">{clusters.length}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Duplicate Detection Rate</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {clusters.length > 0
                  ? `${Math.round((clusters.reduce((acc, c) => acc + c.metadata.mergeCount, 0) / (clusters.reduce((acc, c) => acc + c.documents.length, 0) || 1)) * 100)}%`
                  : '0%'}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Exchange Verified Stories</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                {clusters.filter(c => c.verificationScore.hasOfficialExchangeFiling).length}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <div className="text-slate-400 text-xs">Multi-Source Clusters</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono">
                {clusters.filter(c => c.supportingPublishers.length > 1).length}
              </div>
            </div>
          </div>

          {/* Clusters List */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-slate-300">Active Story Clusters & Merged Timelines</h4>
            {clusters.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
                No active story clusters currently in memory.
              </div>
            ) : (
              clusters.map(cluster => (
                <div key={cluster.clusterId} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {cluster.clusterId}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300">
                          {cluster.eventType}
                        </span>
                        {cluster.metadata.quarterTag && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {cluster.metadata.quarterTag}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-white">{cluster.canonicalHeadline}</h4>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Verification Score</div>
                        <div className="text-lg font-bold font-mono text-emerald-400">{cluster.verificationScore.score}/100</div>
                      </div>
                      {getStatusBadge(cluster.verificationScore.trustLevel)}
                    </div>
                  </div>

                  {/* Supporting Publishers & Companies */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <div><span className="text-slate-500">Publishers ({cluster.supportingPublishers.length}):</span> <span className="text-slate-200 font-semibold">{cluster.supportingPublishers.join(', ')}</span></div>
                    <div>•</div>
                    <div><span className="text-slate-500">Tickers:</span> <span className="text-indigo-400 font-mono font-semibold">[{cluster.tickers.join(', ')}]</span></div>
                  </div>

                  {/* Merged Timeline */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="text-xs font-semibold text-slate-400">Merged Event Timeline ({cluster.mergedTimeline.length} events)</div>
                    <div className="space-y-2">
                      {cluster.mergedTimeline.map(tl => (
                        <div key={tl.id} className="p-2.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-indigo-300">{tl.publisher}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300">{tl.entryType}</span>
                            </div>
                            <div className="text-slate-200">{tl.headline}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono text-right flex-shrink-0 pl-2">
                            {new Date(tl.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2.5. PARSERS TAB */}
      {activeTab === 'PARSERS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white">Institutional Parser Telemetry & Health</h3>
              <p className="text-sm text-slate-400">Deterministic metric extraction performance across all regulatory and financial categories</p>
            </div>
            <button
              onClick={() => {
                ParserTelemetryRepository.getInstance().clear();
                refreshAllData();
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
            >
              <RotateCw className="w-3.5 h-3.5" /> Clear Stats
            </button>
          </div>

          {parserStats ? (
            <>
              {/* KEY PERFORMANCE INDICATORS */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Parser Health</span>
                    <Server className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{parserStats.parserHealth}%</div>
                  <div className="text-[10px] text-slate-500 font-medium">Successful runs</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Avg Confidence</span>
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{parserStats.averageConfidence}%</div>
                  <div className="text-[10px] text-slate-500 font-medium">Deterministic score</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Extraction Accuracy</span>
                    <Zap className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{parserStats.extractionAccuracy}%</div>
                  <div className="text-[10px] text-slate-500 font-medium">Extracted vs expected</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Metrics Extracted</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{parserStats.metricsExtracted}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Total active values</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Missing Metrics</span>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className={`text-3xl font-extrabold font-mono ${parserStats.missingMetrics > 0 ? 'text-amber-400' : 'text-white'}`}>
                    {parserStats.missingMetrics}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Important empty fields</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Avg Latency</span>
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white font-mono">{parserStats.parserLatency} <span className="text-sm font-normal text-slate-400 font-sans">ms</span></div>
                  <div className="text-[10px] text-slate-500 font-medium">Pure execution time</div>
                </div>
              </div>

              {/* DETAILED STATS (COLS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TOP MISSING FIELDS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Top Missing Fields</h4>
                      <p className="text-[11px] text-slate-400">Important fields that were empty during document processing</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parserStats.topMissingFields.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500 font-sans">
                        No missing fields detected! All expected data extracted successfully.
                      </div>
                    ) : (
                      parserStats.topMissingFields.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/60 text-xs font-mono">
                          <span className="text-slate-300 font-bold">{item.field}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">{item.count} misses</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* TOP PARSING ERRORS & FORMAT WARNINGS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Terminal className="w-5 h-5 text-rose-400" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Top Parsing Errors & Format Warnings</h4>
                      <p className="text-[11px] text-slate-400">Crashes or strict format warnings logged during parsing</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parserStats.topParsingErrors.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500 font-sans">
                        Zero errors or format warnings! Pristine processing performance.
                      </div>
                    ) : (
                      parserStats.topParsingErrors.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/60 text-xs font-mono">
                          <span className="text-rose-400 truncate max-w-[280px] sm:max-w-[340px]" title={item.error}>
                            {item.error}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold shrink-0">{item.count} times</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-sans">
              No parsing telemetry recorded yet. Trigger parser operations using classification or replay options.
            </div>
          )}
        </div>
      )}

      {activeTab === 'QUEUE' && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-white">Ingested Article Processing Queue & Timeline</h3>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Queue ID</th>
                  <th className="p-3">Collector</th>
                  <th className="p-3">Headline</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Received Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 font-sans">
                      Queue is empty. Poll a collector above to enqueue items.
                    </td>
                  </tr>
                ) : (
                  queueItems.map(item => (
                    <tr key={item.queueId} className="hover:bg-slate-800/40">
                      <td className="p-3 text-indigo-400">{item.queueId}</td>
                      <td className="p-3 text-slate-300">{item.collectorId}</td>
                      <td className="p-3 text-white font-sans max-w-md truncate">{item.article.title}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          {item.priority}
                        </span>
                      </td>
                      <td className="p-3">{getStatusBadge(item.status)}</td>
                      <td className="p-3 text-slate-400">{new Date(item.receivedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. REPLAY ENGINE TAB */}
      {activeTab === 'REPLAY' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-indigo-400" />
              Article Replay Console
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={replayArticleId}
                onChange={e => setReplayArticleId(e.target.value)}
                placeholder="Enter Article ID (e.g. RAW_ET_1001)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleExecuteReplay}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Trigger Pipeline Replay
              </button>
            </div>
          </div>

          {/* Replay History */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white">Recent Replay Executions</h4>

            <div className="space-y-3">
              {replayHistory.map((rep, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{rep.replayId}</span>
                      <span className="text-xs text-slate-400">Article: {rep.articleId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-mono">{rep.latencyMs} ms</span>
                      {getStatusBadge(rep.success ? 'COMPLETED' : 'FAILED')}
                    </div>
                  </div>

                  {/* TIMELINE STEPS */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-1 pt-1">
                    {rep.timeline.map((step, sIdx) => (
                      <div key={sIdx} className="bg-slate-950 p-1.5 rounded border border-slate-800/80 text-center text-[10px]">
                        <div className="text-slate-400 truncate">{step.stage}</div>
                        <div className="text-emerald-400 font-mono font-semibold">{step.durationMs}ms</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. HUMAN REVIEW TAB */}
      {activeTab === 'HUMAN_REVIEW' && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg text-white">Human Review Inspection Queue</h3>

          <div className="space-y-4">
            {reviewItems.map(item => (
              <div key={item.reviewId} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{item.reviewId}</span>
                      <span className="text-xs text-amber-400 font-semibold">Flag: {item.reason}</span>
                    </div>
                    <h4 className="font-bold text-white text-base">{item.article.title}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Confidence Score</div>
                    <div className="text-lg font-bold text-amber-400 font-mono">{item.confidenceScore}%</div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 font-sans leading-relaxed">
                  {item.article.rawBody}
                </p>

                {item.status === 'PENDING_REVIEW' ? (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleReviewAction(item.reviewId, 'APPROVE')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>

                    <button
                      onClick={() => handleReviewAction(item.reviewId, 'REJECT')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>

                    <button
                      onClick={() => handleReviewAction(item.reviewId, 'REPLAY')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded flex items-center gap-1"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Replay
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 pt-1 flex items-center gap-2">
                    <span>Decision: {getStatusBadge(item.status)}</span>
                    <span>Reviewed by {item.reviewedBy} at {new Date(item.reviewedAt!).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TELEGRAM TAB */}
      {activeTab === 'TELEGRAM' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-400" />
              Multi-Channel Telegram Stats
            </h3>

            <div className="space-y-3">
              {Object.entries(telegramStats).map(([chKey, stats]: any) => (
                <div key={chKey} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{chKey}</div>
                    <div className="text-slate-400">Sent: {stats.messagesSent} | Failed: {stats.messagesFailed}</div>
                  </div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono">Observer Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. ADMIN COMMAND TAB */}
      {activeTab === 'ADMIN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Admin Command Center
          </h3>

          <form onSubmit={handleRunAdminCommand} className="flex gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              placeholder="Try: /status, /collectors, /queue, /replay failed, /help"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg"
            >
              Execute
            </button>
          </form>

          {/* Console output */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 font-mono text-xs space-y-4 max-h-96 overflow-y-auto">
            {commandLogs.map((log, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-indigo-400 font-bold">$ {log.cmd}</div>
                <pre className="text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{log.output}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default NewsEngineV3OperationsDashboard;
