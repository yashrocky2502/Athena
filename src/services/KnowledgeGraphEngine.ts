import { GraphNode, GraphEdge, NodeType, AthenaEvent, EventType } from "../types";

export class KnowledgeGraphEngine {
  private static instance: KnowledgeGraphEngine;

  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  private constructor() {
    this.seedDefaultGraph();
  }

  public static getInstance(): KnowledgeGraphEngine {
    if (!KnowledgeGraphEngine.instance) {
      KnowledgeGraphEngine.instance = new KnowledgeGraphEngine();
    }
    return KnowledgeGraphEngine.instance;
  }

  /**
   * Seed default elements into the knowledge graph
   */
  private seedDefaultGraph(): void {
    // 1. Create standard nodes
    const initialNodes: GraphNode[] = [
      // Country
      { id: "country-in", name: "India", type: "Country" },
      { id: "country-us", name: "United States", type: "Country" },

      // Currencies
      { id: "currency-usd", name: "USD", type: "Currency" },
      { id: "currency-inr", name: "INR", type: "Currency" },

      // Commodities
      { id: "commodity-crude-oil", name: "Crude Oil", type: "Commodity" },
      { id: "commodity-lithium", name: "Lithium", type: "Commodity" },

      // Government Policies
      { id: "policy-gov-budget", name: "Government Budget", type: "Government Policy" },
      { id: "policy-rbi", name: "RBI MPC Policy", type: "Government Policy" },
      { id: "policy-green-subsidy", name: "Green Hydrogen Subsidy", type: "Government Policy" },

      // Sectors
      { id: "sector-defence", name: "Defence Sector", type: "Sector" },
      { id: "sector-aviation", name: "Aviation", type: "Sector" },
      { id: "sector-it", name: "IT Services", type: "Sector" },
      { id: "sector-automotive", name: "Automotive & EVs", type: "Sector" },
      { id: "sector-green-energy", name: "Green Energy & Power", type: "Sector" },
      { id: "sector-banking", name: "Banking", type: "Sector" },

      // Companies
      { id: "company-bel", name: "BEL", type: "Company" },
      { id: "company-tata-motors", name: "TATAMOTORS", type: "Company" },
      { id: "company-reliance", name: "RELIANCE", type: "Company" },
      { id: "company-infosys", name: "INFY", type: "Company" },
      { id: "company-hdfc", name: "HDFCBANK", type: "Company" },

      // Themes
      { id: "theme-electronics", name: "Electronics", type: "Theme" },
      { id: "theme-clean-mobility", name: "Clean Mobility", type: "Theme" },
      { id: "theme-digitalization", name: "Digitalization", type: "Theme" },

      // Index
      { id: "index-nifty", name: "Nifty 50", type: "Index" }
    ];

    // Add nodes to Map
    initialNodes.forEach(node => this.addNode(node));

    // 2. Create relationships/edges
    const initialEdges: Omit<GraphEdge, "id">[] = [
      // Government Budget -> Defence Sector
      { source: "policy-gov-budget", target: "sector-defence", relationship: "allocates defense budget to" },
      
      // Defence Sector -> BEL
      { source: "sector-defence", target: "company-bel", relationship: "drives procurement order pipelines for" },
      
      // BEL -> Electronics
      { source: "company-bel", target: "theme-electronics", relationship: "manufactures micro-chips and advanced" },
      
      // Crude Oil -> Aviation
      { source: "commodity-crude-oil", target: "sector-aviation", relationship: "determines turbine fuel operational cost for" },
      
      // USD -> IT
      { source: "currency-usd", target: "sector-it", relationship: "strengthens export realisations & demand for" },

      // Government Policy: Green Hydrogen -> Green Energy
      { source: "policy-green-subsidy", target: "sector-green-energy", relationship: "subsidizes capital infrastructure of" },

      // Green Energy -> Reliance
      { source: "sector-green-energy", target: "company-reliance", relationship: "supports solar and gigafactory investments by" },

      // IT services -> Infosys
      { source: "sector-it", target: "company-infosys", relationship: "represents core industrial vertical for" },

      // Country India -> INR
      { source: "country-in", target: "currency-inr", relationship: "sovereign issuer of" },

      // Index Nifty -> India
      { source: "index-nifty", target: "country-in", relationship: "tracks equity capital benchmark in" },

      // Automotive -> Tata Motors
      { source: "sector-automotive", target: "company-tata-motors", relationship: "represents primary manufacturer within" }
    ];

    // Add edges to Map
    initialEdges.forEach((edge, idx) => {
      this.addEdge({
        id: `edge-seed-${idx}`,
        ...edge
      });
    });
  }

