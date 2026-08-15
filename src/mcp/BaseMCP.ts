export interface MCPMetrics {
  status: "online" | "offline" | "syncing" | "error";
  lastSuccessfulSync: Date | null;
  averageLatency: number; // in milliseconds
  lastError: string | null;
  recordsProcessed: number;
  changedRecords: number;
  failedRecords: number;
  queueSize: number;
  // MCP Health requirements
  latencyMs: number;
  successRate: number;
  lastSync: Date | null;
  errorCount: number;
  averageResponseTime: number;
}

export interface BaseMCP {
  /**
   * Initializes the connector, sets up initial states, verifies API configurations if any.
   */
  initialize(): Promise<void>;

  /**
   * Performs self-diagnostic checks.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Fetches latest raw feeds, disclosures, or alerts from target endpoint.
   */
  fetchUpdates(): Promise<any[]>;

  /**
   * Converts the source-specific raw record into a normalized Athena Event/Evidence format.
   */
  normalize(raw: any): any;

  /**
   * Timestamp of the last execution (whether successful or failed).
   */
  lastSync(): Date | null;

  /**
   * Priority score of the connector (e.g. 1 to 10), used by orchestrator for ingestion sorting.
   */
  priority(): number;

  /**
   * List of supported sources (e.g. ["NSE Disclosure", "NSE Corporate Action"])
   */
  supportedSources(): string[];

  /**
   * The current live status.
   */
  status(): "online" | "offline" | "syncing" | "error";

  /**
   * Exposes operational performance metrics for Developer Mode panels.
   */
  getMetrics(): MCPMetrics;

  /**
   * Refresh interval in milliseconds.
   */
  getRefreshInterval(): number;

  /**
   * Unique name identifier for the connector.
   */
  getName(): string;
}
