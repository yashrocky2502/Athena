/**
 * ATHENA — PHASE 10P-1: REAL EXCEL (.XLSX) PORTFOLIO IMPORT TEST SUITE
 * 
 * Comprehensive regression tests verifying:
 * - Scenario A: Real broker multi-sheet layout (Equity, Mutual Funds, Combined)
 * - Scenario B: Non-row-1 header discovery (e.g. row 23 or arbitrary header row)
 * - Scenario C: Standard header mapping: Symbol, Quantity Available, Average Price, Previous Closing Price, Sector, ISIN
 * - Scenario D: Sheet selection preference (prefer Equity, fallback Combined, ignore Mutual Funds)
 * - Scenario E: No duplicate rows between Equity and Combined
 * - Scenario F: Mutual Funds not imported as equity positions
 * - Scenario G: Whitespace trimming & genuine symbol preservation (no fabricated symbols)
 * - Scenario H: Absent/invalid prices are fail-closed (no fake ₹100, no fake 0 market price)
 * - Scenario I: Binary buffer & base64 parsing support
 * - Scenario J: Existing CSV parser continues to work unchanged
 * - Scenario K: Malformed workbook returns truthful validation error
 * - Scenario L: Full commit into canonical portfolio state preserves quantities, prices, sectors, ISINs
 * - Scenario M: Deleted import source record preserves canonical holdings and snapshots
 * - Scenario N: Multi-source reconciliation handles imported Excel rows correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { PortfolioImportEngine, portfolioImportEngine } from '../portfolio/broker/PortfolioImportEngine.ts';
import { PortfolioHubManager } from '../portfolio/broker/PortfolioHubManager.ts';

describe('Phase 10P-1: Real Excel (.xlsx) Portfolio Import Engine', () => {
  let importEngine: PortfolioImportEngine;
  let hubManager: PortfolioHubManager;

  beforeEach(() => {
    importEngine = PortfolioImportEngine.getInstance();
    hubManager = PortfolioHubManager.getInstance();
  });

  /**
   * Helper to build an in-memory XLSX Buffer with arbitrary sheet data.
   */
  function createTestWorkbook(sheets: Record<string, any[][]>): Buffer {
    const wb = XLSX.utils.book_new();
    for (const [sheetName, rows] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // =========================================================================
  // SCENARIO A & B: Real broker multi-sheet layout with headers starting at row 23
  // =========================================================================
  it('Scenario A & B: should discover headers on row 23 and parse multi-sheet broker workbook', () => {
    // 22 preamble / metadata rows followed by header on row 23 (index 22)
    const equityRows: any[][] = [];
    for (let i = 0; i < 22; i++) {
      equityRows.push([`Broker Metadata Note line ${i + 1}`, '', '', '', '', '']);
    }
    equityRows.push([
      'Symbol',
      'ISIN',
      'Sector',
      'Quantity Available',
      'Average Price',
      'Previous Closing Price'
    ]);
    equityRows.push(['RELIANCE', 'INE002A01018', 'Oil & Gas', 100, 2450.50, 2980.00]);
    equityRows.push(['TCS', 'INE467B01029', 'Information Technology', 50, 3500.00, 3850.25]);
    equityRows.push(['INFY', 'INE009A01021', 'Information Technology', 200, 1420.00, 1560.00]);

    const mfRows: any[][] = [
      ['Scheme Name', 'Folio No', 'Units Available', 'NAV', 'Current Value'],
      ['HDFC Top 100 Fund', '12345/67', 1500, 850.5, 1275750]
    ];

    const combinedRows: any[][] = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
      ['RELIANCE', 100, 2450.50, 2980.00],
      ['TCS', 50, 3500.00, 3850.25]
    ];

    const buffer = createTestWorkbook({
      'Equity': equityRows,
      'Mutual Funds': mfRows,
      'Combined': combinedRows
    });

    const preview = importEngine.previewAndValidate({
      filename: 'holdings-RKN570.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.isValid).toBe(true);
    expect(preview.parsedRows.length).toBe(3);

    const rel = preview.parsedRows.find(r => r.symbol === 'RELIANCE');
    expect(rel).toBeDefined();
    expect(rel?.quantity).toBe(100);
    expect(rel?.averagePrice).toBe(2450.50);
    expect(rel?.currentPrice).toBe(2980.00);
    expect(rel?.sector).toBe('Oil & Gas');
    expect(rel?.isin).toBe('INE002A01018');
    expect(rel?.assetClass).toBe('EQUITY');

    const tcs = preview.parsedRows.find(r => r.symbol === 'TCS');
    expect(tcs).toBeDefined();
    expect(tcs?.quantity).toBe(50);
    expect(tcs?.averagePrice).toBe(3500.00);
    expect(tcs?.currentPrice).toBe(3850.25);
    expect(tcs?.sector).toBe('Information Technology');
    expect(tcs?.isin).toBe('INE467B01029');
  });

  // =========================================================================
  // SCENARIO C: Broker variation header naming tolerance
  // =========================================================================
  it('Scenario C: should tolerate naming variations (Qty Available, Avg Price, Prev Close, etc.)', () => {
    const sheetRows: any[][] = [
      ['Broker Report Header'],
      ['Trading Symbol', 'Available Qty', 'Avg Cost', 'LTP', 'Industry', 'ISIN Code'],
      ['HDFCBANK', 150, 1480.20, 1620.00, 'Banking & Financial', 'INE040A01034'],
      ['ICICIBANK', 80, 950.00, 1100.50, 'Banking & Financial', 'INE090A01021']
    ];

    const buffer = createTestWorkbook({ 'Equities': sheetRows });
    const preview = importEngine.previewAndValidate({
      filename: 'export.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.isValid).toBe(true);
    expect(preview.parsedRows.length).toBe(2);
    expect(preview.parsedRows[0].symbol).toBe('HDFCBANK');
    expect(preview.parsedRows[0].quantity).toBe(150);
    expect(preview.parsedRows[0].averagePrice).toBe(1480.20);
    expect(preview.parsedRows[0].currentPrice).toBe(1620.00);
    expect(preview.parsedRows[0].sector).toBe('Banking & Financial');
    expect(preview.parsedRows[0].isin).toBe('INE040A01034');
  });

  // =========================================================================
  // SCENARIO D & E: Sheet selection preference and no duplicate rows
  // =========================================================================
  it('Scenario D & E: should prefer Equity over Combined and never duplicate holdings', () => {
    const equitySheet = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
      ['LT', 40, 3200, 3600],
      ['BAJFINANCE', 15, 6500, 7100]
    ];
    const combinedSheet = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
      ['LT', 40, 3200, 3600],
      ['BAJFINANCE', 15, 6500, 7100],
      ['EXTRA_STOCK', 10, 100, 120]
    ];

    const buffer = createTestWorkbook({
      'Equity': equitySheet,
      'Combined': combinedSheet
    });

    const preview = importEngine.previewAndValidate({
      filename: 'broker_portfolio.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.isValid).toBe(true);
    // Should ONLY have the 2 rows from the preferred Equity sheet, not 5 or duplicated rows
    expect(preview.parsedRows.length).toBe(2);
    expect(preview.parsedRows.map(r => r.symbol)).toEqual(['LT', 'BAJFINANCE']);
  });

  // =========================================================================
  // SCENARIO F: Mutual funds excluded from equity positions
  // =========================================================================
  it('Scenario F: should never import Mutual Funds sheets as equity positions', () => {
    const mfSheet = [
      ['Fund Name', 'Folio', 'Units', 'NAV', 'Total Value'],
      ['Axis Bluechip Fund', '123/456', 2000, 45.2, 90400],
      ['Mirae Asset Large Cap', '789/012', 1500, 78.5, 117750]
    ];

    const buffer = createTestWorkbook({ 'Mutual Funds': mfSheet });

    const preview = importEngine.previewAndValidate({
      filename: 'mf_only.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    // When only Mutual Funds sheet exists, no equity holdings table is found
    expect(preview.isValid).toBe(false);
    expect(preview.parsedRows.length).toBe(0);
    expect(preview.errors[0]).toContain('No supported holdings table was found');
  });

  // =========================================================================
  // SCENARIO G: Symbol normalization (whitespace trimming, genuine preservation)
  // =========================================================================
  it('Scenario G: should cleanly normalize symbols without altering genuine ticker identity', () => {
    const sheetRows = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
      ['  TATAMOTORS.NSE  ', 100, 920.50, 980.00],
      ['ITC  ', 500, 410.00, 435.00]
    ];

    const buffer = createTestWorkbook({ 'Equity': sheetRows });
    const preview = importEngine.previewAndValidate({
      filename: 'test.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.isValid).toBe(true);
    expect(preview.parsedRows[0].symbol).toBe('TATAMOTORS');
    expect(preview.parsedRows[1].symbol).toBe('ITC');
  });

  // =========================================================================
  // SCENARIO H: Zero-fabrication guarantee on absent / missing prices
  // =========================================================================
  it('Scenario H: should NOT fabricate ₹100 or fake prices when price is missing or invalid', () => {
    const sheetRows = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price'],
      ['VALID_STOCK', 10, 500.00, 550.00],
      ['MISSING_PRICE_STOCK', 20, '', 300.00],
      ['ZERO_PRICE_STOCK', 30, 0, 400.00]
    ];

    const buffer = createTestWorkbook({ 'Equity': sheetRows });
    const preview = importEngine.previewAndValidate({
      filename: 'prices.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    // Missing/zero avg price rows fail validation; no fabricated ₹100 is inserted!
    expect(preview.parsedRows.length).toBe(1);
    expect(preview.parsedRows[0].symbol).toBe('VALID_STOCK');
    expect(preview.errors.some(e => e.includes('MISSING_PRICE_STOCK'))).toBe(true);
    expect(preview.errors.some(e => e.includes('ZERO_PRICE_STOCK'))).toBe(true);
  });

  // =========================================================================
  // SCENARIO I: Binary buffer and base64 parsing compatibility
  // =========================================================================
  it('Scenario I: should seamlessly parse raw Buffer, ArrayBuffer, and base64 payloads', () => {
    const sheetRows = [
      ['Symbol', 'Quantity Available', 'Average Price'],
      ['WIPRO', 100, 480.00]
    ];
    const buffer = createTestWorkbook({ 'Equity': sheetRows });

    // Buffer
    const resBuffer = importEngine.parseExcelWorkbook(buffer);
    expect(resBuffer.rows.length).toBe(1);
    expect(resBuffer.rows[0].symbol).toBe('WIPRO');

    // Uint8Array / ArrayBuffer
    const resArray = importEngine.parseExcelWorkbook(new Uint8Array(buffer));
    expect(resArray.rows.length).toBe(1);
    expect(resArray.rows[0].symbol).toBe('WIPRO');

    // Base64
    const resBase64 = importEngine.parseExcelWorkbook(buffer.toString('base64'));
    expect(resBase64.rows.length).toBe(1);
    expect(resBase64.rows[0].symbol).toBe('WIPRO');
  });

  // =========================================================================
  // SCENARIO J: Preserving existing CSV path unchanged
  // =========================================================================
  it('Scenario J: should continue parsing standard CSV text correctly', () => {
    const csvContent = `Symbol,Quantity,AveragePrice,CurrentPrice,Sector
SBIN,200,750.00,810.00,Banking
MARUTI,25,11500.00,12300.00,Automobile`;

    const preview = importEngine.previewAndValidate({
      filename: 'holdings.csv',
      content: csvContent,
      sourceType: 'CSV'
    });

    expect(preview.isValid).toBe(true);
    expect(preview.parsedRows.length).toBe(2);
    expect(preview.parsedRows[0].symbol).toBe('SBIN');
    expect(preview.parsedRows[0].quantity).toBe(200);
    expect(preview.parsedRows[0].averagePrice).toBe(750.00);
    expect(preview.parsedRows[0].currentPrice).toBe(810.00);
    expect(preview.parsedRows[1].symbol).toBe('MARUTI');
    expect(preview.parsedRows[1].quantity).toBe(25);
  });

  // =========================================================================
  // SCENARIO K: Truthful validation error on malformed or unrecognized workbook
  // =========================================================================
  it('Scenario K: should return truthful validation error when no recognizable table exists', () => {
    const emptyRows = [
      ['Random Text 1', 'Random Text 2'],
      ['Some remarks', 'Another note']
    ];
    const buffer = createTestWorkbook({ 'Sheet1': emptyRows });

    const preview = importEngine.previewAndValidate({
      filename: 'empty.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.isValid).toBe(false);
    expect(preview.parsedRows.length).toBe(0);
    expect(preview.errors[0]).toBe('No supported holdings table was found in this Excel workbook.');
  });

  // =========================================================================
  // SCENARIO L & M: Commit to canonical state & preserve snapshots on source deletion
  // =========================================================================
  it('Scenario L & M: should commit Excel rows into canonical portfolio state and preserve snapshots on deletion', () => {
    const portfolio = hubManager.createPortfolio('Excel Import Test Portfolio');
    hubManager.switchActivePortfolio(portfolio.id);

    const sheetRows = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price', 'Sector', 'ISIN'],
      ['KOTAKBANK', 75, 1750.00, 1820.00, 'Banking', 'INE237A01028'],
      ['ASIANPAINT', 30, 2850.00, 2990.00, 'Consumer', 'INE021A01026']
    ];
    const buffer = createTestWorkbook({ 'Equity': sheetRows });

    const preview = hubManager.previewImport({
      filename: 'holdings-RKN570.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    expect(preview.validRowsCount).toBe(2);
    expect(preview.parsedRows.length).toBe(2);

    const commitResult = hubManager.commitImport(portfolio.id, {
      filename: 'holdings-RKN570.xlsx',
      rows: preview.parsedRows,
      sourceType: 'EXCEL'
    });

    expect(commitResult.importedCount).toBe(2);

    const canonicalState = hubManager.getCanonicalState();
    expect(canonicalState.holdings.length).toBe(2);

    const kotak = canonicalState.holdings.find(h => h.symbol === 'KOTAKBANK');
    expect(kotak).toBeDefined();
    expect(kotak?.quantity).toBe(75);
    expect(kotak?.averagePrice).toBe(1750.00);
    expect(kotak?.currentPrice).toBe(1820.00);
    expect(kotak?.sector).toBe('Banking');
    expect(kotak?.isin).toBe('INE237A01028');

    // Deleting the import record preserves canonical state (Scenario M)
    const imports = hubManager.listImports();
    expect(imports.length).toBeGreaterThan(0);
    const deleteResult = hubManager.deleteImport(imports[0].id);
    expect(deleteResult.success).toBe(true);

    const stateAfterDelete = hubManager.getCanonicalState();
    expect(stateAfterDelete.holdings.length).toBe(2);
  });

  // =========================================================================
  // SCENARIO N: Multi-source reconciliation handles imported Excel rows cleanly
  // =========================================================================
  it('Scenario N: should generate normalized import entities and reconcile accurately', () => {
    const sheetRows = [
      ['Symbol', 'Quantity Available', 'Average Price', 'Previous Closing Price', 'Sector', 'ISIN'],
      ['NIFTYBEES', 500, 250.00, 275.00, 'Index ETF', 'INF732E01015']
    ];
    const buffer = createTestWorkbook({ 'Equity': sheetRows });

    const preview = importEngine.previewAndValidate({
      filename: 'etf_import.xlsx',
      content: buffer.toString('base64'),
      sourceType: 'EXCEL'
    });

    const commit = importEngine.commitImport({
      filename: 'etf_import.xlsx',
      sourceType: 'EXCEL',
      parsedRows: preview.parsedRows,
      checksum: preview.checksum
    });

    const normalized = importEngine.getNormalizedImportEntities(commit.id);
    expect(normalized).not.toBeNull();
    expect(normalized?.holdings.length).toBe(1);
    expect(normalized?.holdings[0].symbol).toBe('NIFTYBEES');
    expect(normalized?.holdings[0].assetClass).toBe('ETF');
    expect(normalized?.holdings[0].marketValueINR).toBe(500 * 275.00);
    expect(normalized?.holdings[0].unrealizedPnLINR).toBe(500 * (275.00 - 250.00));
    expect(normalized?.holdings[0].isin).toBe('INF732E01015');
    expect(normalized?.holdings[0].sector).toBe('Index ETF');
  });
});
