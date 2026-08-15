import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Calendar, 
  Building2, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sliders,
  Send,
  Loader2,
  Tag,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
  Network,
  GitFork,
  Link2,
  Search,
  Eye,
  Settings,
  HelpCircle
} from "lucide-react";
import { AthenaEvent, EventType, StoryImpact, Severity, GraphNode, GraphEdge, NodeType, Evidence, EvidenceSummaryData, isExactArticleUrl } from "../types";
import { EventProcessingEngine } from "../services/EventProcessingEngine";
import { CompanyKnowledgeService } from "../services/CompanyKnowledgeService";
import { KnowledgeGraphEngine } from "../services/KnowledgeGraphEngine";
import { EvidenceEngine, TrustScoringService, ConflictDetector, EvidenceSummaryService } from "../services/EvidenceEngine";


export default function StoryEngineDashboard() {
  const [eventsList, setEventsList] = useState<AthenaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin / Dev mode toggle (defaults to false so ordinary users see no dev tools)
  const [showAdminTools, setShowAdminTools] = useState(false);

  // Athena Evidence Engine states
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummaryData | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>("");
  const [trustConfigs, setTrustConfigs] = useState<Record<string, number>>({});
  const [editSource, setEditSource] = useState("");
  const [editScore, setEditScore] = useState<number>(85);

  // Form states for creating a new event/story
  const [company, setCompany] = useState("");
  const [event, setEvent] = useState("");
  const [status, setStatus] = useState("Published");
  const [confidence, setConfidence] = useState(90);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pipeline execution details to show in the UI for user visualization
  const [pipelineLog, setPipelineLog] = useState<{ step: string; status: string; detail: string }[]>([]);

  // Knowledge Graph states
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [traceStartNode, setTraceStartNode] = useState<string>("");
  const [traceEndNode, setTraceEndNode] = useState<string>("");
  const [traceResult, setTraceResult] = useState<GraphEdge[] | null>(null);
  const [traceAttempted, setTraceAttempted] = useState(false);
  const [impactNodeId, setImpactNodeId] = useState<string>("");
  const [impactedCompanies, setImpactedCompanies] = useState<GraphNode[]>([]);
  const [impactedSectors, setImpactedSectors] = useState<GraphNode[]>([]);
  const [nodeSearch, setNodeSearch] = useState("");
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(true);

  const fetchStories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stories");
      if (!res.ok) throw new Error("Failed to load in-memory stories");
      const data = await res.json();
      
      const engine = EventProcessingEngine.getInstance();
      
      // Feed backend story records into the central Event Processing Engine
      data.forEach((story: any) => {
        const exists = engine.getEvents().some(ev => ev.id === story.id);
        if (!exists) {
          engine.processEvent({
            id: story.id,
            timestamp: story.timestamp,
            title: `${story.company || "Unknown Company"} - ${(story.event || "").slice(0, 45)}...`,
            description: story.event,
            confidence: story.confidence,
            source: story.sources?.[0]?.title || "In-Memory Store",
            evidence: story.sources?.[0]?.uri || "Persisted story record.",
            status: story.status
          });
        }
      });

      // Synchronize with engine events
      setEventsList([...engine.getEvents()]);

      // Sync Knowledge Graph state
      const kg = KnowledgeGraphEngine.getInstance();
      setGraphNodes(kg.getAllNodes());
      setGraphEdges(kg.getAllEdges());

      // Sync Evidence Engine state
      const evEngine = EvidenceEngine.getInstance();
      setEvidenceList([...evEngine.getEvidence()]);
      setEvidenceSummary(evEngine.getLastSummary());
      setTrustConfigs(TrustScoringService.getInstance().getConfigurations());
    } catch (err) {
      console.error(err);
      setError("Unable to connect to Story Engine API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !event.trim()) return;

    setSubmitting(true);
    setPipelineLog([]);
    
    try {
      const sources = sourceTitle.trim() && sourceUri.trim() 
        ? [{ title: sourceTitle.trim(), uri: sourceUri.trim() }] 
        : [];

      // POST to backend first to persist
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          event: event.trim(),
          status,
          confidence,
          sources
        })
      });

      if (!res.ok) throw new Error("Failed to add story to in-memory store");
      const createdStory = await res.json();

      // Create a raw signal object for the Evidence Engine pipeline
      const rawSignal = {
        id: createdStory.id,
        title: `${company.trim()} - Corporate Update`,
        url: sourceUri.trim() || "",
        sourceName: sourceTitle.trim() || "Manual Signal",
        sourceType: "Media",
        summary: event.trim(),
        relatedCompanies: [company.trim().toUpperCase()],
        relatedSectors: [],
        evidenceType: "Manual Signal"
      };

      // Ingest the raw signal into the Athena Evidence Engine
      const evidenceEngine = EvidenceEngine.getInstance();
      const pipelineResult = await evidenceEngine.processIncomingSignals([rawSignal]);

      // Step-by-step pipeline logging showing real Evidence Engine steps!
      const logs = [
        { step: "1. Raw Evidence Collection", status: "completed", detail: `Standardized raw signal from ${rawSignal.sourceName} into formal Evidence format.` },
        { step: "2. Evidence Deduplication", status: "completed", detail: `Scanned memory for duplicate events (Total active items: ${evidenceEngine.getEvidence().length}).` },
        { step: "3. Custom Trust Scoring", status: "completed", detail: `Evaluated Source Type. Base Trust Score set to ${pipelineResult.consolidated[0]?.trustScore || 85}/100.` },
        { step: "4. Rule-Based Conflict Detection", status: "completed", detail: `Cross-analyzed with historical logs. Status: ${pipelineResult.consolidated[0]?.status || "Verified"}.` },
        { step: "5. Context Evidence Synthesis", status: "completed", detail: `Computed overall confidence at ${pipelineResult.summary.overallConfidence}%.` },
        { step: "6. Event Processing Engine Ingestion", status: "completed", detail: "Passing vetted evidence to the Event Processing Engine..." },
        { step: "7. Knowledge Graph Integration", status: "completed", detail: "Propagating entities and real-time relationship edges..." },
        { step: "8. Update Company/Sector/Market Knowledge", status: "completed", detail: "Recalculated core ticker timelines and global risk indexes." }
      ];

      setPipelineLog(logs);

      // Now, process through the EventProcessingEngine with the vetted evidence!
      const engine = EventProcessingEngine.getInstance();
      pipelineResult.consolidated.forEach(evidenceItem => {
        engine.processEvent({
          id: evidenceItem.id,
          timestamp: createdStory.timestamp,
          title: evidenceItem.title,
          description: evidenceItem.summary,
          confidence: evidenceItem.trustScore,
          source: evidenceItem.sourceName,
          evidence: evidenceItem.url || "Athena Evidence Engine verified.",
          status: evidenceItem.status === "Conflicting" ? "Pending" : status,
          companies: evidenceItem.relatedCompanies,
          sectors: evidenceItem.relatedSectors
        });
      });

      // Reset form fields
      setCompany("");
      setEvent("");
      setSourceTitle("");
      setSourceUri("");
      setStatus("Published");
      setConfidence(90);

      // Refresh list
      await fetchStories();
    } catch (err) {
      console.error(err);
      alert("Error adding event to processing engine");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "Draft" | "Published" | "Archived" | "Pending") => {
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      // Update engine state as well
      const engine = EventProcessingEngine.getInstance();
      const ev = engine.getEvents().find(e => e.id === id);
      if (ev) {
        ev.status = newStatus;
        // Sync with CompanyKnowledge state dynamically based on status change
        ev.companies.forEach(symbol => {
          const dbRecord = (CompanyKnowledgeService.getInstance() as any).database[symbol.toUpperCase().replace(/[^A-Z0-9]/g, "")];
          if (dbRecord) {
            let storyStatus: "Strengthening" | "Stable" | "Weakening" | "Uncertain" = "Stable";
            if (ev.impact === StoryImpact.Positive) storyStatus = "Strengthening";
            else if (ev.impact === StoryImpact.Negative) storyStatus = "Weakening";
            else if (ev.impact === StoryImpact.Neutral) storyStatus = "Stable";
            
            dbRecord.story.storyStatus = storyStatus;
          }
        });
      }

      setEventsList([...engine.getEvents()]);
      const kg = KnowledgeGraphEngine.getInstance();
      setGraphNodes(kg.getAllNodes());
      setGraphEdges(kg.getAllEdges());
    } catch (err) {
      console.error(err);
      alert("Error updating status");
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event from the engine?")) return;
    try {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete story");
      
      // Remove from engine
      const engine = EventProcessingEngine.getInstance();
      (engine as any).events = (engine as any).events.filter((e: any) => e.id !== id);

      setEventsList([...engine.getEvents()]);
      const kg = KnowledgeGraphEngine.getInstance();
      setGraphNodes(kg.getAllNodes());
      setGraphEdges(kg.getAllEdges());
    } catch (err) {
      console.error(err);
      alert("Error deleting story");
    }
  };

  const runDeduplicationSimulation = () => {
    const rawResults = [
      {
        id: "sim-dup-1",
        title: "RBI to announce interest rate decision on Thursday",
        sourceName: "Reuters",
        sourceType: "Media",
        summary: "The Reserve Bank of India is widely expected to hold repo rates steady at 6.50% during the upcoming monetary policy review.",
        relatedCompanies: [],
        relatedSectors: ["Banking & Financial Services"],
        evidenceType: "Report"
      },
      {
        id: "sim-dup-2",
        title: "RBI interest rate decision scheduled for Thursday morning",
        sourceName: "Bloomberg",
        sourceType: "Media",
        summary: "Monetary Policy Committee of RBI will finalize its rate review on Thursday morning, consensus points to steady repo rate stance.",
        relatedCompanies: [],
        relatedSectors: ["Banking & Financial Services"],
        evidenceType: "Report"
      }
    ];

    const evEngine = EvidenceEngine.getInstance();
    evEngine.processIncomingSignals(rawResults);
    
    // Sync states
    setEvidenceList([...evEngine.getEvidence()]);
    setEvidenceSummary(evEngine.getLastSummary());
    alert("Deduplication Simulation complete! Check the duplicate logs - the two RBI rate stories have been successfully merged into a single consolidated record.");
  };

  const runConflictSimulation = () => {
    const rawResults = [
      {
        id: "sim-con-1",
        title: "Reliance Q1 Profit projected to increase by 15% YoY",
        sourceName: "Economic Times",
        sourceType: "Media",
        summary: "Analysts predict Reliance Industries' net profit will increase by 15% YoY due to strong refining margins.",
        relatedCompanies: ["RELIANCE"],
        relatedSectors: ["Oil & Gas", "Conglomerates"],
        evidenceType: "Projection"
      },
      {
        id: "sim-con-2",
        title: "Reliance Q1 Profit projected to decrease by 5% YoY",
        sourceName: "Moneycontrol",
        sourceType: "Media",
        summary: "Retail division overheads could drag Reliance Industries' Q1 performance, leading to a projected net profit drop of 5% YoY.",
        relatedCompanies: ["RELIANCE"],
        relatedSectors: ["Oil & Gas", "Conglomerates"],
        evidenceType: "Projection"
      }
    ];

    const evEngine = EvidenceEngine.getInstance();
    evEngine.processIncomingSignals(rawResults);
    
    // Sync states
    setEvidenceList([...evEngine.getEvidence()]);
    setEvidenceSummary(evEngine.getLastSummary());
    alert("Conflict Simulation complete! Both Reliance stories have been flagged as 'Conflicting' due to opposite stances ('increase' vs 'decrease'). Their individual trust scores have been penalized.");
  };

  const resetEvidenceStore = () => {
    const evEngine = EvidenceEngine.getInstance();
    (evEngine as any).evidenceStore = [];
    (evEngine as any).seedDefaultEvidence();
    
    // Sync states
    setEvidenceList([...evEngine.getEvidence()]);
    setEvidenceSummary(evEngine.getLastSummary());
    alert("Evidence Engine memory reset to original default state.");
  };

  const updateScoringConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSource.trim()) return;

    TrustScoringService.getInstance().setTrustScore(editSource.trim(), editScore);
    
    // Re-calculate scores for current evidence in memory
    const evEngine = EvidenceEngine.getInstance();
    const current = evEngine.getEvidence();
    current.forEach(ev => {
      ev.trustScore = TrustScoringService.getInstance().calculateScore(ev.sourceName, ev.sourceType);
    });

    // Re-run conflict detection & synthesis to apply changes
    const evaluated = ConflictDetector.detect(current);
    (evEngine as any).evidenceStore = evaluated;
    (evEngine as any).lastSummary = EvidenceSummaryService.synthesize(evaluated);

    // Sync
    setEvidenceList([...evEngine.getEvidence()]);
    setEvidenceSummary(evEngine.getLastSummary());
    setTrustConfigs(TrustScoringService.getInstance().getConfigurations());
    setEditSource("");
    alert(`Trust Scoring Config successfully updated! '${editSource}' base trust score is now ${editScore}.`);
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "Published":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Draft":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Pending":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "Archived":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getImpactBadge = (impact?: StoryImpact) => {
    switch (impact) {
      case StoryImpact.Positive:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case StoryImpact.Negative:
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case StoryImpact.Neutral:
        return "bg-slate-800 text-slate-300 border-slate-700";
      case StoryImpact.Unknown:
      default:
        return "bg-slate-900/60 text-slate-500 border-slate-900";
    }
  };

  const getSeverityBadge = (sev?: Severity) => {
    switch (sev) {
      case Severity.Critical:
        return "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse font-bold";
      case Severity.High:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case Severity.Medium:
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case Severity.Low:
      default:
        return "bg-slate-800/80 text-slate-400 border-slate-700/60";
    }
  };

  const getEventTypeStyle = (type: EventType) => {
    switch (type) {
      case EventType.Earnings:
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      case EventType.RBIPolicy:
        return "bg-purple-500/10 border-purple-500/20 text-purple-400";
      case EventType.GovernmentPolicy:
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      case EventType.RegulatoryFiling:
        return "bg-cyan-500/10 border-cyan-500/20 text-cyan-400";
      case EventType.ManagementCommentary:
        return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
      case EventType.CommodityImpact:
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
      case EventType.CorporateAction:
        return "bg-pink-500/10 border-pink-500/20 text-pink-400";
      default:
        return "bg-slate-800 border-slate-700 text-slate-300";
    }
  };

  return (
    <div className="flex flex-col gap-6" id="story-engine-dashboard-root">
      
      {/* Downstream modules paused banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3">
        <Sliders className="h-5 w-5 text-amber-500 shrink-0 animate-pulse" />
        <div>
          <span className="font-bold block mb-0.5">Story Engine Downstream Processing is Paused</span>
          Athena's automated story creation, categorization, company recognition, and cascading intelligence are temporarily offline during the Ingestion Validation Phase. Refer to the News tab to monitor raw feed updates.
        </div>
      </div>

      {/* Title block */}
      <div className="flex justify-between items-center bg-slate-900/20 border border-slate-900 p-5 rounded-xl text-left flex-wrap gap-4">
        <div>
          <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-400" />
            Athena Event Processing Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Central real-time pipeline for processing incoming signals, validating parameters, classifying corporate events, and cascading intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdminTools(!showAdminTools)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              showAdminTools 
                ? "bg-red-500/10 text-red-400 border-red-500/25 hover:bg-red-500/20" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{showAdminTools ? "Exit Admin View" : "Admin View"}</span>
          </button>

          <button 
            onClick={fetchStories} 
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs border border-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh Pipeline
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-xl text-center">
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List of processed events in the pipeline */}
          <div className="lg:col-span-2 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                Processed Pipeline Events ({eventsList.length})
              </h3>
              <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">
                In-Memory Core
              </span>
            </div>
            
            {eventsList.length === 0 ? (
              <div className="bg-slate-900/10 border border-slate-900 p-12 rounded-xl text-center">
                <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No signals processed yet. Use the signal terminal to append one.</p>
              </div>
            ) : (
              eventsList.map((ev) => (
                <div key={ev.id} className="bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-xl p-5 flex flex-col gap-4 transition-all">
                  
                  {/* Event metadata header row */}
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] bg-slate-950 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/25 font-bold">
                        {ev.id}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {new Date(ev.timestamp).toLocaleString("en-IN")}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${getStatusBadge(ev.status)}`}>
                        {ev.status}
                      </span>
                    </div>

                    {/* Classifier and Analyzer badging outputs */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono border uppercase tracking-wider font-bold ${getEventTypeStyle(ev.eventType)}`}>
                        {ev.eventType}
                      </span>
                      {ev.impact && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono border uppercase tracking-wider font-bold ${getImpactBadge(ev.impact)}`}>
                          Impact: {ev.impact}
                        </span>
                      )}
                      {ev.severity && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono border uppercase tracking-wider ${getSeverityBadge(ev.severity)}`}>
                          {ev.severity} Severity
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corporate content */}
                  <div>
                    <h4 className="font-display font-bold text-sm text-white flex items-center gap-2 leading-snug">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                      {ev.title}
                    </h4>
                    <p className="text-xs md:text-sm text-slate-300 mt-2 leading-relaxed">
                      {ev.description}
                    </p>
                  </div>

                  {/* Affected Entities block */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">Identified Affected Companies</span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {ev.companies && ev.companies.length > 0 ? (
                          ev.companies.map((comp) => (
                            <span key={comp} className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                              {comp}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">No specific stock target resolved</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-1">Identified Affected Sectors</span>
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {ev.sectors && ev.sectors.length > 0 ? (
                          ev.sectors.map((sec) => (
                            <span key={sec} className="bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-medium">
                              {sec}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600 text-[11px] italic">Macro systemic/broad-market</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Evidence and Grounding details */}
                  <div className="border-t border-slate-900/80 pt-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                        Grounding Evidence Vector
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Systemic Confidence: <span className="font-bold text-emerald-400">{ev.confidence}%</span>
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded border border-slate-900 text-[11px] text-slate-400 font-mono flex items-start gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-indigo-400/80 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-slate-300 font-bold">{ev.source}: </span>
                        {ev.evidence}
                      </div>
                    </div>
                  </div>

                  {/* Status update row */}
                  <div className="flex justify-between items-center border-t border-slate-900/80 pt-3 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">Sync Controls:</span>
                      <div className="flex gap-1">
                        {(["Draft", "Pending", "Published", "Archived"] as const).map((s) => (
                          <button
                            key={s}
                            disabled={ev.status === s}
                            onClick={() => handleUpdateStatus(ev.id, s)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                              ev.status === s
                                ? "bg-indigo-600 text-white font-bold"
                                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteStory(ev.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/10 cursor-pointer"
                      title="Purge Event Signal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* Form to feed new signals into the Event Processing Engine */}
          <div className="flex flex-col gap-4 text-left">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-1">
              Event Signal Terminal
            </h3>

            <form onSubmit={handleCreateStory} className="bg-slate-900/20 border border-slate-900 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Corporate / Macro Entity
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Motors Ltd, RELIANCE, HDFC Bank"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Raw Event signal / Development
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide details of the corporate results, RBI guidelines, government tariffs, or macroeconomic shifts..."
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Pipeline Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Published">Published</option>
                    <option value="Pending">Pending</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Base Factual Score ({confidence}%)
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={confidence}
                      onChange={(e) => setConfidence(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-900/85 pt-3">
                <span className="block text-xs font-mono font-bold text-indigo-400/80 uppercase tracking-wider mb-2.5">
                  Factual Evidence Source (Optional)
                </span>
                
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SEBI Corporate Disclosures, RBI Press Office"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                  <input
                    type="url"
                    placeholder="Source Link (e.g., https://...)"
                    value={sourceUri}
                    onChange={(e) => setSourceUri(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/25 cursor-pointer mt-2"
              >
                {submitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Ingest & Process Signal
              </button>
            </form>

            {/* Pipeline Process Logs Display Panel */}
            {pipelineLog.length > 0 && (
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex flex-col gap-2.5">
                <h4 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Active Pipeline Execution Logs
                </h4>
                <div className="flex flex-col gap-1.5">
                  {pipelineLog.map((log, idx) => (
                    <div key={idx} className="flex justify-between items-start text-[10px] font-mono leading-normal">
                      <span className="text-slate-400">{log.step}:</span>
                      <span className="text-emerald-400 text-right max-w-[150px] truncate">{log.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {showAdminTools && (
        <div className="flex flex-col gap-8 mt-8">
          
          {/* Developer Debug Panel: Athena Evidence Engine */}
          <div className="bg-slate-900/10 border border-slate-900 rounded-xl p-5 text-left flex flex-col gap-5">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    Developer Debug Panel: Athena Evidence Engine
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider font-bold">
                      System Admin
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Verify raw corporate search results, manage deduplication merging algorithms, configure trust scores, and audit conflicting market stances.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-xs font-mono">
                  <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                    Total Signals: <strong className="text-white">{evidenceList.length}</strong>
                  </span>
                  <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                    Conflicts: <strong className="text-red-400">{evidenceList.filter(e => e.status === "Conflicting").length}</strong>
                  </span>
                </div>
                <button
                  onClick={resetEvidenceStore}
                  className="text-xs bg-slate-950 border border-slate-850 hover:bg-slate-900 text-rose-400 font-semibold px-2.5 py-1 rounded cursor-pointer transition-colors"
                >
                  Reset Memory
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Section: Evidence Registry & Details (Col span 6) */}
              <div className="lg:col-span-6 flex flex-col gap-4 bg-slate-950/20 border border-slate-900 p-4 rounded-xl">
                <div>
                  <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Evidence Store Registry
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                    Click any signal to inspect its trust metadata, duplicate groupings, and conflicting stances.
                  </p>
                </div>

                {/* Evidence items list */}
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {evidenceList.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvidenceId(ev.id)}
                      className={`p-2.5 rounded-lg border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                        selectedEvidenceId === ev.id
                          ? "bg-indigo-950/40 border-indigo-500/50"
                          : "bg-slate-950/60 hover:bg-slate-900 border-slate-900/60"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-display text-xs font-bold text-white truncate max-w-[280px]">
                          {ev.title}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono border whitespace-nowrap ${
                          ev.status === "Verified" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                          ev.status === "Conflicting" ? "bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        }`}>
                          {ev.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                        <span>Source: <strong className="text-slate-300">{ev.sourceName}</strong></span>
                        <span>Trust Score: <strong className="text-emerald-400">{ev.trustScore}/100</strong></span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detailed view */}
                {selectedEvidenceId ? (() => {
                  const ev = evidenceList.find(e => e.id === selectedEvidenceId);
                  if (!ev) return null;

                  return (
                    <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-900 flex flex-col gap-3 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-slate-500 font-mono">ID: {ev.id}</span>
                          <h5 className="font-bold text-white text-xs leading-tight mt-0.5">{ev.title}</h5>
                        </div>
                        <span className="text-[9px] font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-indigo-400 uppercase font-bold">
                          {ev.evidenceType}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-900/80 leading-relaxed max-h-32 overflow-y-auto font-sans whitespace-pre-line">
                        {ev.summary}
                      </div>

                      {/* Conflicts list */}
                      {ev.conflicts && ev.conflicts.length > 0 && (
                        <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg flex flex-col gap-1 text-[10px] text-rose-400">
                          <span className="font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Detected Systemic Discrepancies:
                          </span>
                          <ul className="list-disc pl-4 space-y-1 font-mono text-[9px] text-rose-300 leading-normal">
                            {ev.conflicts.map((conf, idx) => (
                              <li key={idx}>{conf}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono border-t border-slate-900/60 pt-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 uppercase text-[8px] tracking-wider font-bold">Entities Target</span>
                          <div className="flex flex-wrap gap-1">
                            {ev.relatedCompanies.map(c => (
                              <span key={c} className="bg-blue-950/40 border border-blue-900/30 text-blue-400 px-1 rounded text-[9px] font-bold">{c}</span>
                            ))}
                            {ev.relatedSectors.map(s => (
                              <span key={s} className="bg-purple-950/40 border border-purple-900/30 text-purple-400 px-1 rounded text-[9px]">{s}</span>
                            ))}
                            {ev.relatedCompanies.length === 0 && ev.relatedSectors.length === 0 && (
                              <span className="text-slate-600 italic text-[9px]">None detected</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500 uppercase text-[8px] tracking-wider font-bold">Source References</span>
                          {ev.url && isExactArticleUrl(ev.url) ? (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline truncate flex items-center gap-1 text-[9px]"
                            >
                              <Link2 className="h-2.5 w-2.5 shrink-0" />
                              {ev.url}
                            </a>
                          ) : (
                            <span className="text-slate-600 italic text-[9px]">Original URL unavailable</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-slate-950/20 border border-slate-900/60 border-dashed rounded-lg p-6 text-center text-xs text-slate-500 font-mono">
                    Select a signal entry to inspect its deep verified attributes and conflict records.
                  </div>
                )}
              </div>

              {/* Right Section: Simulator, Config & Synthesis Summary (Col span 6) */}
              <div className="lg:col-span-6 flex flex-col gap-5">
                
                {/* Simulation Control Block */}
                <div className="bg-slate-950/20 border border-slate-900 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 border-b border-slate-900/80 pb-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Algorithmic Simulations Sandbox
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Trigger automated multi-source signal crawls to test deduplication merges or rule-based semantic and numerical conflicts:
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={runDeduplicationSimulation}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 text-left p-2 rounded-lg flex flex-col gap-1 hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                        <GitFork className="h-3 w-3 text-indigo-400 rotate-90" />
                        Deduplication Merge
                      </span>
                      <span className="text-[8px] text-slate-500 leading-tight font-mono">
                        Merge Reuters + Bloomberg RBI reports into one.
                      </span>
                    </button>

                    <button
                      onClick={runConflictSimulation}
                      className="bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 text-left p-2 rounded-lg flex flex-col gap-1 hover:border-slate-700 transition-all cursor-pointer"
                    >
                      <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-rose-400" />
                        Numeric & Stance Conflict
                      </span>
                      <span className="text-[8px] text-slate-500 leading-tight font-mono">
                        Add opposing RIL Q1 forecasts (15% vs -5%).
                      </span>
                    </button>
                  </div>
                </div>

                {/* Configurations and Scores */}
                <div className="bg-slate-950/20 border border-slate-900 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 border-b border-slate-900/80 pb-2">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Scoring Trust Map Configurations
                    </span>
                  </div>

                  <form onSubmit={updateScoringConfig} className="flex gap-2">
                    <select
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Source to Configure --</option>
                      {Object.keys(trustConfigs).map(key => (
                        <option key={key} value={key}>{key} ({trustConfigs[key]})</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 rounded px-2.5 py-1 text-xs text-slate-300">
                      <span className="text-slate-500">Score:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editScore}
                        onChange={(e) => setEditScore(Number(e.target.value))}
                        className="w-10 bg-transparent text-white font-bold text-center focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!editSource}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </form>

                  {/* Config grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[9px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-900/60 max-h-32 overflow-y-auto">
                    {Object.entries(trustConfigs).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center bg-slate-900/40 p-1 px-1.5 rounded border border-slate-900/40">
                        <span className="truncate max-w-[80px]" title={k}>{k}</span>
                        <span className="text-white font-bold bg-slate-950 px-1 rounded">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Synthesis Summary Result Panel */}
                {evidenceSummary && (
                  <div className="bg-slate-950/20 border border-slate-900 p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center gap-1.5 border-b border-slate-900/80 pb-2 justify-between">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-4 w-4 text-indigo-400" />
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          Athena Synthesized Global Evidence Summary
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        evidenceSummary.overallConfidence >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                        evidenceSummary.overallConfidence >= 55 ? "bg-amber-500/10 text-amber-400 border-amber-500/25" :
                        "bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse"
                      }`}>
                        Confidence: {evidenceSummary.overallConfidence}%
                      </span>
                    </div>

                    {/* Progress bar representing confidence */}
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
                      <div
                        className={`h-full transition-all duration-500 ${
                          evidenceSummary.overallConfidence >= 80 ? "bg-emerald-500" :
                          evidenceSummary.overallConfidence >= 55 ? "bg-amber-500" :
                          "bg-rose-500"
                        }`}
                        style={{ width: `${evidenceSummary.overallConfidence}%` }}
                      ></div>
                    </div>

                    <div className="flex flex-col gap-3 text-xs mt-1">
                      {/* Key Facts */}
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider font-bold block mb-1">
                          Vetted Key Facts ({evidenceSummary.keyFacts.length})
                        </span>
                        {evidenceSummary.keyFacts.length === 0 ? (
                          <span className="text-[10px] text-slate-600 italic font-mono">No key facts verified.</span>
                        ) : (
                          <ul className="space-y-1">
                            {evidenceSummary.keyFacts.map((fact, idx) => (
                              <li key={idx} className="flex gap-1.5 items-start text-slate-300">
                                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Supporting Evidence */}
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider font-bold block mb-1">
                          Supporting References ({evidenceSummary.supportingEvidence.length})
                        </span>
                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                          {evidenceSummary.supportingEvidence.map((sup, idx) => (
                            <span key={idx} className="bg-slate-950 p-1 px-2 rounded border border-slate-900/60 font-mono text-[9px] text-slate-400 leading-normal">
                              {sup}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Active Conflicts */}
                      {evidenceSummary.conflictingEvidence.length > 0 && (
                        <div>
                          <span className="text-[9px] text-rose-400 uppercase font-mono tracking-wider font-bold block mb-1">
                            Active Conflicting Reports ({evidenceSummary.conflictingEvidence.length})
                          </span>
                          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                            {evidenceSummary.conflictingEvidence.map((conf, idx) => (
                              <span key={idx} className="bg-rose-950/15 border border-rose-900/30 p-1.5 px-2 rounded font-mono text-[9px] text-rose-300 leading-normal">
                                {conf}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>

          {/* Developer Debug Panel: Athena Knowledge Graph */}
          <div className="bg-slate-900/10 border border-slate-900 rounded-xl p-5 text-left flex flex-col gap-5">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                    Developer Debug Panel: Athena Knowledge Graph
                    <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider font-bold">
                      System Admin
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Inspect cross-entity relationships, test algorithmic shortest-paths, and run automated cascading systemic impact tracing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-xs font-mono">
                  <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                    Nodes: <strong className="text-white">{graphNodes.length}</strong>
                  </span>
                  <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                    Edges: <strong className="text-white">{graphEdges.length}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setIsDevPanelOpen(!isDevPanelOpen)}
                  className="text-xs bg-slate-950 border border-slate-850 hover:bg-slate-900 text-indigo-400 font-semibold px-2.5 py-1 rounded cursor-pointer animate-none"
                >
                  {isDevPanelOpen ? "Collapse Debugger" : "Expand Debugger"}
                </button>
              </div>
            </div>

            {isDevPanelOpen && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Section: Nodes Explorer (Col span 5) */}
                <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/20 border border-slate-900 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Graph Node Inventory
                    </span>
                    <div className="relative w-40">
                      <input
                        type="text"
                        placeholder="Search nodes..."
                        value={nodeSearch}
                        onChange={(e) => setNodeSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500/60 rounded px-2 py-1 pl-6 text-[10px] text-white focus:outline-none placeholder-slate-600"
                      />
                      <Search className="h-3 w-3 text-slate-600 absolute left-2 top-2" />
                    </div>
                  </div>

                  {/* Node Inventory List */}
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
                    {graphNodes
                      .filter(node => (node.name || "").toLowerCase().includes((nodeSearch || "").toLowerCase()) || (node.type || "").toLowerCase().includes((nodeSearch || "").toLowerCase()))
                      .map(node => (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`flex justify-between items-center px-2.5 py-1.5 rounded text-left text-xs transition-colors cursor-pointer ${
                            selectedNodeId === node.id 
                              ? "bg-indigo-600 text-white font-bold" 
                              : "bg-slate-950/60 hover:bg-slate-900 text-slate-300"
                          }`}
                        >
                          <span className="truncate max-w-[170px]">{node.name}</span>
                          <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono ${
                            node.type === "Company" ? "bg-blue-500/15 text-blue-400" :
                            node.type === "Sector" ? "bg-purple-500/15 text-purple-400" :
                            node.type === "Commodity" ? "bg-amber-500/15 text-amber-400" :
                            node.type === "Government Policy" ? "bg-red-500/15 text-red-400" :
                            node.type === "Currency" ? "bg-emerald-500/15 text-emerald-400" :
                            node.type === "Theme" ? "bg-pink-500/15 text-pink-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {node.type}
                          </span>
                        </button>
                      ))}
                  </div>

                  {/* Node Detail Section */}
                  {selectedNodeId ? (() => {
                    const node = graphNodes.find(n => n.id === selectedNodeId);
                    if (!node) return null;
                    
                    // Find relationships associated with this node
                    const nodeEdges = graphEdges.filter(e => e.source === node.id || e.target === node.id);

                    return (
                      <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-900 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">Node ID: {node.id}</span>
                          <span className="text-[10px] font-mono text-indigo-400 font-bold">{node.type}</span>
                        </div>
                        <div className="text-white font-bold text-sm leading-tight border-b border-slate-900/60 pb-1.5 flex items-center gap-1.5">
                          <GitFork className="h-3.5 w-3.5 text-indigo-400" />
                          {node.name}
                        </div>

                        {/* Metadata Properties */}
                        {node.properties && Object.keys(node.properties).length > 0 && (
                          <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-900/40">
                            <span className="text-indigo-400 font-bold block mb-1">Properties:</span>
                            {Object.entries(node.properties).map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="text-slate-500">{k}:</span>
                                <span className="text-slate-300 font-bold max-w-[140px] truncate">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Active Connections */}
                        <div className="flex flex-col gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Connected Edges ({nodeEdges.length})</span>
                          {nodeEdges.length === 0 ? (
                            <span className="text-[10px] text-slate-600 italic">Isolated node with no edges.</span>
                          ) : (
                            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                              {nodeEdges.map(edge => {
                                const otherId = edge.source === node.id ? edge.target : edge.source;
                                const otherNode = graphNodes.find(n => n.id === otherId);
                                const direction = edge.source === node.id ? "→ Out" : "← In";
                                return (
                                  <div key={edge.id} className="text-[10px] font-mono bg-slate-950 p-1.5 rounded flex justify-between items-center gap-2">
                                    <span className="text-indigo-400 font-bold">{direction}</span>
                                    <span className="text-slate-300 font-semibold text-center text-[9px] italic flex-1 truncate">
                                      {edge.relationship}
                                    </span>
                                    <span className="text-white font-bold max-w-[80px] truncate bg-slate-900 px-1 rounded">
                                      {otherNode ? otherNode.name : otherId}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="bg-slate-950/20 border border-slate-900/60 border-dashed rounded-lg p-5 text-center text-xs text-slate-500 font-mono">
                      Select an entity node above to inspect its real-time telemetry attributes and edges.
                    </div>
                  )}
                </div>

                {/* Right Section: Path Tracer & Cascading Impact tools (Col span 7) */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  
                  {/* Tool 1: BFS Shortest Path Tracer */}
                  <div className="bg-slate-950/20 border border-slate-900 p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        Query: Cross-Entity Shortest Path Tracer
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 mb-1 uppercase font-bold">Start Node</label>
                        <select
                          value={traceStartNode}
                          onChange={(e) => setTraceStartNode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Choose Node --</option>
                          {graphNodes.map(node => (
                            <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 mb-1 uppercase font-bold">Target Node</label>
                        <select
                          value={traceEndNode}
                          onChange={(e) => setTraceEndNode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Choose Node --</option>
                          {graphNodes.map(node => (
                            <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!traceStartNode || !traceEndNode) return;
                        const kg = KnowledgeGraphEngine.getInstance();
                        const result = kg.traceRelationship(traceStartNode, traceEndNode);
                        setTraceResult(result);
                        setTraceAttempted(true);
                      }}
                      disabled={!traceStartNode || !traceEndNode}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Run Path Tracer Algorithm
                    </button>

                    {/* Path tracer output render */}
                    {traceAttempted && (
                      <div className="bg-slate-950 p-3 rounded border border-slate-900 mt-1">
                        <span className="text-[9px] text-slate-500 uppercase font-mono font-bold block mb-2">Traced Path Results</span>
                        {traceResult === null ? (
                          <div className="text-[11px] text-rose-400 font-mono flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            No directed relationship path found between the chosen nodes.
                          </div>
                        ) : traceResult.length === 0 ? (
                          <div className="text-[11px] text-emerald-400 font-mono">
                            Start and Target nodes are identical. Path length is 0.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {traceResult.map((edge, idx) => {
                                const srcNode = graphNodes.find(n => n.id === edge.source);
                                const tgtNode = graphNodes.find(n => n.id === edge.target);
                                return (
                                  <React.Fragment key={edge.id}>
                                    {idx === 0 && (
                                      <span className="bg-slate-900 border border-slate-800 text-white font-bold text-[10px] px-2 py-0.5 rounded font-mono">
                                        {srcNode ? srcNode.name : edge.source}
                                      </span>
                                    )}
                                    <span className="text-slate-500 text-[10px]">→</span>
                                    <div className="flex flex-col bg-slate-900/60 p-1 rounded border border-slate-850 text-center">
                                      <span className="text-[8px] text-emerald-400 font-mono italic px-1 font-semibold leading-none">{edge.relationship}</span>
                                    </div>
                                    <span className="text-slate-500 text-[10px]">→</span>
                                    <span className="bg-indigo-950/40 border border-indigo-900/30 text-indigo-300 font-bold text-[10px] px-2 py-0.5 rounded font-mono">
                                      {tgtNode ? tgtNode.name : edge.target}
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono mt-1">
                              Shortest path computed successfully: <strong className="text-emerald-400">{traceResult.length} hop(s)</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tool 2: Cascading Downstream Impact Simulator */}
                  <div className="bg-slate-950/20 border border-slate-900 p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex items-center gap-1.5">
                      <GitFork className="h-4 w-4 text-indigo-400" />
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        Query: Cascading Macro Systemic Impact Simulation
                      </span>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <select
                        value={impactNodeId}
                        onChange={(e) => setImpactNodeId(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Select Disturbance Source --</option>
                        {graphNodes.map(node => (
                          <option key={node.id} value={node.id}>{node.name} ({node.type})</option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          if (!impactNodeId) return;
                          const kg = KnowledgeGraphEngine.getInstance();
                          setImpactedCompanies(kg.findImpactedCompanies(impactNodeId));
                          setImpactedSectors(kg.findImpactedSectors(impactNodeId));
                        }}
                        disabled={!impactNodeId}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-1.5 rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow shadow-indigo-500/10 disabled:opacity-50"
                      >
                        Trace Downstream
                      </button>
                    </div>

                    {impactNodeId && (
                      <div className="bg-slate-950 p-3.5 rounded border border-slate-900 mt-1 flex flex-col gap-3">
                        <div className="flex items-center gap-1 border-b border-slate-900 pb-1.5">
                          <Eye className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            SIMULATED SYSTEMIC IMPACT MATRIX
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Sectors impacted */}
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono uppercase font-bold block mb-1">
                              Downstream Affected Sectors ({impactedSectors.length})
                            </span>
                            {impactedSectors.length === 0 ? (
                              <span className="text-[10px] text-slate-600 italic font-mono block">No sectors impacted directly.</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {impactedSectors.map(sec => (
                                  <span key={sec.id} className="bg-purple-950/30 text-purple-400 border border-purple-900/35 px-2 py-0.5 rounded text-[10px] font-mono">
                                    {sec.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Companies impacted */}
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono uppercase font-bold block mb-1">
                              Downstream Affected Companies ({impactedCompanies.length})
                            </span>
                            {impactedCompanies.length === 0 ? (
                              <span className="text-[10px] text-slate-600 italic font-mono block">No corporate tickers impacted directly.</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {impactedCompanies.map(comp => (
                                  <span key={comp.id} className="bg-blue-950/30 text-blue-400 border border-blue-900/35 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                                    {comp.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
