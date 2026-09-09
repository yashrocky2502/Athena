/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * PortfolioImportEngine.ts
 * 
 * Secure Ingestion, Validation, and Normalization of Offline Portfolio Datasets
 * (Excel / CSV / TSV / Broker Ledger Exports).
 * 
 * Rules:
 * - Deterministic parsing and strict schema validation.
 * - Derived fields computed mathematically by ATHENA, not taken blindly from external files.
 * - Archiving or deleting an uploaded source record preserves all historical snapshots.
 */

import crypto from 'node:crypto';
import {
  PortfolioImport,
  PortfolioImportRow,
  CanonicalHolding,
  CanonicalPosition,
  PortfolioSourceType
} from './types.ts';

export class PortfolioImportEngine {
  private static instance: PortfolioImportEngine;
  private imports: Map<string, PortfolioImport & { rows: PortfolioImportRow[] }> = new Map();

  public static getInstance(): PortfolioImportEngine {
    if (!this.instance) {
      this.instance = new PortfolioImportEngine();
    }
    return this.instance;
  }

  /**
   * Parses raw CSV / TSV text into structured rows.
   */
  public parseDelimitedText(rawText: string, delimiter: string = ','): any[] {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) continue;
      
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = parts[idx] !== undefined ? parts[idx] : '';
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Previews and strictly validates an uploaded file payload before committing.
   */
  public previewAndValidate(params: {
    filename: string;
    content: string;
    sourceType?: 'EXCEL' | 'CSV';
  }): {
    isValid: boolean;
    errors: string[];
    parsedRows: PortfolioImportRow[];
    preview: {
      totalRows: number;
      estimatedHoldings: number;
      estimatedPositions: number;
      totalInvestedINR: number;
    };
    checksum: string;
  } {
    const checksum = crypto.createHash('sha256').update(params.content).digest('hex');
    const delimiter = params.filename.endsWith('.tsv') ? '\t' : ',';
    const rawRecords = this.parseDelimitedText(params.content, delimiter);

    const errors: string[] = [];
    const parsedRows: PortfolioImportRow[] = [];

    if (rawRecords.length === 0) {
      errors.push('File contains no tabular data or only headers.');
    }

    rawRecords.forEach((rec, idx) => {
      const lineNum = idx + 2;
      // Identify symbol
      const symbol = (rec['symbol'] || rec['tradingsymbol'] || rec['ticker'] || rec['instrument'] || rec['stock'])?.toUpperCase();
      if (!symbol) {
        errors.push(`Row ${lineNum}: Missing required instrument/symbol identifier.`);
        return;
      }

      // Quantity
      const qtyStr = rec['quantity'] || rec['qty'] || rec['shares'] || rec['lots'] || '0';
      const quantity = parseFloat(qtyStr);
      if (isNaN(quantity) || quantity === 0) {
        errors.push(`Row ${lineNum} (${symbol}): Invalid or zero quantity (${qtyStr}).`);
        return;
      }

      // Average Price
      const avgPriceStr = rec['averageprice'] || rec['avgprice'] || rec['buyprice'] || rec['price'] || rec['cost'] || '0';
      const averagePrice = parseFloat(avgPriceStr);
      if (isNaN(averagePrice) || averagePrice <= 0) {
        errors.push(`Row ${lineNum} (${symbol}): Invalid average price (${avgPriceStr}).`);
        return;
      }

      // Current Price (optional, default to avgPrice if missing)
      const curPriceStr = rec['currentprice'] || rec['ltp'] || rec['lastprice'] || rec['marketprice'];
      const currentPrice = curPriceStr ? parseFloat(curPriceStr) : averagePrice;

      // Exchange
      const exchange = (rec['exchange'] || (symbol.includes('FUT') || symbol.endsWith('CE') || symbol.endsWith('PE') ? 'NFO' : 'NSE')).toUpperCase();

      // Asset Class & Option details
      const isCall = symbol.endsWith('CE') || rec['optiontype']?.toUpperCase() === 'CALL';
      const isPut = symbol.endsWith('PE') || rec['optiontype']?.toUpperCase() === 'PUT';
      const isOption = isCall || isPut;
      const isFuture = !isOption && (symbol.includes('FUT') || exchange === 'NFO');
      const isEtf = symbol.includes('BEES') || symbol.includes('ETF');
      const assetClass = isOption ? 'OPTIONS' : isFuture ? 'FUTURES' : isEtf ? 'ETF' : 'EQUITY';

      let strikePrice: number | undefined;
      let expiryDate: string | undefined;

      if (isOption) {
        const strikeMatch = symbol.match(/(\d{4,6})(?:CE|PE)/);
        strikePrice = strikeMatch ? parseFloat(strikeMatch[1]) : (rec['strike'] ? parseFloat(rec['strike']) : undefined);
        expiryDate = rec['expiry'] || rec['expirydate'] || '2026-09-26';
      } else if (isFuture) {
        expiryDate = rec['expiry'] || rec['expirydate'] || '2026-09-26';
      }

      parsedRows.push({
        symbol,
        exchange,
        assetClass,
        quantity,
        averagePrice: Number(averagePrice.toFixed(2)),
        currentPrice: Number((currentPrice || averagePrice).toFixed(2)),
        optionType: isOption ? (isCall ? 'CALL' : 'PUT') : undefined,
        strikePrice,
        expiryDate,
        investmentValue: Number((Math.abs(quantity) * averagePrice).toFixed(2))
      });
    });

    const totalInvestedINR = parsedRows.reduce((sum, r) => sum + (r.investmentValue || 0), 0);
    const estimatedHoldings = parsedRows.filter(r => r.assetClass === 'EQUITY' || r.assetClass === 'ETF').length;
    const estimatedPositions = parsedRows.filter(r => r.assetClass === 'OPTIONS' || r.assetClass === 'FUTURES').length;

    return {
      isValid: errors.length === 0,
      errors,
      parsedRows,
      preview: {
        totalRows: parsedRows.length,
        estimatedHoldings,
        estimatedPositions,
        totalInvestedINR: Number(totalInvestedINR.toFixed(2))
      },
      checksum
    };
  }

