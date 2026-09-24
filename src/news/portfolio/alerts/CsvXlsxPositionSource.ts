/**
 * ATHENA — PHASE 10P-2: PERSONAL POSITION ALERT FOUNDATION
 * CsvXlsxPositionSource.ts
 * 
 * Reusable Position Source adapter for CSV & XLSX portfolio files.
 * Reuses the Phase 10P-1 PortfolioImportEngine for robust broker workbook parsing.
 * 
 * Invariant Rules:
 * - Only positions with strictly positive quantity (> 0) become active positions.
 * - Mutual Funds are not converted to equity positions.
 * - Missing prices remain null/undefined (zero price fabrication).
 * - Generates stable, deterministic position IDs.
 */

import {
  PositionSource,
  NormalizedPosition,
  PositionAssetClass
} from './types.ts';
import { PortfolioImportEngine } from '../broker/PortfolioImportEngine.ts';
import { PortfolioImportRow } from '../broker/types.ts';

export interface CsvXlsxPositionSourceConfig {
  sourceId?: string;
  filename: string;
  content: string | Buffer | Uint8Array;
  sourceType?: 'EXCEL' | 'CSV';
}

export class CsvXlsxPositionSource implements PositionSource {
  public readonly sourceId: string;
  public readonly sourceType = 'FILE';

  private filename: string;
  private content: string | Buffer | Uint8Array;
  private explicitSourceType?: 'EXCEL' | 'CSV';
  private cachedPositions: NormalizedPosition[] | null = null;

  constructor(config: CsvXlsxPositionSourceConfig) {
    this.sourceId = config.sourceId || `SRC_FILE_${Date.now()}`;
    this.filename = config.filename;
    this.content = config.content;
    this.explicitSourceType = config.sourceType;
  }

  /**
   * Generates a stable deterministic position ID based on symbol, exchange, and asset parameters.
   */
  public static generatePositionId(
    source: string,
    symbol: string,
    exchange: string = 'NSE',
    assetClass: string = 'EQUITY',
    expiryDate?: string | null,
    strikePrice?: number | null,
    optionType?: string | null
  ): string {
    const cleanSym = symbol.toUpperCase().trim().replace(/[^A-Z0-9]/g, '_');
    const cleanEx = (exchange || 'NSE').toUpperCase().trim();
    const cleanAsset = assetClass.toUpperCase().trim();
    const cleanExpiry = expiryDate ? expiryDate.trim().replace(/[^0-9A-Z]/g, '') : 'SPOT';
    const cleanStrike = strikePrice !== undefined && strikePrice !== null ? String(strikePrice) : '0';
    const cleanOpt = optionType ? optionType.toUpperCase().trim() : 'NA';

    return `POS_${source}_${cleanEx}_${cleanSym}_${cleanAsset}_${cleanExpiry}_${cleanStrike}_${cleanOpt}`;
  }

