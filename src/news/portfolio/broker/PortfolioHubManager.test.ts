/**
 * ATHENA — PHASE 26: PORTFOLIO HUB MANAGER UNIT & INTEGRATION TESTS
 * 
 * Verifies:
 * 1. Deterministic Canonical Portfolio calculation
 * 2. Multi-Portfolio CRUD & Switching
 * 3. Holdings Management & Close Position Realized P&L
 * 4. Derivatives / F&O Option Greeks & MTM
 * 5. Ingestion of CSV / Excel structured data
 * 6. Cash deposit & withdrawal ledger accounting
 * 7. Dynamic Intelligence derivation & Empty State handling
 * 8. Strict AI Data Firewall (read-only verification)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs";
import { PortfolioHubManager } from "./PortfolioHubManager.ts";
import { CanonicalPortfolioEngine } from "./CanonicalPortfolioEngine.ts";

describe("PortfolioHubManager & Canonical Engine Test Suite", () => {
  let hub: PortfolioHubManager;
  let testStorePath: string;

  beforeEach(() => {
    testStorePath = path.join(
      os.tmpdir(),
      `athena_test_portfolio_${Date.now()}_${Math.random().toString(36).substring(2)}.json`
    );
    hub = new PortfolioHubManager(testStorePath);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testStorePath)) {
        fs.unlinkSync(testStorePath);
      }
    } catch {
      // Ignore cleanup error in test
    }
  });

  it("should initialize with default active portfolio or create one deterministically", () => {
    const active = hub.getActivePortfolio();
    expect(active).toBeDefined();
    expect(active.id).toBeDefined();
    expect(active.name).toBeDefined();
    expect(active.status).toBe("ACTIVE");
  });

  it("should support creating a new portfolio and switching between portfolios", () => {
    const newPort = hub.createPortfolio("Tactical F&O Hedge", "Hedge overlay for macro volatility");
    expect(newPort.name).toBe("Tactical F&O Hedge");
    expect(newPort.description).toBe("Hedge overlay for macro volatility");

    const all = hub.getAllPortfolios();
    expect(all.some(p => p.id === newPort.id)).toBe(true);

    const switched = hub.switchActivePortfolio(newPort.id);
    expect(switched.id).toBe(newPort.id);
    expect(hub.getActivePortfolio().id).toBe(newPort.id);
  });

  it("should calculate canonical state deterministically from holdings", () => {
    const port = hub.createPortfolio("Deterministic Test Portfolio");
    hub.switchActivePortfolio(port.id);

    // Add holding: 100 shares of RELIANCE @ 2500, LTP 3000
    const holding = hub.addHolding({
      symbol: "RELIANCE",
      exchange: "NSE",
      quantity: 100,
      averagePrice: 2500,
      currentPrice: 3000,
      sector: "Energy"
    });

    expect(holding.symbol).toBe("RELIANCE");

    const canonical = hub.getCanonicalState();
    expect(canonical.holdings.length).toBe(1);
    
    // Market value should be exactly 100 * 3000 = 300,000
    expect(canonical.holdings[0].marketValueINR).toBe(300000);
    // Unrealized P&L should be (3000 - 2500) * 100 = 50,000
    expect(canonical.holdings[0].unrealizedPnLINR).toBe(50000);
    expect(canonical.holdings[0].unrealizedPnLPct).toBe(20); // 20% gain
  });

  it("should calculate option Greeks and derivative MTM correctly", () => {
    const port = hub.createPortfolio("Options Test Portfolio");
    hub.switchActivePortfolio(port.id);

    const pos = hub.addPosition({
      instrumentType: "OPTION",
      underlying: "NIFTY",
      side: "LONG",
      optionType: "CALL",
      strikePrice: 24500,
      quantity: 75,
      entryPrice: 100,
      currentPrice: 150
    });

    expect(pos.underlying).toBe("NIFTY");
    const canonical = hub.getCanonicalState();
    expect(canonical.positions.length).toBe(1);

    // MTM = (150 - 100) * 75 = 3750
    expect(canonical.positions[0].unrealizedPnLINR).toBe(3750);
    // Greeks must be computed deterministically
    expect(canonical.positions[0].greeks).toBeDefined();
    expect(canonical.positions[0].greeks?.delta).toBeGreaterThan(0);
  });

  it("should correctly record cash deposits, withdrawals, and close positions with realized P&L", () => {
    const port = hub.createPortfolio("Cash Ledger Portfolio");
    hub.switchActivePortfolio(port.id);

    // 1. Initial cash deposit
    const depositResult = hub.recordCashTransaction(100000, "DEPOSIT", "Initial capital");
    expect(depositResult.cash.availableCashINR).toBe(100000);

    // 2. Add holding: 10 shares @ 1000
    const holding = hub.addHolding({
      symbol: "INFY",
      exchange: "NSE",
      quantity: 10,
      averagePrice: 1000,
      currentPrice: 1200,
      sector: "IT"
    });

    // 3. Close holding at 1300
    const closeResult = hub.closeHolding(holding.id, 1300);
    expect(closeResult.success).toBe(true);
    expect(closeResult.realizedPnL).toBe(3000); // (1300 - 1000) * 10

    // Cash balance should now have received the sale proceeds: 10 * 1300 = 13,000
    const currentCash = hub.getActivePortfolio().cashBalanceINR;
    expect(currentCash).toBe(100000 + 13000);

    // Verify holding is removed from active list
    expect(hub.getActivePortfolio().holdings.some(h => h.id === holding.id)).toBe(false);

    // Verify immutable transactions ledger has the entries
    const transactions = hub.getTransactions();
    expect(transactions.some(tx => tx.type === "DEPOSIT")).toBe(true);
    expect(transactions.some(tx => tx.type === "BUY" && tx.symbol === "INFY")).toBe(true);
    expect(transactions.some(tx => tx.type === "SELL" && tx.symbol === "INFY")).toBe(true);
  });

  it("should ingest Excel / CSV preview and commit rows into canonical state", () => {
    const port = hub.createPortfolio("Import Test Portfolio");
    hub.switchActivePortfolio(port.id);

    const csvContent = `Symbol,Quantity,AveragePrice,CurrentPrice,Sector
TCS,50,3500,3800,Technology
HDFCBANK,100,1500,1600,Banking`;

    const preview = hub.previewImport("broker_export.csv", csvContent);
    expect(preview.validRowsCount).toBe(2);
    expect(preview.parsedRows.length).toBe(2);

    const commitResult = hub.commitImport("broker_export.csv", preview.parsedRows);
    expect(commitResult.importedCount).toBe(2);

    const canonical = hub.getCanonicalState();
    expect(canonical.holdings.length).toBe(2);
    expect(canonical.holdings.some(h => h.symbol === "TCS")).toBe(true);
    expect(canonical.holdings.some(h => h.symbol === "HDFCBANK")).toBe(true);

    // Check imports list
    const imports = hub.getImports();
    expect(imports.length).toBe(1);
    expect(imports[0].filename).toBe("broker_export.csv");

    // Deleting the import source preserves canonical history
    const delResult = hub.deleteImport(imports[0].id);
    expect(delResult.success).toBe(true);
    expect(hub.getCanonicalState().holdings.length).toBe(2); // Holdings preserved
  });

  it("should provide dynamic portfolio intelligence and return proper empty state", () => {
    // 1. Empty portfolio
    const emptyPort = hub.createPortfolio("Empty Test Portfolio");
    hub.switchActivePortfolio(emptyPort.id);

    const emptyIntel = hub.getPortfolioIntelligence();
    expect(emptyIntel.isEmpty).toBe(true);
    expect(emptyIntel.message).toBe("No portfolio data yet. Add holdings, positions, or import an Excel/CSV portfolio to activate intelligence.");

    // 2. Populated portfolio
    hub.addHolding({
      symbol: "RELIANCE",
      exchange: "NSE",
      quantity: 50,
      averagePrice: 2400,
      currentPrice: 2800,
      sector: "Energy"
    });

    const intel = hub.getPortfolioIntelligence();
    expect(intel.isEmpty).toBe(false);
    expect(intel.review).toBeDefined();
    expect(intel.review.summary).toBeDefined();
    expect(intel.review.strengths.length).toBeGreaterThan(0);
    expect(intel.opportunities.length).toBeGreaterThan(0);
    expect(intel.risks.length).toBeGreaterThan(0);
    expect(intel.evidence.length).toBeGreaterThan(0);
  });

  it("should strictly enforce AI data firewall: AI review is read-only and does not mutate portfolio", () => {
    const port = hub.createPortfolio("Firewall Test Portfolio");
    hub.switchActivePortfolio(port.id);

    hub.addHolding({
      symbol: "ITC",
      exchange: "NSE",
      quantity: 200,
      averagePrice: 400,
      currentPrice: 420,
      sector: "FMCG"
    });

    const beforeState = JSON.stringify(hub.getActivePortfolio());
    
    // Request intelligence multiple times
    hub.getPortfolioIntelligence();
    hub.getPortfolioIntelligence();
    
    const afterState = JSON.stringify(hub.getActivePortfolio());
    // Active portfolio data MUST NOT be mutated by calling intelligence
    expect(afterState).toBe(beforeState);
  });

  it("should support Phase 26.1 manual stock entry workflow (e.g. ITC 200 @ ₹420) and update calculations", () => {
    const port = hub.createPortfolio("Manual Workflow Portfolio");
    hub.switchActivePortfolio(port.id);

    // Enter manual holding as per user prompt: ITC, 200 qty, Avg 420, Cur 420, Sector FMCG
    const holding = hub.addHolding({
      symbol: "ITC",
      displayName: "ITC Limited",
      quantity: 200,
      averagePrice: 420,
      currentPrice: 420,
      sector: "FMCG",
      notes: "Core FMCG allocation"
    });

    expect(holding.symbol).toBe("ITC");
    expect(holding.quantity).toBe(200);
    expect(holding.averagePrice).toBe(420);
    expect(holding.currentPrice).toBe(420);
    expect(holding.sector).toBe("FMCG");
    expect(holding.marketValueINR).toBe(84000); // 200 * 420
    expect(holding.unrealizedPnLINR).toBe(0);

    const canonical = hub.getCanonicalState();
    expect(canonical.holdings.length).toBe(1);
    expect(canonical.holdings[0].marketValueINR).toBe(84000);
    expect(canonical.exposure.grossExposureINR).toBe(84000);
    expect(canonical.exposure.sectorExposure["FMCG"]).toBe(84000);

    // Edit holding (e.g. price rises to 450, qty increased to 250)
    const updated = hub.updateHolding(port.id, holding.id, {
      quantity: 250,
      currentPrice: 450
    });

    expect(updated.quantity).toBe(250);
    expect(updated.currentPrice).toBe(450);
    expect(updated.marketValueINR).toBe(112500); // 250 * 450
    expect(updated.unrealizedPnLINR).toBe(7500); // 250 * (450 - 420)

    const updatedCanonical = hub.getCanonicalState();
    expect(updatedCanonical.holdings[0].marketValueINR).toBe(112500);
    expect(updatedCanonical.holdings[0].unrealizedPnLINR).toBe(7500);
  });

  it("should support Phase 26.1 manual ETF, Future, and Option additions with deterministic Greeks and editing", () => {
    const port = hub.createPortfolio("Derivatives & ETF Portfolio");
    hub.switchActivePortfolio(port.id);

    // 1. Manual ETF entry
    const etf = hub.addHolding({
      symbol: "NIFTYBEES",
      displayName: "Nippon India Nifty 50 BeES ETF",
      quantity: 100,
      averagePrice: 280,
      currentPrice: 285,
      sector: "Broad Indices / ETFs",
      assetClass: "ETF"
    });
    expect(etf.assetClass).toBe("ETF");
    expect(etf.marketValueINR).toBe(28500);
    expect(etf.unrealizedPnLINR).toBe(500);

    // 2. Manual Future entry
    const future = hub.addPosition({
      instrumentType: "FUTURE",
      underlying: "NIFTY",
      side: "LONG",
      quantity: 65,
      entryPrice: 25000,
      currentPrice: 25100,
      expiryDate: "2026-09-25"
    });
    expect(future.assetClass).toBe("FUTURES");
    expect(future.unrealizedPnLINR).toBe(6500); // 65 * 100

    // 3. Manual Option entry with Greeks
    const option = hub.addPosition({
      instrumentType: "OPTION",
      underlying: "NIFTY",
      optionType: "CALL",
      side: "LONG",
      strikePrice: 25000,
      quantity: 130, // 2 lots of 65
      lotSize: 65,
      entryPrice: 120,
      currentPrice: 140,
      expiryDate: "2026-09-25"
    });
    expect(option.assetClass).toBe("OPTIONS");
    expect(option.unrealizedPnLINR).toBe(2600); // 130 * 20
    expect(option.greeks).toBeDefined();
    expect(option.greeks?.delta).toBeGreaterThan(0);

    // 4. Update Option position (e.g. current premium changed to 160)
    const updatedOption = hub.updatePosition(port.id, option.id, {
      currentPrice: 160
    });
    expect(updatedOption.currentPrice).toBe(160);
    expect(updatedOption.unrealizedPnLINR).toBe(5200); // 130 * 40
  });
});
