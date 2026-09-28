import { IDatabaseClient, IDatabasePool, dbPool } from './pool.ts';

// 1. NEWS REPOSITORY
export interface NewsArticleRecord {
  id: string;
  canonical_url: string;
  headline: string;
  body: string;
  source: any;
  published_at: Date | string;
  collected_at: Date | string;
  category: string;
  primary_category: string;
  secondary_categories: string[];
  sentiment: string;
  relevance_score: number;
  event_type: string;
  category_confidence: string;
  classification_evidence: any;
  fno: any;
}

export interface INewsRepository {
  insertArticle(article: NewsArticleRecord, client?: IDatabaseClient): Promise<void>;
  getArticleById(id: string): Promise<NewsArticleRecord | null>;
  getArticleByCanonicalUrl(url: string): Promise<NewsArticleRecord | null>;
  getLatestArticles(limit: number, offset?: number): Promise<NewsArticleRecord[]>;
  countArticles(): Promise<number>;
}

export class PostgresNewsRepository implements INewsRepository {
  constructor(private pool: IDatabasePool = dbPool) {}

  public async insertArticle(article: NewsArticleRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO news_articles (
        id, canonical_url, headline, body, source, published_at, collected_at,
        category, primary_category, secondary_categories, sentiment, relevance_score,
        event_type, category_confidence, classification_evidence, fno
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) ON CONFLICT (canonical_url) DO NOTHING;
    `;
    await q.query(sql, [
      article.id,
      article.canonical_url,
      article.headline,
      article.body,
      JSON.stringify(article.source),
      article.published_at,
      article.collected_at,
      article.category,
      article.primary_category,
      article.secondary_categories,
      article.sentiment,
      article.relevance_score,
      article.event_type,
      article.category_confidence,
      JSON.stringify(article.classification_evidence),
      JSON.stringify(article.fno),
    ]);
  }

  public async getArticleById(id: string): Promise<NewsArticleRecord | null> {
    const res = await this.pool.query<NewsArticleRecord>('SELECT * FROM news_articles WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  public async getArticleByCanonicalUrl(url: string): Promise<NewsArticleRecord | null> {
    const res = await this.pool.query<NewsArticleRecord>('SELECT * FROM news_articles WHERE canonical_url = $1', [url]);
    return res.rows[0] || null;
  }

  public async getLatestArticles(limit: number, offset: number = 0): Promise<NewsArticleRecord[]> {
    const res = await this.pool.query<NewsArticleRecord>(
      'SELECT * FROM news_articles ORDER BY published_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.rows;
  }

  public async countArticles(): Promise<number> {
    const res = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text as count FROM news_articles');
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}

// 2. INTELLIGENCE REPOSITORY
export interface NewsIntelligenceRecord {
  article_id: string;
  intelligence_version: string;
  canonical_url: string;
  headline: string;
  source: string;
  published_at: Date | string;
  company_name?: string | null;
  symbol?: string | null;
  entity_type?: string | null;
  fno_eligible: boolean;
  materiality_score: number;
  executive_summary?: string | null;
  financial_metrics: any;
  key_facts: any;
  evidence_spans: any;
  metrics_json: any;
  generated_at: Date | string;
}

export interface IIntelligenceRepository {
  insertIntelligence(record: NewsIntelligenceRecord, client?: IDatabaseClient): Promise<void>;
  getIntelligence(articleId: string, version: string): Promise<NewsIntelligenceRecord | null>;
  getIntelligenceBySymbol(symbol: string, limit: number): Promise<NewsIntelligenceRecord[]>;
  countIntelligence(): Promise<number>;
}

export class PostgresIntelligenceRepository implements IIntelligenceRepository {
  constructor(private pool: IDatabasePool = dbPool) {}

  public async insertIntelligence(record: NewsIntelligenceRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO news_intelligence (
        article_id, intelligence_version, canonical_url, headline, source, published_at,
        company_name, symbol, entity_type, fno_eligible, materiality_score, executive_summary,
        financial_metrics, key_facts, evidence_spans, metrics_json, generated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) ON CONFLICT (article_id, intelligence_version) DO NOTHING;
    `;
    await q.query(sql, [
      record.article_id,
      record.intelligence_version,
      record.canonical_url,
      record.headline,
      record.source,
      record.published_at,
      record.company_name || null,
      record.symbol || null,
      record.entity_type || null,
      record.fno_eligible,
      record.materiality_score,
      record.executive_summary || null,
      JSON.stringify(record.financial_metrics),
      JSON.stringify(record.key_facts),
      JSON.stringify(record.evidence_spans),
      JSON.stringify(record.metrics_json),
      record.generated_at,
    ]);
  }

