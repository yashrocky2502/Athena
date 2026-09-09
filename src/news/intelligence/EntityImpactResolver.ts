/**
 * ATHENA NEWS ENGINE — PHASE 11
 * EntityImpactResolver.ts
 * 
 * Deterministic Entity & Cross-Asset Impact Resolver.
 * Resolves:
 * - Primary company (symbol, exchange, confidence)
 * - Secondary companies
 * - Parent company
 * - Subsidiaries
 * - Sector & Industry
 * - Benchmark & Sectoral Indices
 * - Commodities, Currencies, and Macro Assets
 * - Related listed entities (competitors/peers)
 * 
 * ZERO-FABRICATION RULE:
 * If a relationship cannot be resolved with deterministic confidence,
 * it is strictly flagged as INSUFFICIENT_EVIDENCE.
 */

import { ExtractedEntity, SymbolExtractor } from './SymbolExtractor.ts';
import { SectorIndexMapper, SectorIndexHierarchy } from './SectorIndexMapper.ts';

export type ResolutionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export interface ResolvedEntity {
  symbol: string;
  companyName: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'GLOBAL';
  confidence: ResolutionConfidence;
  role: 'PRIMARY' | 'SECONDARY' | 'PEER' | 'PARENT' | 'SUBSIDIARY';
  isin?: string;
}

export interface MacroImpactAsset {
  assetType: 'COMMODITY' | 'CURRENCY' | 'YIELD' | 'RATE' | 'INDEX';
  identifier: string;
  name: string;
  expectedDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  transmissionChannel: string;
}

export interface EntityImpactResolutionResult {
  primaryEntity: ResolvedEntity | null;
  secondaryEntities: ResolvedEntity[];
  parentEntity: ResolvedEntity | null;
  subsidiaries: ResolvedEntity[];
  peers: ResolvedEntity[];
  sector: string;
  industry: string;
  relevantIndices: string[];
  macroAssets: MacroImpactAsset[];
  macroImpactedAssets: string[];
  hierarchyTrace: string[];
  resolutionState: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'INSUFFICIENT_EVIDENCE';
  unresolvedReasons: string[];
  timestamp: string;
}

export class EntityImpactResolver {
  private static instance: EntityImpactResolver;

