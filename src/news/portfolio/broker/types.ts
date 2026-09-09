/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * types.ts
 * 
 * Canonical data contracts for Personal Broker Connectivity, Credential Vault,
 * Canonical Portfolio Normalization, Multi-Source Reconciliation, and Risk Boundaries.
 * 
 * Personal-Use Contract: Exactly 1 user, 1 installation, 1 primary Zerodha account.
 */

// ==========================================
// 1. BROKER CONNECTION & CREDENTIAL MODELS
// ==========================================

export type BrokerId = 'ZERODHA' | 'BINANCE' | 'COINDCX' | 'COINSWITCH';

export type BrokerConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'SYNCED'
  | 'STALE'
  | 'REAUTH_REQUIRED'
  | 'ERROR'
  | 'DISABLED';

export type TradingExecutionMode = 'READ_ONLY' | 'TRADING_ENABLED';

export interface BrokerCapabilities {
  profile: boolean;
  holdings: boolean;
  positions: boolean;
  orders: boolean;
  trades: boolean;
  margins: boolean;
  marketData: boolean;
  orderPlacement: boolean;
}

export interface BrokerConnectionState {
  broker: BrokerId;
  status: BrokerConnectionStatus;
  accountDescriptor: string; // Masked descriptor e.g. "Account: ****1234"
  connectedAt?: string;
  lastSuccessfulSyncAt?: string;
  lastError?: string;
  capabilities: BrokerCapabilities;
  tradingMode: TradingExecutionMode;
  userType?: string;
}

export interface MaskedCredentialDescriptor {
  broker: BrokerId;
  status: BrokerConnectionStatus;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  maskedIdentifier: string; // e.g. "Account: ****1234, Token: ********"
  lastValidatedAt?: string;
}

export interface BrokerProfile {
  userId: string;
  userName: string;
  userType: string;
  email: string;
  broker: string;
  exchanges: string[];
  orderTypes: string[];
}

export interface BrokerHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  t1Quantity: number;
  realisedQuantity: number;
  averagePrice: number;
  lastPrice: number;
  closePrice: number;
  pnl: number;
  dayChange: number;
  dayChangePercentage: number;
  assetClass: 'EQUITY' | 'ETF';
}

export interface BrokerPosition {
  tradingsymbol: string;
  exchange: string;
  instrumentToken: string | number;
  product: 'CNC' | 'NRML' | 'MIS' | string;
  quantity: number;
  overnightQuantity: number;
  multiplier: number;
  averagePrice: number;
  closePrice: number;
  lastPrice: number;
  value: number;
  pnl: number;
  m2m: number;
  unrealised: number;
  realised: number;
  buyQuantity: number;
  buyPrice: number;
  buyValue: number;
  sellQuantity: number;
  sellPrice: number;
  sellValue: number;
  dayBuyQuantity: number;
  dayBuyPrice: number;
  dayBuyValue: number;
  daySellQuantity: number;
  daySellPrice: number;
  daySellValue: number;
  
  // Derivatives specific fields
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expiryDate?: string;
}

export interface BrokerOrder {
  orderId: string;
  exchangeOrderId?: string;
  placedBy: string;
  status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED' | 'TRIGGER_PENDING';
  tradingsymbol: string;
  exchange: string;
  instrumentToken?: string | number;
  transactionType: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product: 'CNC' | 'NRML' | 'MIS';
  price: number;
  triggerPrice?: number;
  quantity: number;
  disclosedQuantity?: number;
  validity: 'DAY' | 'IOC';
  averagePrice: number;
  filledQuantity: number;
  pendingQuantity: number;
  cancelledQuantity: number;
  statusMessage?: string;
  orderTimestamp: string;
}

export interface BrokerTrade {
  tradeId: string;
  orderId: string;
  exchangeOrderId?: string;
  tradingsymbol: string;
  exchange: string;
  instrumentToken?: string | number;
  transactionType: 'BUY' | 'SELL';
  product: string;
  averagePrice: number;
  quantity: number;
  fillTimestamp: string;
}

export interface BrokerMargin {
  equity: {
    net: number;
    availableCash: number;
    usedMargin: number;
    collateral: number;
    adhocMargin: number;
  };
  commodity?: {
    net: number;
    availableCash: number;
    usedMargin: number;
  };
}

export interface BrokerReconciliationResult {
  reconciledAt: string;
  isConsistent: boolean;
  discrepancyCount: number;
  discrepancies: string[];
}

// ==========================================
// 2. BROKER ADAPTER INTERFACE
// ==========================================