  /**
   * Commits validated file rows into ATHENA's import tracking register.
   */
  public commitImport(params: {
    filename: string;
    sourceType: 'EXCEL' | 'CSV';
    parsedRows: PortfolioImportRow[];
    checksum: string;
  }): PortfolioImport {
    const importId = `IMP_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const totalInvestedINR = params.parsedRows.reduce((sum, r) => sum + (r.investmentValue || 0), 0);
    const totalHoldings = params.parsedRows.filter(r => r.assetClass === 'EQUITY' || r.assetClass === 'ETF').length;
    const totalPositions = params.parsedRows.filter(r => r.assetClass === 'OPTIONS' || r.assetClass === 'FUTURES').length;

    const record: PortfolioImport & { rows: PortfolioImportRow[] } = {
      id: importId,
      filename: params.filename,
      uploadedAt: new Date().toISOString(),
      sourceType: params.sourceType,
      checksum: params.checksum,
      status: 'IMPORTED',
      rowCount: params.parsedRows.length,
      validationErrors: [],
      summary: {
        totalHoldings,
        totalPositions,
        estimatedValueINR: Number(totalInvestedINR.toFixed(2))
      },
      rows: params.parsedRows
    };

    this.imports.set(importId, record);
    return {
      id: record.id,
      filename: record.filename,
      uploadedAt: record.uploadedAt,
      sourceType: record.sourceType,
      checksum: record.checksum,
      status: record.status,
      rowCount: record.rowCount,
      validationErrors: record.validationErrors,
      summary: record.summary
    };
  }

  /**
   * Converts imported rows into canonical holdings & positions for cross-source reconciliation.
   */
  public getNormalizedImportEntities(importId: string): {
    holdings: CanonicalHolding[];
    positions: CanonicalPosition[];
  } | null {
    const entry = this.imports.get(importId);
    if (!entry) return null;

    const now = new Date().toISOString();
    const holdings: CanonicalHolding[] = [];
    const positions: CanonicalPosition[] = [];

    entry.rows.forEach((r, idx) => {
      const curPrice = r.currentPrice || r.averagePrice;
      const mktVal = Math.abs(r.quantity) * curPrice;
      const pnl = r.quantity * (curPrice - r.averagePrice);

      if (r.assetClass === 'EQUITY' || r.assetClass === 'ETF') {
        holdings.push({
          id: `IMP_HLD_${r.symbol}_${idx}`,
          symbol: r.symbol,
          exchange: r.exchange || 'NSE',
          isin: `IMP_${r.symbol}`,
          assetClass: r.assetClass,
          quantity: r.quantity,
          averagePrice: r.averagePrice,
          currentPrice: curPrice,
          marketValueINR: Number(mktVal.toFixed(2)),
          unrealizedPnLINR: Number(pnl.toFixed(2)),
          unrealizedPnLPct: Number(((pnl / (Math.abs(r.quantity) * r.averagePrice)) * 100).toFixed(2)),
          realizedPnLINR: 0,
          dayPnLINR: 0,
          dayChangePct: 0,
          sector: 'Imported Portfolio',
          source: entry.sourceType,
          normalizedAt: now
        });
      } else {
        positions.push({
          id: `IMP_POS_${r.symbol}_${idx}`,
          symbol: r.symbol,
          underlyingSymbol: r.symbol.split(/\d/)[0] || r.symbol,
          exchange: r.exchange || 'NFO',
          product: 'NRML',
          assetClass: r.assetClass || 'OPTIONS',
          side: r.quantity >= 0 ? 'LONG' : 'SHORT',
          quantity: r.quantity,
          entryPrice: r.averagePrice,
          currentPrice: curPrice,
          marketValueINR: Number(mktVal.toFixed(2)),
          notionalExposureINR: Number((r.strikePrice ? Math.abs(r.quantity) * r.strikePrice : mktVal).toFixed(2)),
          unrealizedPnLINR: Number(pnl.toFixed(2)),
          unrealizedPnLPct: Number(((pnl / (Math.abs(r.quantity) * r.averagePrice)) * 100).toFixed(2)),
          realizedPnLINR: 0,
          sector: 'Derivatives',
          optionType: r.optionType,
          strikePrice: r.strikePrice,
          expiryDate: r.expiryDate,
          source: entry.sourceType,
          normalizedAt: now
        });
      }
    });

    return { holdings, positions };
  }

  /**
   * Returns list of all imports.
   */
  public listImports(): PortfolioImport[] {
    return Array.from(this.imports.values()).map(r => ({
      id: r.id,
      filename: r.filename,
      uploadedAt: r.uploadedAt,
      sourceType: r.sourceType,
      checksum: r.checksum,
      status: r.status,
      rowCount: r.rowCount,
      validationErrors: r.validationErrors,
      summary: r.summary
    }));
  }

  /**
   * Deletes an uploaded import source record.
   * NOTE: Does NOT delete canonical historical snapshots!
   */
  public deleteImport(id: string): boolean {
    return this.imports.delete(id);
  }
}

export const portfolioImportEngine = PortfolioImportEngine.getInstance();