  /**
   * Adds a new node to the Knowledge Graph
   */
  public addNode(node: GraphNode): void {
    if (!node.id) return;
    this.nodes.set(node.id, node);
  }

  /**
   * Adds a new edge to the Knowledge Graph
   */
  public addEdge(edge: GraphEdge): void {
    if (!edge.id) {
      edge.id = `edge-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    this.edges.set(edge.id, edge);
  }

  /**
   * Retrieves all nodes in the graph
   */
  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Retrieves all edges in the graph
   */
  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get all nodes that are directly connected to the specified node (incoming or outgoing)
   */
  public getRelatedNodes(nodeId: string): GraphNode[] {
    const relatedIds = new Set<string>();
    
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId) {
        relatedIds.add(edge.target);
      } else if (edge.target === nodeId) {
        relatedIds.add(edge.source);
      }
    }

    const result: GraphNode[] = [];
    relatedIds.forEach(id => {
      const node = this.nodes.get(id);
      if (node) {
        result.push(node);
      }
    });

    return result;
  }

  /**
   * Helper DFS/BFS to traverse downstream nodes in the directed graph
   */
  private traverseDownstream(nodeId: string, filterType: NodeType): GraphNode[] {
    const visited = new Set<string>();
    const results = new Map<string, GraphNode>();
    const queue: string[] = [nodeId];

    visited.add(nodeId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // Find downstream connected targets
      for (const edge of this.edges.values()) {
        if (edge.source === currentId) {
          const targetNode = this.nodes.get(edge.target);
          if (targetNode && !visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push(edge.target);
            
            if (targetNode.type === filterType) {
              results.set(targetNode.id, targetNode);
            }
          }
        }
      }
    }

    return Array.from(results.values());
  }

  /**
   * Traces downstream from a node to find all impacted companies (NodeType = "Company")
   */
  public findImpactedCompanies(nodeId: string): GraphNode[] {
    return this.traverseDownstream(nodeId, "Company");
  }

  /**
   * Traces downstream from a node to find all impacted sectors (NodeType = "Sector")
   */
  public findImpactedSectors(nodeId: string): GraphNode[] {
    return this.traverseDownstream(nodeId, "Sector");
  }

  /**
   * Traces the relationship path from a start node to an end node
   * Returns a sequence of edges representing the path, or null if no path exists
   */
  public traceRelationship(startNodeId: string, endNodeId: string): GraphEdge[] | null {
    if (startNodeId === endNodeId) return [];

    // BFS search to find the shortest path of edges
    // Queue stores pairs of: [current nodeId, list of edges taken so far]
    const queue: [string, GraphEdge[]][] = [[startNodeId, []]];
    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const [currentId, path] = queue.shift()!;

      if (currentId === endNodeId) {
        return path;
      }

      // Search all outgoing edges
      for (const edge of this.edges.values()) {
        if (edge.source === currentId) {
          const neighborId = edge.target;
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push([neighborId, [...path, edge]]);
          }
        }
      }
    }

    return null; // Path not found
  }

  /**
   * Automatically updates the Knowledge Graph whenever a new event is processed
   */
  public updateGraphWithEvent(event: AthenaEvent): void {
    // 1. Register the event itself as a node in the graph
    const eventNodeId = `event-${event.id}`;
    const eventNode: GraphNode = {
      id: eventNodeId,
      name: event.title,
      type: "Event",
      properties: {
        eventType: event.eventType,
        impact: event.impact,
        severity: event.severity,
        confidence: event.confidence,
        timestamp: event.timestamp
      }
    };
    this.addNode(eventNode);

    // 2. Associate event with affected companies
    event.companies.forEach(companySymbol => {
      // Find or create Company node
      let compNodeId = "";
      const matchNode = Array.from(this.nodes.values()).find(
        n => n.type === "Company" && n.name.toLowerCase() === companySymbol.toLowerCase()
      );

      if (matchNode) {
        compNodeId = matchNode.id;
      } else {
        compNodeId = `company-${companySymbol.toLowerCase()}`;
        this.addNode({
          id: compNodeId,
          name: companySymbol.toUpperCase(),
          type: "Company"
        });
      }

      // Add edge from event to company
      this.addEdge({
        id: `edge-event-${event.id}-${compNodeId}`,
        source: eventNodeId,
        target: compNodeId,
        relationship: "directly impacts stock performance of",
        properties: { impact: event.impact, severity: event.severity }
      });
    });

    // 3. Associate event with affected sectors
    event.sectors.forEach(sectorName => {
      let sectorNodeId = "";
      const matchNode = Array.from(this.nodes.values()).find(
        n => n.type === "Sector" && n.name.toLowerCase() === sectorName.toLowerCase()
      );

      if (matchNode) {
        sectorNodeId = matchNode.id;
      } else {
        // Find existing sector node matching by text similarity
        const approximateMatch = Array.from(this.nodes.values()).find(
          n => n.type === "Sector" && (
            n.name.toLowerCase().includes(sectorName.toLowerCase()) || 
            sectorName.toLowerCase().includes(n.name.toLowerCase())
          )
        );
        if (approximateMatch) {
          sectorNodeId = approximateMatch.id;
        } else {
          sectorNodeId = `sector-${sectorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          this.addNode({
            id: sectorNodeId,
            name: sectorName,
            type: "Sector"
          });
        }
      }

      // Add edge from event to sector
      this.addEdge({
        id: `edge-event-${event.id}-${sectorNodeId}`,
        source: eventNodeId,
        target: sectorNodeId,
        relationship: "disrupts macro operations of",
        properties: { impact: event.impact, severity: event.severity }
      });

      // Links Event-affected companies back to their parent sectors in the graph if they aren't already
      event.companies.forEach(companySymbol => {
        const compNode = Array.from(this.nodes.values()).find(
          n => n.type === "Company" && n.name.toLowerCase() === companySymbol.toLowerCase()
        );
        if (compNode) {
          // Check if there is an edge linking Sector -> Company already
          const existsEdge = Array.from(this.edges.values()).some(
            e => e.source === sectorNodeId && e.target === compNode.id
          );
          if (!existsEdge) {
            this.addEdge({
              id: `edge-link-${sectorNodeId}-${compNode.id}`,
              source: sectorNodeId,
              target: compNode.id,
              relationship: "houses industrial constituent"
            });
          }
        }
      });
    });

    // 4. Custom rules to link to other elements based on taxonomy / tags
    const descLower = event.description.toLowerCase();
    const titleLower = event.title.toLowerCase();

    // Government policy keyword link
    if (event.eventType === EventType.GovernmentPolicy || event.eventType === EventType.RBIPolicy) {
      const budgetNode = this.nodes.get("policy-gov-budget");
      if (budgetNode) {
        this.addEdge({
          id: `edge-event-policy-${event.id}`,
          source: eventNodeId,
          target: "policy-gov-budget",
          relationship: "derives from regulatory guidelines of"
        });
      }
    }

    // Crude oil/commodity linkages
    if (descLower.includes("crude") || descLower.includes("oil") || titleLower.includes("crude") || titleLower.includes("oil")) {
      const crudeNode = this.nodes.get("commodity-crude-oil");
      if (crudeNode) {
        this.addEdge({
          id: `edge-event-commodity-${event.id}`,
          source: eventNodeId,
          target: "commodity-crude-oil",
          relationship: "exposes market volatility from"
        });
      }
    }
  }
}
