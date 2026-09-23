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
import * as XLSX from 'xlsx';
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
   * Normalizes header strings for case-insensitive, whitespace-tolerant column matching.
   */
  private normalizeHeader(header: any): string {
    return String(header ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parses raw CSV / TSV text into structured rows.
   */
  public parseDelimitedText(rawText: string, delimiter: string = ','): any[] {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const headers = rawHeaders.map(h => this.normalizeHeader(h));
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) continue;
      
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = parts[idx] !== undefined ? parts[idx] : '';
      });
      // Also preserve original case-insensitive keys without spaces
      rawHeaders.forEach((rawH, idx) => {
        const keyNoSpace = rawH.toLowerCase().replace(/[\s_-]/g, '');
        record[keyNoSpace] = parts[idx] !== undefined ? parts[idx] : '';
      });
      records.push(record);
    }

    return records;
  }

  /**
   * Robust Excel (.xlsx, .xls) workbook parser with automated sheet discovery,
   * header row scanning, broker variation tolerance, and strict zero-fabrication guarantees.
   */
  public parseExcelWorkbook(
    data: Buffer | ArrayBuffer | Uint8Array | string
  ): {
    rows: PortfolioImportRow[];
    errors: string[];
    detectedSheet?: string;
  } {
    let workbook: XLSX.WorkBook;
    try {
      if (typeof data === 'string') {
        let clean = data.trim();
        // Strip data URL prefix if present
        if (clean.startsWith('data:')) {
          const commaIdx = clean.indexOf(',');
          if (commaIdx !== -1) {
            clean = clean.slice(commaIdx + 1);
          }
        }
        // Check if base64 encoded or binary string
        if (/^[A-Za-z0-9+/=\r\n]+$/.test(clean) && (clean.startsWith('UEsDB') || clean.length % 4 === 0)) {
          const buf = Buffer.from(clean, 'base64');
          workbook = XLSX.read(buf, { type: 'buffer' });
        } else {
          workbook = XLSX.read(clean, { type: 'binary' });
        }
      } else if (Buffer.isBuffer(data)) {
        workbook = XLSX.read(data, { type: 'buffer' });
      } else {
        workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      }
    } catch (err: any) {
      return {
        rows: [],
        errors: ['Failed to read Excel workbook: invalid or corrupted file format.']
      };
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        rows: [],
        errors: ['No supported holdings table was found in this Excel workbook.']
      };
    }

    const sheetNames = workbook.SheetNames;

    // Helper to identify excluded sheets (e.g. Mutual Funds must not be imported as equity positions)
    const isExcludedSheet = (name: string): boolean => {
      const n = name.toLowerCase();
      return (
        n.includes('mutual fund') ||
        n.includes('mutual_fund') ||
        n.includes('mutualfunds') ||
        n === 'mf' ||
        n.startsWith('mf ') ||
        n.includes('summary') ||
        n.includes('disclaimer') ||
        n.includes('notes') ||
        n.includes('cash') ||
        n.includes('margin')
      );
    };

    // Rank candidate sheets:
    // 1. Explicit Equity sheets
    // 2. Generic Holdings / Portfolio sheets (excluding Combined)
    // 3. Combined / All sheets (only as fallback)
    // 4. Any other non-excluded sheets
    const equitySheets = sheetNames.filter(s => /(equity|equities|stock|share)/i.test(s) && !isExcludedSheet(s));
    const generalHoldingsSheets = sheetNames.filter(s => /(holdings|portfolio)/i.test(s) && !/(combined|all)/i.test(s) && !isExcludedSheet(s));
    const combinedSheets = sheetNames.filter(s => /(combined|all)/i.test(s) && !isExcludedSheet(s));
    const otherSheets = sheetNames.filter(s => !isExcludedSheet(s) && !equitySheets.includes(s) && !generalHoldingsSheets.includes(s) && !combinedSheets.includes(s));

    const candidateSheets = [...equitySheets, ...generalHoldingsSheets, ...combinedSheets, ...otherSheets];

    if (candidateSheets.length === 0) {
      return {
        rows: [],
        errors: ['No supported holdings table was found in this Excel workbook.']
      };
    }

    // Inspect candidate sheets in priority order
    for (const sheetName of candidateSheets) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const sheetData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      if (!sheetData || sheetData.length === 0) continue;

      // Scan rows to discover the header row (do NOT hardcode row 23 or any fixed row)
      let headerRowIdx = -1;
      let colSymbol = -1;
      let colQty = -1;
      let colAvgPrice = -1;
      let colCurrentPrice = -1;
      let colSector = -1;
      let colISIN = -1;
      let colExchange = -1;

      const maxScanRow = Math.min(sheetData.length - 1, 60);

      for (let r = 0; r <= maxScanRow; r++) {
        const row = sheetData[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        const normCells = row.map(c => this.normalizeHeader(c));

        let foundSymbol = -1;
        let foundQty = -1;
        let foundAvgPrice = -1;
        let foundCurrentPrice = -1;
        let foundSector = -1;
        let foundISIN = -1;
        let foundExchange = -1;

        normCells.forEach((norm, cIdx) => {
          if (!norm) return;

          // Symbol mappings
          if (
            norm === 'symbol' ||
            norm === 'tradingsymbol' ||
            norm === 'trading symbol' ||
            norm === 'instrument' ||
            norm === 'stock' ||
            norm === 'stock symbol' ||
            norm === 'scrip' ||
            norm === 'scrip name' ||
            norm === 'company' ||
            norm === 'company name' ||
            norm === 'security' ||
            norm === 'security name' ||
            norm === 'name of the company' ||
            norm === 'security description'
          ) {
            foundSymbol = cIdx;
          }

          // Quantity Available mappings (prefer explicit 'quantity available' or 'available qty')
          if (
            norm === 'quantity available' ||
            norm === 'qty available' ||
            norm === 'available qty' ||
            norm === 'available quantity' ||
            norm === 'quantity' ||
            norm === 'qty' ||
            norm === 'holding qty' ||
            norm === 'total qty' ||
            norm === 'shares' ||
            norm === 'lots' ||
            norm === 'net qty' ||
            norm === 'curr qty'
          ) {
            if (foundQty === -1 || norm.includes('available')) {
              foundQty = cIdx;
            }
          }

          // Average Price mappings
          if (
            norm === 'average price' ||
            norm === 'avg price' ||
            norm === 'buy price' ||
            norm === 'avg cost' ||
            norm === 'average cost' ||
            norm === 'buy avg' ||
            norm === 'avg buy price' ||
            norm === 'purchase price' ||
            norm === 'cost' ||
            norm === 'price'
          ) {
            if (foundAvgPrice === -1 || norm.includes('average') || norm.includes('avg') || norm.includes('buy')) {
              foundAvgPrice = cIdx;
            }
          }

          // Previous Closing Price / Current Price mappings
          if (
            norm === 'previous closing price' ||
            norm === 'prev closing price' ||
            norm === 'prev close' ||
            norm === 'previous close' ||
            norm === 'closing price' ||
            norm === 'close price' ||
            norm === 'ltp' ||
            norm === 'current price' ||
            norm === 'last price' ||
            norm === 'market price' ||
            norm === 'last traded price'
          ) {
            if (foundCurrentPrice === -1 || norm.includes('previous') || norm.includes('prev') || norm.includes('closing')) {
              foundCurrentPrice = cIdx;
            }
          }

          // Sector mappings
          if (
            norm === 'sector' ||
            norm === 'industry' ||
            norm === 'sector industry' ||
            norm === 'segment'
          ) {
            foundSector = cIdx;
          }

          // ISIN mappings
          if (
            norm === 'isin' ||
            norm === 'isin code' ||
            norm === 'isin number' ||
            norm === 'isin no'
          ) {
            foundISIN = cIdx;
          }

          // Exchange mappings
          if (
            norm === 'exchange' ||
            norm === 'exch'
          ) {
            foundExchange = cIdx;
          }
        });

        // A valid holdings header row must at least contain a symbol column and a quantity or price column
        if (foundSymbol !== -1 && (foundQty !== -1 || foundAvgPrice !== -1 || foundCurrentPrice !== -1)) {
          headerRowIdx = r;
          colSymbol = foundSymbol;
          colQty = foundQty;
          colAvgPrice = foundAvgPrice;
          colCurrentPrice = foundCurrentPrice;
          colSector = foundSector;
          colISIN = foundISIN;
          colExchange = foundExchange;
          break;
        }
      }

      if (headerRowIdx === -1) {
        // No header row found in this sheet, try next candidate sheet
        continue;
      }

      // Parse data rows below the discovered header row
      const parsedRows: PortfolioImportRow[] = [];
      const sheetErrors: string[] = [];

      for (let rIdx = headerRowIdx + 1; rIdx < sheetData.length; rIdx++) {
        const row = sheetData[rIdx];
        if (!Array.isArray(row) || row.length === 0) continue;

        const rawSymbolVal = colSymbol !== -1 ? String(row[colSymbol] ?? '').trim() : '';
        if (!rawSymbolVal) continue;

        // Skip total / summary / disclaimer rows
        const lowerSymbol = rawSymbolVal.toLowerCase();
        if (
          lowerSymbol.startsWith('total') ||
          lowerSymbol.startsWith('grand total') ||
          lowerSymbol.startsWith('sub total') ||
          lowerSymbol.startsWith('subtotal') ||
          lowerSymbol.startsWith('summary') ||
          lowerSymbol.startsWith('disclaimer') ||
          lowerSymbol.startsWith('notes') ||
          lowerSymbol.startsWith('*')
        ) {
          continue;
        }

        // Symbol normalization: trim whitespace, preserve genuine security symbol
        const symbol = rawSymbolVal.toUpperCase().replace(/\.(NSE|BSE)$/, '');

        // Quantity Available extraction & normalization
        let quantity = 0;
        if (colQty !== -1 && row[colQty] !== undefined && row[colQty] !== '') {
          const qStr = String(row[colQty]).replace(/,/g, '').trim();
          quantity = parseFloat(qStr);
        }

        if (isNaN(quantity) || quantity === 0) {
          // Zero or missing quantity: skip row or record error
          continue;
        }

        // Average Price extraction & normalization
        let averagePrice = NaN;
        if (colAvgPrice !== -1 && row[colAvgPrice] !== undefined && row[colAvgPrice] !== '') {
          const avgStr = String(row[colAvgPrice]).replace(/[^0-9.-]/g, '').trim();
          averagePrice = parseFloat(avgStr);
        }

        // Genuinely absent price handling: strictly NO fabrication of ₹100 or default prices
        if (isNaN(averagePrice) || averagePrice <= 0) {
          sheetErrors.push(`Row ${rIdx + 1} (${symbol}): Missing or invalid average purchase price.`);
          continue;
        }

        // Previous Closing Price / Current Price extraction
        let currentPrice: number | undefined;
        if (colCurrentPrice !== -1 && row[colCurrentPrice] !== undefined && row[colCurrentPrice] !== '') {
          const curStr = String(row[colCurrentPrice]).replace(/[^0-9.-]/g, '').trim();
          const parsedCur = parseFloat(curStr);
          if (!isNaN(parsedCur) && parsedCur > 0) {
            currentPrice = Number(parsedCur.toFixed(2));
          }
        }

        // Sector extraction
        const sector = colSector !== -1 && row[colSector] ? String(row[colSector]).trim() : undefined;

        // ISIN extraction
        const isin = colISIN !== -1 && row[colISIN] ? String(row[colISIN]).trim() : undefined;

        // Exchange extraction
        const rawExch = colExchange !== -1 && row[colExchange] ? String(row[colExchange]).trim().toUpperCase() : 'NSE';
        const exchange = rawExch.includes('BSE') ? 'BSE' : 'NSE';

        // Asset class identification
        const isEtf = symbol.includes('BEES') || symbol.includes('ETF');
        const assetClass: 'EQUITY' | 'ETF' = isEtf ? 'ETF' : 'EQUITY';

        const avgPriceNum = Number(averagePrice.toFixed(2));
        const finalCurPrice = currentPrice !== undefined ? currentPrice : avgPriceNum;
        const investmentValue = Number((Math.abs(quantity) * avgPriceNum).toFixed(2));

        parsedRows.push({
          symbol,
          exchange,
          assetClass,
          quantity,
          averagePrice: avgPriceNum,
          currentPrice: finalCurPrice,
          sector: sector || undefined,
          isin: isin || undefined,
          investmentValue
        });
      }

      // If we successfully extracted valid rows from this sheet, return immediately.
      // This guarantees we DO NOT duplicate holdings from the Combined sheet when Equity was parsed.
      if (parsedRows.length > 0) {
        return {
          rows: parsedRows,
          errors: sheetErrors,
          detectedSheet: sheetName
        };
      }
    }

    return {
      rows: [],
      errors: ['No supported holdings table was found in this Excel workbook.']
    };
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
    const lowerFilename = (params.filename || '').toLowerCase();
    const isExcel =
      params.sourceType === 'EXCEL' ||
      lowerFilename.endsWith('.xlsx') ||
      lowerFilename.endsWith('.xls') ||
      params.content.startsWith('UEsDB') ||
      params.content.startsWith('PK');

    const errors: string[] = [];
    const parsedRows: PortfolioImportRow[] = [];

    if (isExcel) {
      const excelResult = this.parseExcelWorkbook(params.content);
      if (excelResult.errors.length > 0 && excelResult.rows.length === 0) {
        errors.push(...excelResult.errors);
      } else {
        parsedRows.push(...excelResult.rows);
        if (excelResult.errors.length > 0) {
          errors.push(...excelResult.errors);
        }
      }
    } else {
      const delimiter = params.filename.endsWith('.tsv') ? '\t' : ',';
      const rawRecords = this.parseDelimitedText(params.content, delimiter);

      if (rawRecords.length === 0) {
        errors.push('File contains no tabular data or only headers.');
      }

      rawRecords.forEach((rec, idx) => {
        const lineNum = idx + 2;
        // Identify symbol
        const symbol = (
          rec['symbol'] ||
          rec['tradingsymbol'] ||
          rec['trading symbol'] ||
          rec['ticker'] ||
          rec['instrument'] ||
          rec['stock'] ||
          rec['scrip']
        )?.toUpperCase()?.trim();

        if (!symbol) {
          errors.push(`Row ${lineNum}: Missing required instrument/symbol identifier.`);
          return;
        }

        // Quantity Available / Quantity
        const qtyStr =
          rec['quantity available'] ||
          rec['quantityavailable'] ||
          rec['available qty'] ||
          rec['availableqty'] ||
          rec['quantity'] ||
          rec['qty'] ||
          rec['shares'] ||
          rec['lots'] ||
          '0';
        const quantity = parseFloat(String(qtyStr).replace(/,/g, ''));
        if (isNaN(quantity) || quantity === 0) {
          errors.push(`Row ${lineNum} (${symbol}): Invalid or zero quantity (${qtyStr}).`);
          return;
        }

        // Average Price
        const avgPriceStr =
          rec['average price'] ||
          rec['averageprice'] ||
          rec['avg price'] ||
          rec['avgprice'] ||
          rec['buy price'] ||
          rec['buyprice'] ||
          rec['price'] ||
          rec['cost'] ||
          '0';
        const averagePrice = parseFloat(String(avgPriceStr).replace(/[^0-9.-]/g, ''));
        if (isNaN(averagePrice) || averagePrice <= 0) {
          errors.push(`Row ${lineNum} (${symbol}): Invalid average price (${avgPriceStr}).`);
          return;
        }

        // Current Price / Previous Closing Price
        const curPriceStr =
          rec['previous closing price'] ||
          rec['previousclosingprice'] ||
          rec['prev close'] ||
          rec['prevclose'] ||
          rec['current price'] ||
          rec['currentprice'] ||
          rec['ltp'] ||
          rec['last price'] ||
          rec['lastprice'] ||
          rec['market price'] ||
          rec['marketprice'];
        const currentPrice = curPriceStr ? parseFloat(String(curPriceStr).replace(/[^0-9.-]/g, '')) : averagePrice;

        // Sector & ISIN
        const sector = rec['sector'] || rec['industry'] || undefined;
        const isin = rec['isin'] || rec['isincode'] || rec['isin code'] || undefined;

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
          sector: sector ? sector.trim() : undefined,
          isin: isin ? isin.trim() : undefined,
          optionType: isOption ? (isCall ? 'CALL' : 'PUT') : undefined,
          strikePrice,
          expiryDate,
          investmentValue: Number((Math.abs(quantity) * averagePrice).toFixed(2))
        });
      });
    }

    const totalInvestedINR = parsedRows.reduce((sum, r) => sum + (r.investmentValue || 0), 0);
    const estimatedHoldings = parsedRows.filter(r => r.assetClass === 'EQUITY' || r.assetClass === 'ETF').length;
    const estimatedPositions = parsedRows.filter(r => r.assetClass === 'OPTIONS' || r.assetClass === 'FUTURES').length;

    return {
      isValid: errors.length === 0 && parsedRows.length > 0,
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
          isin: r.isin || `IMP_${r.symbol}`,
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
          sector: r.sector || 'Imported Portfolio',
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