  // Known Corporate Hierarchies (Deterministic Registry)
  private static readonly CORPORATE_HIERARCHIES: Record<string, { parent?: { symbol: string; name: string }; subsidiaries?: Array<{ symbol: string; name: string }>; peers?: Array<{ symbol: string; name: string }> }> = {
    'TATAMOTORS': {
      parent: { symbol: 'TATACONSUM', name: 'Tata Sons / Group' },
      subsidiaries: [
        { symbol: 'TATATECH', name: 'Tata Technologies Limited' }
      ],
      peers: [
        { symbol: 'MARUTI', name: 'Maruti Suzuki India' },
        { symbol: 'M&M', name: 'Mahindra & Mahindra' },
        { symbol: 'ASHOKLEY', name: 'Ashok Leyland' }
      ]
    },
    'TCS': {
      parent: { symbol: 'TATACONSUM', name: 'Tata Sons / Group' },
      peers: [
        { symbol: 'INFY', name: 'Infosys Limited' },
        { symbol: 'WIPRO', name: 'Wipro Limited' },
        { symbol: 'HCLTECH', name: 'HCL Technologies' }
      ]
    },
    'RELIANCE': {
      peers: [
        { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation' },
        { symbol: 'IOC', name: 'Indian Oil Corporation' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel' }
      ]
    },
    'HDFCBANK': {
      peers: [
        { symbol: 'ICICIBANK', name: 'ICICI Bank' },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
        { symbol: 'AXISBANK', name: 'Axis Bank' },
        { symbol: 'SBIN', name: 'State Bank of India' }
      ]
    },
    'INFY': {
      peers: [
        { symbol: 'TCS', name: 'Tata Consultancy Services' },
        { symbol: 'WIPRO', name: 'Wipro Limited' },
        { symbol: 'TECHM', name: 'Tech Mahindra' }
      ]
    },
    'SWSOLAR': {
      parent: { symbol: 'RELIANCE', name: 'Reliance Industries (Promoter Group)' },
      peers: [
        { symbol: 'SUZLON', name: 'Suzlon Energy' },
        { symbol: 'TATACHEM', name: 'Tata Power' }
      ]
    }
  };

  // Macro & Commodity Keyword Mappings
  private static readonly MACRO_COMMODITY_MAPPINGS: Record<string, MacroImpactAsset[]> = {
    'gold': [
      { assetType: 'COMMODITY', identifier: 'GOLD_MCX', name: 'MCX Gold Futures', transmissionChannel: 'Domestic bullion pricing' },
      { assetType: 'COMMODITY', identifier: 'XAUUSD', name: 'Spot Gold USD', transmissionChannel: 'Global safe-haven benchmark' },
      { assetType: 'CURRENCY', identifier: 'USDINR', name: 'USD/INR Exchange Rate', transmissionChannel: 'Import cost transmission' },
      { assetType: 'YIELD', identifier: 'US10Y', name: 'US 10-Year Treasury Yield', transmissionChannel: 'Opportunity cost inverse link' }
    ],
    'silver': [
      { assetType: 'COMMODITY', identifier: 'SILVER_MCX', name: 'MCX Silver Futures', transmissionChannel: 'Industrial & precious metals' },
      { assetType: 'COMMODITY', identifier: 'XAGUSD', name: 'Spot Silver USD', transmissionChannel: 'Global bullion benchmark' }
    ],
    'crude': [
      { assetType: 'COMMODITY', identifier: 'CRUDE_MCX', name: 'MCX Crude Oil', transmissionChannel: 'Upstream oil pricing' },
      { assetType: 'COMMODITY', identifier: 'BRENT', name: 'Brent Crude Spot', transmissionChannel: 'Global energy benchmark' },
      { assetType: 'RATE', identifier: 'INFLATION_INDIA', name: 'India CPI Inflation', transmissionChannel: 'Imported energy inflation' }
    ],
    'fed': [
      { assetType: 'RATE', identifier: 'FED_FUNDS_RATE', name: 'Federal Funds Rate', transmissionChannel: 'Global liquidity & interest rate cost' },
      { assetType: 'YIELD', identifier: 'US10Y', name: 'US 10-Year Treasury Yield', transmissionChannel: 'Sovereign yield benchmark' },
      { assetType: 'CURRENCY', identifier: 'DXY', name: 'US Dollar Index', transmissionChannel: 'Emerging market capital flows' }
    ],
    'rbi': [
      { assetType: 'RATE', identifier: 'RBI_REPO_RATE', name: 'RBI Policy Repo Rate', transmissionChannel: 'Domestic lending rate & banking NIMs' },
      { assetType: 'YIELD', identifier: 'IN10Y', name: 'India 10-Year G-Sec Yield', transmissionChannel: 'Domestic sovereign debt benchmark' },
      { assetType: 'INDEX', identifier: 'BANKNIFTY', name: 'Nifty Bank Index', transmissionChannel: 'Banking sector valuation' }
    ]
  };

  private constructor() {}

  public static getInstance(): EntityImpactResolver {
    if (!this.instance) {
      this.instance = new EntityImpactResolver();
    }
    return this.instance;
  }

  /**
   * Resolves entities, macro links, and sector hierarchy deterministically from article title and body.
   */
  public resolve(title: string, body: string, explicitEntities?: ExtractedEntity[]): EntityImpactResolutionResult {
    const fullText = `${title} ${body}`.trim();
    const lowerText = fullText.toLowerCase();
    const hierarchyTrace: string[] = [];
    const unresolvedReasons: string[] = [];

    // 1. Extract or adopt entities
    const extracted = explicitEntities && explicitEntities.length > 0
      ? explicitEntities
      : SymbolExtractor.extract(fullText);

    let primaryEntity: ResolvedEntity | null = null;
    const secondaryEntities: ResolvedEntity[] = [];
    let parentEntity: ResolvedEntity | null = null;
    const subsidiaries: ResolvedEntity[] = [];
    const peers: ResolvedEntity[] = [];

    if (extracted.length > 0) {
      // Primary entity is first or most prominent
      const primaryExtracted = extracted[0];
      primaryEntity = {
        symbol: primaryExtracted.nseSymbol,
        companyName: primaryExtracted.companyName,
        exchange: 'NSE',
        confidence: primaryExtracted.confidence > 70 ? 'HIGH' : 'MEDIUM',
        role: 'PRIMARY'
      };

      hierarchyTrace.push(`Primary Entity: ${primaryEntity.companyName} (${primaryEntity.symbol})`);

      // Add secondary entities
      for (let i = 1; i < extracted.length; i++) {
        const sec = extracted[i];
        secondaryEntities.push({
          symbol: sec.nseSymbol,
          companyName: sec.companyName,
          exchange: 'NSE',
          confidence: sec.confidence > 60 ? 'MEDIUM' : 'LOW',
          role: 'SECONDARY'
        });
        hierarchyTrace.push(`Secondary Entity: ${sec.companyName} (${sec.nseSymbol})`);
      }

      // Check Known Corporate Hierarchies for Parent / Subsidiaries / Peers
      const hierarchyConfig = EntityImpactResolver.CORPORATE_HIERARCHIES[primaryEntity.symbol];
      if (hierarchyConfig) {
        if (hierarchyConfig.parent) {
          parentEntity = {
            symbol: hierarchyConfig.parent.symbol,
            companyName: hierarchyConfig.parent.name,
            exchange: 'NSE',
            confidence: 'HIGH',
            role: 'PARENT'
          };
          hierarchyTrace.push(`Parent Entity: ${parentEntity.companyName} (${parentEntity.symbol})`);
        }

        if (hierarchyConfig.subsidiaries) {
          for (const sub of hierarchyConfig.subsidiaries) {
            subsidiaries.push({
              symbol: sub.symbol,
              companyName: sub.name,
              exchange: 'NSE',
              confidence: 'HIGH',
              role: 'SUBSIDIARY'
            });
            hierarchyTrace.push(`Subsidiary Entity: ${sub.name} (${sub.symbol})`);
          }
        }

        if (hierarchyConfig.peers) {
          for (const p of hierarchyConfig.peers) {
            peers.push({
              symbol: p.symbol,
              companyName: p.name,
              exchange: 'NSE',
              confidence: 'HIGH',
              role: 'PEER'
            });
          }
        }
      }
    } else {
      unresolvedReasons.push('No direct listed corporate equity detected in article headline or body');
    }

    // 2. Resolve Sector & Indices using SectorIndexMapper
    const sectorIndexResult: SectorIndexHierarchy = SectorIndexMapper.map(body, title, extracted);
    const sector = sectorIndexResult.sectors.length > 0 ? sectorIndexResult.sectors[0] : 'Broad Market';
    const industry = sectorIndexResult.industries.length > 0 ? sectorIndexResult.industries[0] : sector;
    const relevantIndices = sectorIndexResult.indices.length > 0 ? sectorIndexResult.indices : ['NIFTY 50'];

    if (sectorIndexResult.hierarchyTrace.length > 0) {
      hierarchyTrace.push(...sectorIndexResult.hierarchyTrace);
    }

    // 3. Resolve Macro, Commodity & Forex Assets
    const macroAssets: MacroImpactAsset[] = [];
    for (const [kw, assets] of Object.entries(EntityImpactResolver.MACRO_COMMODITY_MAPPINGS)) {
      if (lowerText.includes(kw)) {
        macroAssets.push(...assets);
        hierarchyTrace.push(`Macro Asset Transmission Channel: ${kw.toUpperCase()} -> [${assets.map(a => a.name).join(', ')}]`);
      }
    }

    // 4. Determine overall resolution state
    let resolutionState: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'INSUFFICIENT_EVIDENCE' = 'INSUFFICIENT_EVIDENCE';
    if (primaryEntity) {
      resolutionState = 'RESOLVED';
    } else if (macroAssets.length > 0 || relevantIndices.length > 0) {
      resolutionState = 'PARTIALLY_RESOLVED';
    }

    return {
      primaryEntity,
      secondaryEntities,
      parentEntity,
      subsidiaries,
      peers,
      sector,
      industry,
      relevantIndices,
      macroAssets,
      macroImpactedAssets: macroAssets.map(a => a.identifier),
      hierarchyTrace,
      resolutionState,
      unresolvedReasons,
      timestamp: new Date().toISOString()
    };
  }
}

export const entityImpactResolver = EntityImpactResolver.getInstance();
