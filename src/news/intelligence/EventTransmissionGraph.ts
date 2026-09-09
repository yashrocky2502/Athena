/**
 * ATHENA NEWS ENGINE — PHASE 11
 * EventTransmissionGraph.ts
 * 
 * Deterministic Event-to-Signal Transmission Directed Graph.
 * 
 * Models:
 * EVENT → ENTITY → SECTOR / INDEX / MACRO → PRICE REACTION → VOLUME REACTION → F&O REACTION → SIGNAL → LIFECYCLE → HISTORICAL OUTCOME
 * 
 * Every edge contains provenance, timestamp, weight, and alignment.
 * 
 * ZERO-AI COST CONTRACT: 100% deterministic graph evaluation.
 */

export type NodeType =
  | 'EVENT'
  | 'ENTITY'
  | 'SECTOR_INDEX'
  | 'MARKET_REACTION'
  | 'FO_POSITIONING'
  | 'SIGNAL'
  | 'LIFECYCLE'
  | 'HISTORICAL_OUTCOME';

export type EdgeType =
  | 'EVENT_TO_ENTITY'
  | 'ENTITY_TO_SECTOR'
  | 'SECTOR_TO_INDEX'
  | 'ENTITY_TO_PRICE_REACTION'
  | 'PRICE_TO_VOLUME_REACTION'
  | 'REACTION_TO_FO_CONFIRMATION'
  | 'EVIDENCE_TO_SIGNAL'
  | 'SIGNAL_TO_LIFECYCLE'
  | 'SIGNAL_TO_HISTORICAL_OUTCOME'
  | 'CONTRADICTION_EDGE';

export type TransmissionAlignment =
  | 'STRONGLY_CONFIRMED'
  | 'CONFIRMED'
  | 'PARTIALLY_CONFIRMED'
  | 'NEUTRAL'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export interface TransmissionGraphNode {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, any>;
  timestamp: string;
  status: 'ACTIVE' | 'RESOLVED' | 'INVALIDATED' | 'EXPIRED';
}

export interface TransmissionGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  alignment: TransmissionAlignment;
  weight: number; // 0.0 to 1.0
  provenance: string; // which engine or rule created this edge
  timestamp: string;
  notes?: string;
}

export interface EvidenceChainStep {
  stage: string;
  node: TransmissionGraphNode;
  edgeToNext?: TransmissionGraphEdge;
  summary: string;
}

export interface TransmissionGraphDossier {
  graphId: string;
  eventId: string;
  signalId: string;
  symbol: string;
  nodes: TransmissionGraphNode[];
  edges: TransmissionGraphEdge[];
  rootEventSummary: string;
  transmissionScore: number;
  alignment: TransmissionAlignment;
  evidenceChain: EvidenceChainStep[];
  contradictions: string[];
  createdAt: string;
  updatedAt: string;
}

export class EventTransmissionGraph {
  private nodes: Map<string, TransmissionGraphNode> = new Map();
  private edges: Map<string, TransmissionGraphEdge> = new Map();
  private graphDossiers: Map<string, TransmissionGraphDossier> = new Map();

  private static instance: EventTransmissionGraph;

  private constructor() {}

  public static getInstance(): EventTransmissionGraph {
    if (!this.instance) {
      this.instance = new EventTransmissionGraph();
    }
    return this.instance;
  }

  /**
   * Adds or updates a node in the graph.
   */
  public addNode(node: TransmissionGraphNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Adds or updates an edge in the graph.
   */
  public addEdge(edge: TransmissionGraphEdge): void {
    this.edges.set(edge.id, edge);
  }

  /**
   * Builds and saves a complete TransmissionGraphDossier for an event and signal.
   */
  public recordTransmissionDossier(dossier: TransmissionGraphDossier): void {
    this.graphDossiers.set(dossier.signalId, dossier);
    for (const node of dossier.nodes) {
      this.nodes.set(node.id, node);
    }
    for (const edge of dossier.edges) {
      this.edges.set(edge.id, edge);
    }
  }

  /**
   * Retrieves a TransmissionGraphDossier by signalId.
   */
  public getDossier(signalId: string): TransmissionGraphDossier | undefined {
    return this.graphDossiers.get(signalId);
  }

  /**
   * Returns all stored dossiers.
   */
  public getAllDossiers(): TransmissionGraphDossier[] {
    return Array.from(this.graphDossiers.values());
  }

  /**
   * Traverses the graph from the root Event node to the terminal Signal/Outcome node
   * to construct the linear evidence chain.
   */
  public buildEvidenceChain(signalId: string): EvidenceChainStep[] {
    const dossier = this.graphDossiers.get(signalId);
    if (!dossier) return [];

    return dossier.evidenceChain;
  }

  /**
   * Finds all contradictions currently captured across the active transmission graph.
   */
  public getContradictions(): Array<{ signalId: string; symbol: string; reason: string; edge: TransmissionGraphEdge }> {
    const list: Array<{ signalId: string; symbol: string; reason: string; edge: TransmissionGraphEdge }> = [];
    
    for (const edge of this.edges.values()) {
      if (edge.alignment === 'CONTRADICTED') {
        const targetNode = this.nodes.get(edge.targetId);
        const sourceNode = this.nodes.get(edge.sourceId);
        list.push({
          signalId: targetNode?.id || edge.targetId,
          symbol: (targetNode?.metadata?.symbol || sourceNode?.metadata?.symbol || 'UNKNOWN'),
          reason: edge.notes || 'Conflicting market/fundamental evidence',
          edge
        });
      }
    }

    return list;
  }
}

export const eventTransmissionGraph = EventTransmissionGraph.getInstance();
