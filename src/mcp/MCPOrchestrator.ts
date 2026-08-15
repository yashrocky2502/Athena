import { BaseMCP, MCPMetrics } from "./BaseMCP";
import { NSEMCP } from "./NSEMCP";
import { BSEMCP } from "./BSEMCP";
import { SEBIMCP } from "./SEBIMCP";
import { RBIMCP } from "./RBIMCP";
import { CompanyIRMCP } from "./CompanyIRMCP";
import { NewsMCP } from "./NewsMCP";
import { MacroMCP } from "./MacroMCP";
import { GoogleSearchMCP } from "./GoogleSearchMCP";
import { EvidenceEngine } from "../services/EvidenceEngine";
import { EventProcessingEngine } from "../services/EventProcessingEngine";
import { StoryImpact, PipelineStage } from "../types";
import { PipelineMonitorService } from "../services/PipelineMonitorService";

export interface OrchestratorStatus {
  isRunning: boolean;
  connectors: {
    name: string;
    priority: number;
    status: string;
    lastSync: string;
    metrics: MCPMetrics;
    refreshInterval: number;
  }[];
  globalMetrics: {
    totalProcessed: number;
    totalChanged: number;
    totalFailed: number;
    lastDispatchTime: string;
    incomingQueueSize: number;
  };
}

export class MCPOrchestrator {
  private static instance: MCPOrchestrator;
  private connectors: Map<string, BaseMCP> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isSchedulerRunning = false;
  private listeners: Set<() => void> = new Set();

  // Global Orchestration Counters
  private totalProcessed = 0;
  private totalChanged = 0;
  private totalFailed = 0;
  private lastDispatchTime: Date | null = null;
  private changedQueue: any[] = []; // In-memory queue of newly detected and dispatched records

  private constructor() {
    this.registerConnectors();
    this.startScheduler();
  }

  public static getInstance(): MCPOrchestrator {
    if (!MCPOrchestrator.instance) {
      MCPOrchestrator.instance = new MCPOrchestrator();
    }
    return MCPOrchestrator.instance;
  }

  private registerConnectors() {
    this.register(new GoogleSearchMCP());
    this.register(new NSEMCP());
    this.register(new BSEMCP());
    this.register(new SEBIMCP());
    this.register(new RBIMCP());
    this.register(new CompanyIRMCP());
    this.register(new NewsMCP());
    this.register(new MacroMCP());
  }

  public register(connector: BaseMCP) {
    this.connectors.set(connector.getName(), connector);
    connector.initialize();
  }

  public getConnector(name: string): BaseMCP | undefined {
    return this.connectors.get(name);
  }

  public getAllConnectors(): BaseMCP[] {
    return Array.from(this.connectors.values()).sort((a, b) => b.priority() - a.priority());
  }