  /**
   * Parses and normalizes input data into NormalizedPosition array.
   */
  public async getPositions(): Promise<NormalizedPosition[]> {
    if (this.cachedPositions) {
      return this.cachedPositions;
    }

    const importEngine = PortfolioImportEngine.getInstance();
    const isExcel = this.explicitSourceType === 'EXCEL' ||
      this.filename.toLowerCase().endsWith('.xlsx') ||
      this.filename.toLowerCase().endsWith('.xls');

    let parsedRows: PortfolioImportRow[] = [];

    if (isExcel) {
      const excelResult = importEngine.parseExcelWorkbook(this.content);
      parsedRows = excelResult.rows;
    } else {
      const rawText = typeof this.content === 'string'
        ? this.content
        : Buffer.isBuffer(this.content)
          ? this.content.toString('utf-8')
          : new TextDecoder().decode(this.content);

      const delimiter = this.filename.endsWith('.tsv') ? '\t' : ',';
      const records = importEngine.parseDelimitedText(rawText, delimiter);

      for (const rec of records) {
        const symbol = (
          rec['symbol'] ||
          rec['tradingsymbol'] ||
          rec['trading symbol'] ||
          rec['ticker'] ||
          rec['instrument'] ||
          rec['stock'] ||
          rec['scrip']
        )?.toUpperCase()?.trim();

        if (!symbol) continue;

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
        if (isNaN(quantity) || quantity <= 0) continue;

        const avgPriceStr =
          rec['average price'] ||
          rec['averageprice'] ||
          rec['avg price'] ||
          rec['avgprice'] ||
          rec['buy price'] ||
          rec['buyprice'] ||
          rec['price'] ||
          rec['cost'];
        const avgPriceNum = avgPriceStr ? parseFloat(String(avgPriceStr).replace(/[^0-9.-]/g, '')) : NaN;
        const averagePrice = (!isNaN(avgPriceNum) && avgPriceNum > 0) ? Number(avgPriceNum.toFixed(2)) : undefined;

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
        const curPriceNum = curPriceStr ? parseFloat(String(curPriceStr).replace(/[^0-9.-]/g, '')) : NaN;
        const currentPrice = (!isNaN(curPriceNum) && curPriceNum > 0) ? Number(curPriceNum.toFixed(2)) : undefined;

        const sector = rec['sector'] || rec['industry'] || undefined;
        const isin = rec['isin'] || rec['isincode'] || rec['isin code'] || undefined;
        const exchange = (rec['exchange'] || 'NSE').toUpperCase().trim();

        parsedRows.push({
          symbol,
          exchange,
          quantity,
          averagePrice: averagePrice || 0,
          currentPrice: currentPrice || undefined,
          sector,
          isin
        });
      }
    }

    const now = new Date().toISOString();
    const normalized: NormalizedPosition[] = [];

    for (const row of parsedRows) {
      // Rule 1: Zero or negative quantity does not become an active position
      if (!row.quantity || row.quantity <= 0) {
        continue;
      }

      // Rule 2: Symbol must be valid
      const symbol = row.symbol?.trim().toUpperCase();
      if (!symbol) {
        continue;
      }

      // Rule 3: Asset class determination (never convert Mutual Funds into Equity)
      let assetClass: PositionAssetClass = 'EQUITY';
      const rowAsset = (row.assetClass as string) || '';
      if (rowAsset === 'OPTIONS') assetClass = 'OPTIONS';
      else if (rowAsset === 'FUTURES') assetClass = 'FUTURES';
      else if (rowAsset === 'ETF' || symbol.includes('BEES') || symbol.endsWith('ETF')) assetClass = 'ETF';
      else if (rowAsset === 'MUTUAL_FUND') assetClass = 'MUTUAL_FUND';

      // Rule 4: Zero price fabrication. Missing or non-positive price remains null.
      const avgPrice = (typeof row.averagePrice === 'number' && row.averagePrice > 0)
        ? row.averagePrice
        : null;

      const currPrice = (typeof row.currentPrice === 'number' && row.currentPrice > 0)
        ? row.currentPrice
        : null;

      const exchange = row.exchange ? row.exchange.toUpperCase().trim() : 'NSE';
      const sourceTag = isExcel ? 'EXCEL' : 'CSV';

      const posId = CsvXlsxPositionSource.generatePositionId(
        sourceTag,
        symbol,
        exchange,
        assetClass,
        row.expiryDate,
        row.strikePrice,
        row.optionType
      );

      normalized.push({
        positionId: posId,
        symbol,
        exchange,
        assetClass,
        side: (assetClass === 'OPTIONS' || assetClass === 'FUTURES') ? 'LONG' : null,
        quantity: row.quantity,
        averagePrice: avgPrice,
        currentPrice: currPrice,
        isin: row.isin || null,
        sector: row.sector || null,
        source: sourceTag,
        observedAt: now,
        underlyingSymbol: (assetClass === 'OPTIONS' || assetClass === 'FUTURES') ? symbol : null,
        optionType: row.optionType || null,
        strikePrice: row.strikePrice || null,
        expiryDate: row.expiryDate || null,
        lotSize: row.lotSize || null
      });
    }

    this.cachedPositions = normalized;
    return normalized;
  }

  /**
   * Allows updating the source content (e.g. for simulating successive file uploads).
   */
  public updateContent(content: string | Buffer | Uint8Array, filename?: string): void {
    this.content = content;
    if (filename) this.filename = filename;
    this.cachedPositions = null;
  }
}
