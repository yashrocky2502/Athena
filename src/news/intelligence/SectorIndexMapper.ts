import { ExtractedEntity } from './SymbolExtractor';

export interface SectorIndexHierarchy {
  companies: string[];
  sectors: string[];
  industries: string[];
  indices: string[];
  hierarchyTrace: string[];
}

export class SectorIndexMapper {
  private static macroKeywordsMap: Record<string, { sectors: string[]; indices: string[]; tracePrefix: string }> = {
    'rbi': {
      sectors: ['Financial Services', 'Banking'],
      indices: ['BANKNIFTY', 'NIFTY 50', 'SENSEX', 'NIFTY FINANCIAL SERVICES'],
      tracePrefix: 'RBI Policy / Monetary Action',
    },
    'sebi': {
      sectors: ['Financial Services', 'Capital Markets'],
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX'],
      tracePrefix: 'SEBI Regulatory Directive',
    },
    'fed': {
      sectors: ['Information Technology', 'Financial Services'],
      indices: ['NIFTY IT', 'NIFTY 50'],
      tracePrefix: 'US Fed Interest Rate Policy',
    },
    'crude': {
      sectors: ['Energy & Petrochemicals', 'Automobile', 'Aviation'],
      indices: ['NIFTY ENERGY', 'NIFTY AUTO', 'NIFTY 50'],
      tracePrefix: 'Crude Oil Price Shock / Movement',
    },
    'fii': {
      sectors: ['Financial Services', 'Information Technology', 'Heavy Industries'],
      indices: ['NIFTY 50', 'BANKNIFTY', 'SENSEX'],
      tracePrefix: 'FII/DII Institutional Capital Flow',
    },
  };

  public static map(text: string, title: string, entities: ExtractedEntity[]): SectorIndexHierarchy {
    const combined = `${title} ${text}`.toLowerCase();
    const companiesSet = new Set<string>();
    const sectorsSet = new Set<string>();
    const industriesSet = new Set<string>();
    const indicesSet = new Set<string>();
    const traces: string[] = [];

    // 1. Map directly from extracted entities
    for (const entity of entities) {
      companiesSet.add(entity.nseSymbol);
      if (entity.sector) sectorsSet.add(entity.sector);
      if (entity.industry) industriesSet.add(entity.industry);
      for (const idx of entity.indices) {
        indicesSet.add(idx);
      }

      traces.push(
        `${entity.companyName} (${entity.nseSymbol}) ↓ ${entity.sector} ↓ ${entity.industry || 'General Industry'} ↓ ${entity.indices.join(' / ')}`
      );
    }

    // 2. Check macro themes
    for (const [kw, data] of Object.entries(this.macroKeywordsMap)) {
      if (combined.includes(kw)) {
        for (const s of data.sectors) sectorsSet.add(s);
        for (const i of data.indices) indicesSet.add(i);
        const relatedCompanies = entities.length > 0 ? entities.map(e => e.nseSymbol).join(', ') : 'Sector Securities';
        traces.push(
          `${data.tracePrefix} ↓ ${data.sectors.join(' / ')} ↓ ${relatedCompanies} ↓ ${data.indices.join(' / ')}`
        );
      }
    }

    // If no entities or macro keywords matched, default to general market
    if (traces.length === 0) {
      indicesSet.add('NIFTY 50');
      traces.push('Market News Event ↓ Broad Market ↓ NIFTY 50 / SENSEX');
    }

    return {
      companies: Array.from(companiesSet),
      sectors: Array.from(sectorsSet),
      industries: Array.from(industriesSet),
      indices: Array.from(indicesSet),
      hierarchyTrace: traces,
    };
  }
}
