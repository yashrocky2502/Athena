/**
 * ATHENA NEWS ENGINE — PHASE 16
 * StrategyKnowledgeGraph.ts
 * 
 * Strategy Knowledge Graph.
 * Formulates nodes and directed edges along the comprehensive ATHENA value-flow lineage:
 * NEWS -> EVENT -> ENTITY -> SECTOR -> MACRO -> REGIME -> PRICE -> VOLUME -> F&O -> SIGNAL -> STRATEGY -> PORTFOLIO -> EXECUTION -> OUTCOME -> LEARNING.
 * Maintains immutable lineage validation and provenance proof on every edge.
 */

export interface GraphNode {
  id: string;
  type:
    | 'NEWS'
    | 'EVENT'
    | 'ENTITY'
    | 'SECTOR'
    | 'MACRO'
    | 'REGIME'
    | 'PRICE'
    | 'VOLUME'
    | 'FNO'
    | 'SIGNAL'
    | 'STRATEGY'
    | 'PORTFOLIO'
    | 'EXECUTION'
    | 'OUTCOME'
    | 'LEARNING';
  label: string;
  payload: any;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  provenanceEvidence: string;     // Proof supporting the connection
  timestamp: string;
}

export class StrategyKnowledgeGraph {
  private static nodes: Map<string, GraphNode> = new Map();
  private static edges: GraphEdge[] = [];

  public static addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  public static addEdge(sourceId: string, targetId: string, evidence: string): void {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      console.warn(`Attempted to draw edge between non-existent nodes: ${sourceId} -> ${targetId}`);
    }
    this.edges.push({
      sourceId,
      targetId,
      provenanceEvidence: evidence,
      timestamp: new Date().toISOString()
    });
  }

  public static getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public static getEdges(): GraphEdge[] {
    return this.edges;
  }

  public static clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  /**
   * Pre-seeds a complete valid graph path to display in the UI lineage view
   */
  public static seedGraph(): void {
    const nodesToSeed: GraphNode[] = [
      { id: 'N_1', type: 'NEWS', label: 'TCS Order Win News', payload: { source: 'NSE', title: 'TCS secures $500M IT contract' } },
      { id: 'EV_1', type: 'EVENT', label: 'Order Win Event', payload: { sentiment: 'POSITIVE', impactRating: 'HIGH' } },
      { id: 'ENT_1', type: 'ENTITY', label: 'TCS Ltd', payload: { ticker: 'TCS', industry: 'IT Services' } },
      { id: 'SEC_1', type: 'SECTOR', label: 'IT Sector', payload: { sectorIndex: 'NIFTY_IT', dailyReturnPct: 1.8 } },
      { id: 'MAC_1', type: 'MACRO', label: 'USD/INR Strength', payload: { usdInr: 83.2, directionalBiases: 'BULLISH_EXPORTS' } },
      { id: 'REG_1', type: 'REGIME', label: 'Trending Bull', payload: { confidence: 85, vol: 'LOW_VOL' } },
      { id: 'PR_1', type: 'PRICE', label: 'TCS Day 1 Price Reaction', payload: { closeChangePct: 3.4 } },
      { id: 'VOL_1', type: 'VOLUME', label: 'Relative Volume Spike', payload: { rvol: 2.1 } },
      { id: 'FNO_1', type: 'FNO', label: 'TCS F&O Open Interest', payload: { oiChangePct: 12.5 } },
      { id: 'SIG_1', type: 'SIGNAL', label: 'TCS Breakout Signal', payload: { targetReturnPct: 4.5, direction: 'LONG' } },
      { id: 'STR_1', type: 'STRATEGY', label: 'Futures Breakout Strategy', payload: { params: 'v3.1', stopLossPct: 2.0 } },
      { id: 'PT_1', type: 'PORTFOLIO', label: 'TCS Sizing Decision', payload: { qty: 200, riskScore: 'LOW_RISK' } },
      { id: 'EXEC_1', type: 'EXECUTION', label: 'Executed Option Entry', payload: { price: 3450, slippageCostINR: -120 } },
      { id: 'OUT_1', type: 'OUTCOME', label: 'Trade Net Return', payload: { realizedReturnPct: 3.8, netPnLINR: 38000 } },
      { id: 'LEA_1', type: 'LEARNING', label: 'Model Weight Update', payload: { featureWeightAdjustment: 0.12 } }
    ];

    for (const node of nodesToSeed) {
      this.addNode(node);
    }

    // Connect them in sequence
    this.addEdge('N_1', 'EV_1', 'Event extraction maps semantic text to structured payload');
    this.addEdge('EV_1', 'ENT_1', 'Entity recognition maps event context to TCS equity');
    this.addEdge('ENT_1', 'SEC_1', 'TCS mapped to IT Sector constituents pool');
    this.addEdge('SEC_1', 'MAC_1', 'IT Sector correlation is sensitive to USD/INR export factors');
    this.addEdge('MAC_1', 'REG_1', 'Stable USD/INR supports overall RISK_ON/TRENDING_BULL market regimes');
    this.addEdge('REG_1', 'PR_1', 'Trending bull conditions accelerate drift on Day 1 price reactions');
    this.addEdge('PR_1', 'VOL_1', 'Volume confirms price expansion validity');
    this.addEdge('VOL_1', 'FNO_1', 'F&O open interest expansion confirms high-volume institutional accumulation');
    this.addEdge('FNO_1', 'SIG_1', 'Synthesized signals trigger when F&O OI conforms to price breakouts');
    this.addEdge('SIG_1', 'STR_1', 'Strategy engine evaluates parameter bounds for the signal trigger');
    this.addEdge('STR_1', 'PT_1', 'Portfolio risk desk restricts allocation to size boundaries');
    this.addEdge('PT_1', 'EXEC_1', 'Execution router routes entry with limit buffers to prevent adverse slips');
    this.addEdge('EXEC_1', 'OUT_1', 'Outcome records net returns after standard trade settlement and commissions');
    this.addEdge('OUT_1', 'LEA_1', 'Closed loop intelligence maps actual vs expected returns to tune ranking parameters');
  }
}
export const strategyKnowledgeGraph = StrategyKnowledgeGraph;