  public async getIntelligence(articleId: string, version: string): Promise<NewsIntelligenceRecord | null> {
    const res = await this.pool.query<NewsIntelligenceRecord>(
      'SELECT * FROM news_intelligence WHERE article_id = $1 AND intelligence_version = $2',
      [articleId, version]
    );
    return res.rows[0] || null;
  }

  public async getIntelligenceBySymbol(symbol: string, limit: number = 20): Promise<NewsIntelligenceRecord[]> {
    const res = await this.pool.query<NewsIntelligenceRecord>(
      'SELECT * FROM news_intelligence WHERE symbol = $1 ORDER BY published_at DESC LIMIT $2',
      [symbol, limit]
    );
    return res.rows;
  }

  public async countIntelligence(): Promise<number> {
    const res = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text as count FROM news_intelligence');
    return parseInt(res.rows[0]?.count || '0', 10);
  }
}

// 3. SIGNAL REPOSITORY
export interface SignalRecord {
  signal_id: string;
  event_id: string;
  symbol: string;
  signal_type: string;
  current_state: string;
  timeline: any;
  raw_score: number;
  decayed_score: number;
  decay_factor: number;
  actionability: string;
  created_at: Date | string;
  last_updated: Date | string;
}

export interface SignalLedgerRecord {
  id?: number;
  signal_id: string;
  event_id: string;
  symbol: string;
  signal_type: string;
  initial_score: number;
  peak_score: number;
  initial_priority: string;
  final_state: string;
  initial_alignment: string;
  final_alignment: string;
  created_at: Date | string;
  invalidated_at?: Date | string | null;
  expired_at?: Date | string | null;
  duration: number;
}

export interface ISignalRepository {
  insertSignal(signal: SignalRecord, client?: IDatabaseClient): Promise<void>;
  updateSignalState(signalId: string, state: string, decayedScore: number, actionability: string, timeline: any, client?: IDatabaseClient): Promise<void>;
  getActiveSignals(): Promise<SignalRecord[]>;
  getSignalById(signalId: string): Promise<SignalRecord | null>;
  insertLedgerEntry(entry: SignalLedgerRecord, client?: IDatabaseClient): Promise<void>;
  getLedgerEntry(signalId: string): Promise<SignalLedgerRecord | null>;
}

export class PostgresSignalRepository implements ISignalRepository {
  constructor(private pool: IDatabasePool = dbPool) {}