  /**
   * Subscribes UI components to orchestrator events (e.g., tick/sync completions)
   */
  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error("Error in orchestrator listener:", err);
      }
    });
  }

  /**
   * Starts the Scheduler for all registered connectors
   */
  public startScheduler() {
    if (this.isSchedulerRunning) return;
    this.isSchedulerRunning = true;

    this.connectors.forEach((connector) => {
      // Execute an initial sync
      this.executeSyncForConnector(connector);
      this.scheduleNext(connector);
    });

    // Start a background simulator tick that injects random new corporate market activities 
    // every 45 seconds to keep the live developer dashboard extremely dynamic and realistic.
    const simulationTimer = setInterval(() => {
      this.simulateRandomMarketEvent();
    }, 45000);
    this.timers.set("simulation_ticker", simulationTimer);

    this.notify();
  }

  private scheduleNext(connector: BaseMCP) {
    if (!this.isSchedulerRunning) return;

    // Setup recurring timer based on the connector's customized refresh interval (dynamic)
    const interval = connector.getRefreshInterval();
    const timer = setTimeout(async () => {
      await this.executeSyncForConnector(connector);
      this.scheduleNext(connector);
    }, interval);

    this.timers.set(connector.getName(), timer as any);
  }

  /**
   * Stops the Scheduler and clears all active timers
   */
  public stopScheduler() {
    this.isSchedulerRunning = false;
    this.timers.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers.clear();
    this.notify();
  }

  /**
   * Manually triggers sync for all registered connectors at once
   */
  public async syncAll(): Promise<void> {
    const syncPromises = Array.from(this.connectors.values()).map(c => this.executeSyncForConnector(c));
    await Promise.all(syncPromises);
  }

  /**
   * Execution routine for an individual connector
   */
  public async executeSyncForConnector(connector: BaseMCP): Promise<void> {
    const abstractConnector = connector as any;
    if (typeof abstractConnector.sync !== "function") return;

    const traceId = `trace-${Math.random().toString(36).substring(7)}`;
    const monitor = PipelineMonitorService.getInstance();
    const startTime = Date.now();

    monitor.recordEvent({
      traceId,
      stage: PipelineStage.Ingestion,
      status: "Success",
      details: `Triggering sync for ${connector.getName()}`
    });

    try {
      // Execute abstract base class sync (which fetches, hashes, and outputs changed normalized events)
      const changedEvents = await abstractConnector.sync();
      
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.MCP,
        status: "Success",
        details: `MCP ${connector.getName()} synced. ${changedEvents?.length || 0} events changed.`,
        latencyMs: Date.now() - startTime
      });

      const metrics = connector.getMetrics();
      this.totalProcessed += metrics.recordsProcessed;
      this.totalFailed += metrics.failedRecords;

      if (changedEvents && changedEvents.length > 0) {
        this.totalChanged += changedEvents.length;
        this.lastDispatchTime = new Date();
        
        // Accumulate in local memory queue
        this.changedQueue = [...changedEvents, ...this.changedQueue].slice(0, 50); // Keep last 50 changed events

        // 1. Dispatch changed events to the Evidence Engine
        // Convert to Evidence raw signals format
        const rawSignalsForEvidence = changedEvents.map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          url: ev.originalUrl || "",
          sourceName: ev.source || "MCP",
          sourceType: "Exchange",
          summary: ev.summary,
          relatedCompanies: ev.companies || [],
          relatedSectors: ev.sectors || [],
          evidenceType: "Regulatory Filing",
          timestamp: ev.publishedTime
        }));
        EvidenceEngine.getInstance().processIncomingSignals(rawSignalsForEvidence, traceId);

        // 2. Dispatch changed events to the Event Processing Pipeline so that they flow into the KG/stories/companies
        changedEvents.forEach((ev: any) => {
          try {
            const mappedForProcessing = {
              id: ev.id,
              timestamp: ev.publishedTime,
              source: ev.source,
              eventType: "News" as any,
              title: ev.title,
              description: ev.summary,
              companies: ev.companies,
              sectors: ev.sectors,
              confidence: ev.confidence,
              status: "Published",
              evidence: ev.originalUrl
            };
            EventProcessingEngine.getInstance().processEvent(mappedForProcessing);
          } catch (e) {
            console.error("Event Processing Engine integration failed for event:", ev.title, e);
          }
        });
      }
    } catch (err) {
      this.totalFailed++;
      monitor.recordEvent({
        traceId,
        stage: PipelineStage.MCP,
        status: "Failure",
        details: `MCP ${connector.getName()} sync failed: ${(err as Error).message}`
      });
    } finally {
      this.notify();
    }
  }

  /**
   * Gets aggregated orchestrator statistics
   */
  public getStatus(): OrchestratorStatus {
    const connectorsData = this.getAllConnectors().map(c => {
      const metrics = c.getMetrics();
      return {
        name: c.getName(),
        priority: c.priority(),
        status: c.status(),
        lastSync: metrics.lastSuccessfulSync ? metrics.lastSuccessfulSync.toLocaleTimeString("en-IN", { hour12: true }) : "Never",
        metrics,
        refreshInterval: c.getRefreshInterval()
      };
    });

    return {
      isRunning: this.isSchedulerRunning,
      connectors: connectorsData,
      globalMetrics: {
        totalProcessed: this.totalProcessed,
        totalChanged: this.totalChanged,
        totalFailed: this.totalFailed,
        lastDispatchTime: this.lastDispatchTime ? this.lastDispatchTime.toLocaleTimeString("en-IN", { hour12: true }) : "None",
        incomingQueueSize: this.changedQueue.length
      }
    };
  }

  /**
   * Accessor for the memory queue of changed records
   */
  public getChangedQueue(): any[] {
    return this.changedQueue;
  }

  /**
   * Clears orchestrator state/queue
   */
  public clearQueue() {
    this.changedQueue = [];
    this.totalChanged = 0;
    this.totalProcessed = 0;
    this.totalFailed = 0;
    this.notify();
  }

  /**
   * Simulates an incoming hot market disclosure or breaking news
   */
  public simulateRandomMarketEvent() {
    const marketEvents = [
      {
        connector: "NSE MCP Connector",
        title: "Reliance Industries Board approves ₹15,000 Cr Capex for solar cell assembly line",
        desc: "Reliance Industries has authorized a major strategic investment for an integrated solar photovoltaic module factory in Jamnagar, aiming to achieve full supply independence by late 2026.",
        companies: ["RELIANCE"],
        sectors: ["Green Energy & Power"],
        impact: StoryImpact.Positive
      },
      {
        connector: "BSE MCP Connector",
        title: "Block Deal: Tata Motors shares worth ₹850 Crore traded on BSE",
        desc: "An institutional transaction was executed on the BSE blocks platform where foreign portfolio managers picked up 9 million shares, representing a strong long-term commitment.",
        companies: ["TATAMOTORS"],
        sectors: ["Automotive & EVs"],
        impact: StoryImpact.Neutral
      },
      {
        connector: "SEBI MCP Connector",
        title: "SEBI warning issued to corporate entities over improper ESG disclosures",
        desc: "SEBI circular enforces stricter compliance audits for BRSR (Business Responsibility and Sustainability Reporting) declarations, demanding third-party validation for critical indicators.",
        companies: [],
        sectors: ["Banking & Finance"],
        impact: StoryImpact.Neutral
      },
      {
        connector: "RBI MCP Connector",
        title: "RBI issues guidelines on credit card reward structures and fee limits",
        desc: "Reserve Bank of India warns commercial banks over predatory interest calculations and enforces caps on recurring renewal charges for consumer credit card lines.",
        companies: ["HDFCBANK"],
        sectors: ["Banking & Finance"],
        impact: StoryImpact.Neutral
      },
      {
        connector: "Company IR MCP Connector",
        title: "Zomato Ltd CEO outlines food delivery profitability upgrade path",
        desc: "In an investor briefing call, Zomato leadership stated they anticipate reaching 15% consolidated adjusted EBITDA margins by fiscal year 2027 through optimized platform fees and loyalty tiers.",
        companies: ["ZOMATO"],
        sectors: ["Internet & Tech"],
        impact: StoryImpact.Positive
      },
      {
        connector: "News MCP Connector",
        title: "US Federal Reserve signals potential rate cuts starting September",
        desc: "Fed Chairman signals progress towards inflation stabilization, suggesting the central bank is close to initiating interest rate cuts, driving bullish sentiment globally.",
        companies: [],
        sectors: ["Banking & Finance"],
        impact: StoryImpact.Positive
      },
      {
        connector: "Macro MCP Connector",
        title: "India manufacturing PMI shoots up to 59.2 in June, signaling strong expansion",
        desc: "HSBC India Manufacturing Purchasing Managers' Index (PMI) indicates a phenomenal pace of growth, pointing to massive domestic customer orders and resilient manufacturing pipelines.",
        companies: [],
        sectors: ["Automotive & EVs", "Consumer Goods"],
        impact: StoryImpact.Positive
      }
    ];

    const randomEvent = marketEvents[Math.floor(Math.random() * marketEvents.length)];
    const conn = this.connectors.get(randomEvent.connector);
    
    if (conn) {
      try {
        const injectMethod = (conn as any).injectLiveUpdate;
        if (typeof injectMethod === "function") {
          injectMethod.call(conn, randomEvent.title, randomEvent.desc, randomEvent.companies, randomEvent.sectors, randomEvent.impact);
          console.log(`[MCP Simulation] Injected simulated event into: ${randomEvent.connector}`);
          this.executeSyncForConnector(conn);
        }
      } catch (err) {
        console.error("Simulation injection failed:", err);
      }
    }
  }
}