export interface BrokerAdapter {
  brokerName: BrokerId;
  connect(): Promise<BrokerConnectionState>;
  disconnect(): Promise<void>;
  getProfile(): Promise<BrokerProfile>;
  getHoldings(): Promise<BrokerHolding[]>;
  getPositions(): Promise<BrokerPosition[]>;
  getOrders(): Promise<BrokerOrder[]>;
  getTrades(): Promise<BrokerTrade[]>;
  getMargins(): Promise<BrokerMargin>;
  reconcile(): Promise<BrokerReconciliationResult>;
  setTradingMode(mode: TradingExecutionMode): void;
  getTradingMode(): TradingExecutionMode;
}

// ==========================================
// 3. CANONICAL PORTFOLIO STRUCTURES
// ==========================================

export type PortfolioSourceType = 'ZERODHA' | 'EXCEL' | 'CSV' | 'MANUAL' | 'FUTURE_BROKER';

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  baseCurrency: "INR";
  createdAt: string;
  updatedAt: string;
  status: "ACTIVE" | "ARCHIVED";
  cashINR: number;
  cashBalanceINR?: number;
  holdings: CanonicalHolding[];
  positions: CanonicalPosition[];
  orders: CanonicalOrder[];
  transactions: PortfolioTransaction[];
}

export interface PortfolioTransaction {
  id: string;
  portfolioId: string;
  timestamp: string;
  symbol?: string;
  type:
    | "BUY"
    | "SELL"
    | "DIVIDEND"
    | "BONUS"
    | "SPLIT"
    | "DEPOSIT"
    | "WITHDRAWAL";
  quantity?: number;
  price?: number;
  fees?: number;
  currency: "INR";
  source: "MANUAL" | "EXCEL" | "CSV";
  notes?: string;
}

export interface PortfolioTimelineEvent {
  id: string;
  portfolioId: string;
  timestamp: string;
  type:
    | "PORTFOLIO_CREATED"
    | "PORTFOLIO_UPDATED"
    | "HOLDING_ADDED"
    | "HOLDING_UPDATED"
    | "HOLDING_CLOSED"
    | "HOLDING_DELETED"
    | "POSITION_ADDED"
    | "POSITION_UPDATED"
    | "POSITION_CLOSED"
    | "POSITION_DELETED"
    | "CASH_TRANSACTION"
    | "IMPORT_COMPLETED"
    | "IMPORT_DELETED"
    | "SNAPSHOT_CAPTURED";
  title: string;
  description: string;
  severity?: "INFO" | "SUCCESS" | "WARNING";
}

export interface PortfolioSource {
  type: PortfolioSourceType;
  identifier: string;
  capturedAt: string;
  status: 'ACTIVE' | 'STALE' | 'REFERENCE';
  itemCount: number;
}

export interface CanonicalCashState {
  totalEquityINR: number;
  availableCashINR: number;
  collateralMarginINR: number;
  currency: 'INR';
  asOf: string;
}

export interface CanonicalHolding {
  id: string;
  symbol: string;
  displayName?: string;
  exchange: string;
  isin: string;
  assetClass: 'EQUITY' | 'ETF';
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValueINR: number;
  unrealizedPnLINR: number;
  unrealizedPnLPct: number;
  realizedPnLINR: number;
  dayPnLINR: number;
  dayChangePct: number;
  sector: string;
  source: PortfolioSourceType;
  normalizedAt: string;
  purchaseDate?: string;
  notes?: string;
}

export interface CanonicalPosition {
  id: string;
  symbol: string;
  displayName?: string;
  underlyingSymbol: string;
  underlying?: string;
  exchange: string;
  product: 'CNC' | 'NRML' | 'MIS';
  assetClass: 'EQUITY' | 'FUTURES' | 'OPTIONS';
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValueINR: number;
  notionalExposureINR: number;
  unrealizedPnLINR: number;
  unrealizedPnLPct: number;
  realizedPnLINR: number;
  sector: string;
  
  // Options specific normalized details
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expiryDate?: string;
  daysToExpiry?: number;
  lotSize?: number;
  iv?: number;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  notes?: string;
  
  source: PortfolioSourceType;
  normalizedAt: string;
}

export interface CanonicalOrder {
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product: 'CNC' | 'NRML' | 'MIS';
  quantity: number;
  filledQuantity: number;
  averagePrice: number;
  price: number;
  status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED' | 'TRIGGER_PENDING';
  source: PortfolioSourceType;
  placedAt: string;
}