  public async insertSignal(signal: SignalRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO signals (
        signal_id, event_id, symbol, signal_type, current_state, timeline,
        raw_score, decayed_score, decay_factor, actionability, created_at, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (signal_id) DO UPDATE SET
        current_state = EXCLUDED.current_state,
        decayed_score = EXCLUDED.decayed_score,
        decay_factor = EXCLUDED.decay_factor,
        actionability = EXCLUDED.actionability,
        timeline = EXCLUDED.timeline,
        last_updated = EXCLUDED.last_updated;
    `;
    await q.query(sql, [
      signal.signal_id,
      signal.event_id,
      signal.symbol,
      signal.signal_type,
      signal.current_state,
      JSON.stringify(signal.timeline),
      signal.raw_score,
      signal.decayed_score,
      signal.decay_factor,
      signal.actionability,
      signal.created_at,
      signal.last_updated,
    ]);
  }

  public async updateSignalState(
    signalId: string,
    state: string,
    decayedScore: number,
    actionability: string,
    timeline: any,
    client?: IDatabaseClient
  ): Promise<void> {
    const q = client || this.pool;
    const sql = `
      UPDATE signals
      SET current_state = $2, decayed_score = $3, actionability = $4, timeline = $5, last_updated = NOW()
      WHERE signal_id = $1;
    `;
    await q.query(sql, [signalId, state, decayedScore, actionability, JSON.stringify(timeline)]);
  }

  public async getActiveSignals(): Promise<SignalRecord[]> {
    const res = await this.pool.query<SignalRecord>(
      "SELECT * FROM signals WHERE current_state = 'ACTIVE' ORDER BY created_at DESC"
    );
    return res.rows;
  }

  public async getSignalById(signalId: string): Promise<SignalRecord | null> {
    const res = await this.pool.query<SignalRecord>('SELECT * FROM signals WHERE signal_id = $1', [signalId]);
    return res.rows[0] || null;
  }

  public async insertLedgerEntry(entry: SignalLedgerRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO signal_ledger (
        signal_id, event_id, symbol, signal_type, initial_score, peak_score,
        initial_priority, final_state, initial_alignment, final_alignment,
        created_at, invalidated_at, expired_at, duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (signal_id) DO NOTHING;
    `;
    await q.query(sql, [
      entry.signal_id,
      entry.event_id,
      entry.symbol,
      entry.signal_type,
      entry.initial_score,
      entry.peak_score,
      entry.initial_priority,
      entry.final_state,
      entry.initial_alignment,
      entry.final_alignment,
      entry.created_at,
      entry.invalidated_at || null,
      entry.expired_at || null,
      entry.duration,
    ]);
  }

  public async getLedgerEntry(signalId: string): Promise<SignalLedgerRecord | null> {
    const res = await this.pool.query<SignalLedgerRecord>('SELECT * FROM signal_ledger WHERE signal_id = $1', [signalId]);
    return res.rows[0] || null;
  }
}

// 4. PORTFOLIO REPOSITORY
export interface PortfolioRecord {
  id: string;
  name: string;
  description?: string | null;
  base_currency: string;
  status: string;
  cash_inr: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PortfolioPositionRecord {
  id: string;
  portfolio_id: string;
  symbol: string;
  underlying_symbol: string;
  asset_class: string;
  side: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  strike_price?: number | null;
  expiry_date?: string | null;
  greeks?: any;
  normalized_at: Date | string;
}

export interface PortfolioTimelineRecord {
  id: string;
  portfolio_id: string;
  timestamp: Date | string;
  type: string;
  title: string;
  description?: string | null;
  severity: string;
}

export interface IPortfolioRepository {
  insertPortfolio(portfolio: PortfolioRecord, client?: IDatabaseClient): Promise<void>;
  getPortfolio(id: string): Promise<PortfolioRecord | null>;
  getAllPortfolios(): Promise<PortfolioRecord[]>;
  updateCash(portfolioId: string, newCashINR: number, client?: IDatabaseClient): Promise<void>;
  insertPosition(pos: PortfolioPositionRecord, client?: IDatabaseClient): Promise<void>;
  getPositions(portfolioId: string): Promise<PortfolioPositionRecord[]>;
  insertTimelineEvent(evt: PortfolioTimelineRecord, client?: IDatabaseClient): Promise<void>;
}

export class PostgresPortfolioRepository implements IPortfolioRepository {
  constructor(private pool: IDatabasePool = dbPool) {}

