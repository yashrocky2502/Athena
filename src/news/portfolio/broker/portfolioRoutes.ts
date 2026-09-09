/**
 * ATHENA — PHASE 26: PERSONAL BROKER CONNECTION + PORTFOLIO INTELLIGENCE HUB
 * portfolioRoutes.ts
 * 
 * Express Router mounted at /api/v4/portfolio.
 * Exposes canonical portfolio truth, multi-portfolio CRUD, manual holdings & positions,
 * cash management, transactions, Excel/CSV imports, and dynamic portfolio intelligence.
 * 
 * Policy:
 * Strictly API-Free First. No Kite Connect dependencies.
 */

import { Router, Request, Response } from 'express';
import { portfolioHubManager } from './PortfolioHubManager.ts';
import { CredentialSanitizer } from '../../credentials/CredentialSanitizer.ts';

export const portfolioRouter = Router();

// GET /api/v4/portfolio - Active Canonical Portfolio State & Portfolio Info
portfolioRouter.get('/', async (req: Request, res: Response) => {
  try {
    const portfolio = await portfolioHubManager.getCanonicalPortfolio();
    const activePortfolio = portfolioHubManager.getActivePortfolio();
    res.json({
      portfolio,
      activePortfolio,
      tradingMode: portfolioHubManager.getTradingMode()
    });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/all - List All Portfolios
portfolioRouter.get('/all', (req: Request, res: Response) => {
  try {
    const portfolios = portfolioHubManager.listPortfolios();
    const activeId = portfolioHubManager.getActivePortfolio().id;
    res.json({ portfolios, activePortfolioId: activeId });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/create - Create New Portfolio
portfolioRouter.post('/create', (req: Request, res: Response) => {
  try {
    const { name, description, baseCurrency } = req.body || {};
    const created = portfolioHubManager.createPortfolio({ name, description, baseCurrency });
    res.json({ success: true, portfolio: created });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/switch - Switch Active Portfolio
portfolioRouter.post('/switch', (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Portfolio ID is required.' });
    const switched = portfolioHubManager.switchActivePortfolio(id);
    res.json({ success: true, portfolio: switched });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// PUT /api/v4/portfolio/:id - Update Portfolio
portfolioRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = portfolioHubManager.updatePortfolio(id, { name, description });
    res.json({ success: true, portfolio: updated });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/:id/archive - Archive Portfolio
portfolioRouter.post('/:id/archive', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const archived = portfolioHubManager.archivePortfolio(id);
    res.json({ success: true, portfolio: archived });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// DELETE /api/v4/portfolio/:id - Delete Portfolio
portfolioRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    portfolioHubManager.deletePortfolio(id);
    res.json({ success: true, activePortfolio: portfolioHubManager.getActivePortfolio() });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// ==========================================
// HOLDINGS ROUTES
// ==========================================

// POST /api/v4/portfolio/holdings - Add Holding
portfolioRouter.post('/holdings', async (req: Request, res: Response) => {
  try {
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const holding = portfolioHubManager.addHolding(targetId, req.body);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, holding, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// PUT /api/v4/portfolio/holdings/:id - Update Holding
portfolioRouter.put('/holdings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const updated = portfolioHubManager.updateHolding(targetId, id, req.body);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, holding: updated, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/holdings/:id/close - Close Holding
portfolioRouter.post('/holdings/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { closePrice, portfolioId } = req.body || {};
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const result = portfolioHubManager.closeHolding(targetId, id, closePrice ? Number(closePrice) : undefined);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, result, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// DELETE /api/v4/portfolio/holdings/:id - Delete Holding
portfolioRouter.delete('/holdings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    portfolioHubManager.deleteHolding(targetId, id);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// ==========================================
// POSITIONS ROUTES (F&O)
// ==========================================

// POST /api/v4/portfolio/positions - Add Position
portfolioRouter.post('/positions', async (req: Request, res: Response) => {
  try {
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const position = portfolioHubManager.addPosition(targetId, req.body);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, position, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// PUT /api/v4/portfolio/positions/:id - Update Position
portfolioRouter.put('/positions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const updated = portfolioHubManager.updatePosition(targetId, id, req.body);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, position: updated, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/positions/:id/close - Close Position
portfolioRouter.post('/positions/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { closePrice, portfolioId } = req.body || {};
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const result = portfolioHubManager.closePosition(targetId, id, closePrice ? Number(closePrice) : undefined);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, result, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// DELETE /api/v4/portfolio/positions/:id - Delete Position
portfolioRouter.delete('/positions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    portfolioHubManager.deletePosition(targetId, id);
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// ==========================================
// CASH & TRANSACTIONS
// ==========================================

// POST /api/v4/portfolio/cash - Deposit / Withdraw Cash
portfolioRouter.post('/cash', async (req: Request, res: Response) => {
  try {
    const { amount, type, notes, portfolioId } = req.body || {};
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const result = portfolioHubManager.addCash(targetId, { amount, type, notes });
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, ...result, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/transactions - Transaction Ledger
portfolioRouter.get('/transactions', (req: Request, res: Response) => {
  try {
    const portfolioId = req.query.portfolioId as string;
    const transactions = portfolioHubManager.getTransactions(portfolioId);
    res.json({ transactions });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/transactions - Record Manual Transaction
portfolioRouter.post('/transactions', async (req: Request, res: Response) => {
  try {
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const tx = portfolioHubManager.addTransaction(targetId, req.body);
    
    // Automatically credit cash if Dividend or Interest
    if (req.body?.type === 'DIVIDEND' || req.body?.type === 'INTEREST') {
      const amount = Number(req.body?.price || req.body?.amount || 0);
      if (amount > 0) {
        portfolioHubManager.addCash(targetId, {
          amount,
          type: 'DEPOSIT',
          notes: req.body?.notes || `${req.body?.type} credit for ${req.body?.symbol || 'portfolio'}`
        });
      }
    }
    
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, transaction: tx, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/orders - Orders
portfolioRouter.get('/orders', (req: Request, res: Response) => {
  try {
    const portfolioId = req.query.portfolioId as string;
    const orders = portfolioHubManager.getOrders(portfolioId);
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/orders - Add Order
portfolioRouter.post('/orders', (req: Request, res: Response) => {
  try {
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const order = portfolioHubManager.addOrder(targetId, req.body);
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// ==========================================
// EXCEL & CSV IMPORTS
// ==========================================

// POST /api/v4/portfolio/import/preview - Validate File Preview
portfolioRouter.post('/import/preview', (req: Request, res: Response) => {
  try {
    const { filename, content, sourceType } = req.body || {};
    if (!content) return res.status(400).json({ error: 'File content is required for preview.' });
    const preview = portfolioHubManager.previewImport({ filename: filename || 'import.csv', content, sourceType });
    res.json(preview);
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/import/commit - Commit Validated Import
portfolioRouter.post('/import/commit', async (req: Request, res: Response) => {
  try {
    const { filename, rows, sourceType, portfolioId } = req.body || {};
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Rows array is required to commit import.' });
    }
    const targetId = portfolioId || portfolioHubManager.getActivePortfolio().id;
    const result = portfolioHubManager.commitImport(targetId, {
      filename: filename || 'portfolio_import.csv',
      rows,
      sourceType
    });
    const canonical = await portfolioHubManager.getCanonicalPortfolio(targetId);
    res.json({ success: true, ...result, canonical });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/imports - List Uploaded Sources
portfolioRouter.get('/imports', (req: Request, res: Response) => {
  try {
    const imports = portfolioHubManager.listImports();
    res.json({ imports });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// DELETE /api/v4/portfolio/imports/:id - Delete Uploaded Source Record
portfolioRouter.delete('/imports/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    portfolioHubManager.deleteImportSource(id);
    res.json({ success: true, message: 'Source deleted. Portfolio canonical history and snapshots preserved.' });
  } catch (error: any) {
    res.status(400).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// ==========================================
// DYNAMIC PORTFOLIO INTELLIGENCE
// ==========================================

// GET /api/v4/portfolio/intelligence - Dynamic AI Review, Opportunities, Risks
portfolioRouter.get('/intelligence', async (req: Request, res: Response) => {
  try {
    const portfolioId = req.query.portfolioId as string;
    const intelligence = await portfolioHubManager.getPortfolioIntelligence(portfolioId);
    res.json({ intelligence });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/timeline - Audit Trail Timeline Events
portfolioRouter.get('/timeline', (req: Request, res: Response) => {
  try {
    const portfolioId = req.query.portfolioId as string;
    const timeline = portfolioHubManager.getTimeline(portfolioId);
    res.json({ timeline });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/history - Append-Only Historical Snapshots
portfolioRouter.get('/history', (req: Request, res: Response) => {
  try {
    const snapshots = portfolioHubManager.getHistoricalSnapshots();
    res.json({ snapshots, total: snapshots.length });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// POST /api/v4/portfolio/snapshot - Capture Immutable Snapshot
portfolioRouter.post('/snapshot', (req: Request, res: Response) => {
  try {
    const portfolioId = (req.query.portfolioId as string) || req.body?.portfolioId;
    const snapshot = portfolioHubManager.captureSnapshot(portfolioId);
    res.json({ success: true, snapshot });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/connections - Future Broker Integrations (Disabled / Not Required)
portfolioRouter.get('/connections', (req: Request, res: Response) => {
  try {
    const connections = portfolioHubManager.getConnectionStates();
    const tradingMode = portfolioHubManager.getTradingMode();
    res.json({ connections, tradingMode });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});

// GET /api/v4/portfolio/reconciliation - Discrepancies & Cross-Source Audit
portfolioRouter.get('/reconciliation', (req: Request, res: Response) => {
  try {
    const report = portfolioHubManager.getReconciliationReport();
    res.json({ report });
  } catch (error: any) {
    res.status(500).json({ error: CredentialSanitizer.sanitizeString(error.message) });
  }
});