export interface CanonicalExecution {
  executionId: string;
  orderId: string;
  symbol: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  valueINR: number;
  broker: string;
  timestamp: string;
}

export interface CanonicalMarginState {
  totalMarginINR: number;
  availableMarginINR: number;
  usedMarginINR: number;
  marginUtilizationPct: number;
  collateralINR: number;
  callRisk: boolean;
}

export interface CanonicalExposureState {
  grossExposureINR: number;
  netExposureINR: number;
  longExposureINR: number;
  shortExposureINR: number;
  equityExposureINR: number;
  derivativesExposureINR: number;
  sectorExposure: Record<string, number>;
  topHoldingsConcentrationPct: number;
}

export interface CanonicalPortfolioRiskState {
  overallRiskScore: number; // 0-100 (100 = safest)
  var95INR: number;
  maxSingleAssetExposurePct: number;
  maxSectorExposurePct: number;
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  stressScenarios: Array<{
    name: string;
    description: string;
    estimatedPnLINR: number;
    projectedDrawdownPct: number;
  }>;
}

export interface PortfolioProvenance {
  provenanceRootHash: string;
  broker: string;
  normalizationVersion: string;
  engine: string;
  timestamp: string;
  rawItemCounts: {
    holdings: number;
    positions: number;
    orders: number;
    trades: number;
  };
}

export interface CanonicalPortfolioState {
  snapshotId: string;
  capturedAt: string;
  sources: PortfolioSource[];
  cash: CanonicalCashState;
  holdings: CanonicalHolding[];
  positions: CanonicalPosition[];
  orders: CanonicalOrder[];
  executions: CanonicalExecution[];
  margin: CanonicalMarginState;
  exposure: CanonicalExposureState;
  risk: CanonicalPortfolioRiskState;
  provenance: PortfolioProvenance;
}

// ==========================================
// 4. IMPORT & RECONCILIATION MODELS
// ==========================================

export interface PortfolioImportRow {
  symbol: string;
  exchange?: string;
  assetClass?: 'EQUITY' | 'ETF' | 'FUTURES' | 'OPTIONS';
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  sector?: string;
  optionType?: 'CALL' | 'PUT';
  strikePrice?: number;
  expiryDate?: string;
  lotSize?: number;
  investmentValue?: number;
}

export interface PortfolioImport {
  id: string;
  filename: string;
  uploadedAt: string;
  sourceType: 'EXCEL' | 'CSV';
  checksum: string;
  status: 'VALIDATED' | 'IMPORTED' | 'FAILED' | 'ARCHIVED';
  rowCount: number;
  validationErrors: string[];
  summary: {
    totalHoldings: number;
    totalPositions: number;
    estimatedValueINR: number;
  };
}

export type DiscrepancyField =
  | 'QUANTITY'
  | 'AVERAGE_PRICE'
  | 'MISSING_SYMBOL'
  | 'MISSING_POSITION'
  | 'EXPIRY_MISMATCH'
  | 'STRIKE_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'STALE_DATA';

export interface ReconciliationDiscrepancy {
  id: string;
  symbol: string;
  field: DiscrepancyField;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  brokerValue: any;
  externalValue: any;
  difference: any;
  message: string;
  timestamp: string;
}

export interface PortfolioReconciliationReport {
  reconciledAt: string;
  isConsistent: boolean;
  totalDiscrepancies: number;
  discrepancies: ReconciliationDiscrepancy[];
  sourcesCompared: PortfolioSourceType[];
  provenanceHash: string;
}

// ==========================================
// 5. OPPORTUNITY INTELLIGENCE LINKAGE
// ==========================================

export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'INTEREST';

export interface CanonicalTransaction {
  id: string;
  timestamp: string;
  type: TransactionType;
  symbol: string;
  quantity: number;
  price: number;
  amountINR: number;
  notes?: string;
  portfolioId?: string;
}

export type PortfolioActionRecommendation = 'HOLD' | 'REDUCE' | 'HEDGE' | 'EXIT' | 'ADD_TO_WATCHLIST';

export interface PortfolioOpportunityLink {
  opportunityId: string;
  symbol: string;
  opportunityType: string;
  existingExposure: boolean;
  exposureType: 'LONG' | 'SHORT' | 'SECTOR' | 'OPTIONS_VOL' | 'NONE';
  currentPositionValueINR: number;
  currentPnLINR: number;
  recommendation: PortfolioActionRecommendation;
  rationale: string;
  riskGatesPassed: boolean;
}