  public async insertPortfolio(portfolio: PortfolioRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO portfolios (id, name, description, base_currency, status, cash_inr, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        cash_inr = EXCLUDED.cash_inr,
        updated_at = EXCLUDED.updated_at;
    `;
    await q.query(sql, [
      portfolio.id,
      portfolio.name,
      portfolio.description || null,
      portfolio.base_currency,
      portfolio.status,
      portfolio.cash_inr,
      portfolio.created_at,
      portfolio.updated_at,
    ]);
  }

  public async getPortfolio(id: string): Promise<PortfolioRecord | null> {
    const res = await this.pool.query<PortfolioRecord>('SELECT * FROM portfolios WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  public async getAllPortfolios(): Promise<PortfolioRecord[]> {
    const res = await this.pool.query<PortfolioRecord>('SELECT * FROM portfolios ORDER BY created_at ASC');
    return res.rows;
  }

  public async updateCash(portfolioId: string, newCashINR: number, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    await q.query('UPDATE portfolios SET cash_inr = $2, updated_at = NOW() WHERE id = $1', [portfolioId, newCashINR]);
  }

  public async insertPosition(pos: PortfolioPositionRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO portfolio_positions (
        id, portfolio_id, symbol, underlying_symbol, asset_class, side,
        quantity, entry_price, current_price, strike_price, expiry_date, greeks, normalized_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        current_price = EXCLUDED.current_price,
        quantity = EXCLUDED.quantity,
        greeks = EXCLUDED.greeks,
        normalized_at = EXCLUDED.normalized_at;
    `;
    await q.query(sql, [
      pos.id,
      pos.portfolio_id,
      pos.symbol,
      pos.underlying_symbol,
      pos.asset_class,
      pos.side,
      pos.quantity,
      pos.entry_price,
      pos.current_price,
      pos.strike_price || null,
      pos.expiry_date || null,
      pos.greeks ? JSON.stringify(pos.greeks) : null,
      pos.normalized_at,
    ]);
  }

  public async getPositions(portfolioId: string): Promise<PortfolioPositionRecord[]> {
    const res = await this.pool.query<PortfolioPositionRecord>(
      'SELECT * FROM portfolio_positions WHERE portfolio_id = $1 ORDER BY symbol ASC',
      [portfolioId]
    );
    return res.rows;
  }

  public async insertTimelineEvent(evt: PortfolioTimelineRecord, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO portfolio_timeline (id, portfolio_id, timestamp, type, title, description, severity)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING;
    `;
    await q.query(sql, [
      evt.id,
      evt.portfolio_id,
      evt.timestamp,
      evt.type,
      evt.title,
      evt.description || null,
      evt.severity,
    ]);
  }
}

// 5. TELEGRAM OUTBOX REPOSITORY
export interface TelegramOutboxRecord {
  id?: number;
  article_id: string;
  payload: any;
  attempts: number;
  last_attempt_at?: Date | string | null;
  next_retry_at?: Date | string | null;
  created_at?: Date | string;
}

export interface ITelegramOutboxRepository {
  enqueue(articleId: string, payload: any, client?: IDatabaseClient): Promise<void>;
  claimBatch(batchSize: number, client: IDatabaseClient): Promise<TelegramOutboxRecord[]>;
  acknowledge(id: number, client?: IDatabaseClient): Promise<void>;
  recordFailure(id: number, attempts: number, nextRetryAt: Date, client?: IDatabaseClient): Promise<void>;
}

export class PostgresTelegramOutboxRepository implements ITelegramOutboxRepository {
  constructor(private pool: IDatabasePool = dbPool) {}

  public async enqueue(articleId: string, payload: any, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    const sql = `
      INSERT INTO telegram_outbox (article_id, payload, attempts, created_at)
      VALUES ($1, $2, 0, NOW());
    `;
    await q.query(sql, [articleId, JSON.stringify(payload)]);
  }

  public async claimBatch(batchSize: number, client: IDatabaseClient): Promise<TelegramOutboxRecord[]> {
    const sql = `
      SELECT * FROM telegram_outbox
      WHERE next_retry_at IS NULL OR next_retry_at <= NOW()
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED;
    `;
    const res = await client.query<TelegramOutboxRecord>(sql, [batchSize]);
    return res.rows;
  }

  public async acknowledge(id: number, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    await q.query('DELETE FROM telegram_outbox WHERE id = $1', [id]);
  }

  public async recordFailure(id: number, attempts: number, nextRetryAt: Date, client?: IDatabaseClient): Promise<void> {
    const q = client || this.pool;
    await q.query(
      'UPDATE telegram_outbox SET attempts = $2, last_attempt_at = NOW(), next_retry_at = $3 WHERE id = $1',
      [id, attempts, nextRetryAt]
    );
  }
}
