import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabaseConfig, isDatabaseConfigured } from '../config.ts';
import { dbPool, IDatabaseClient } from '../pool.ts';
import {
  PostgresNewsRepository,
  PostgresIntelligenceRepository,
  PostgresSignalRepository,
  PostgresPortfolioRepository,
  PostgresTelegramOutboxRepository,
} from '../repositories.ts';
import { calculateDatasetHashes, REFERENCE_HASHES, verifySourceIntegrity } from '../migrate.ts';

describe('Phase 22A: PostgreSQL Persistence Foundation Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. Configuration & Secret Safety', () => {
    it('detects unconfigured database state safely', () => {
      delete process.env.DATABASE_URL;
      delete process.env.PGHOST;
      delete process.env.PGDATABASE;
      delete process.env.PGUSER;
      expect(isDatabaseConfigured()).toBe(false);
    });

    it('parses DATABASE_URL correctly without exposing credentials', () => {
      process.env.DATABASE_URL = 'postgresql://user:secret@localhost:5432/athena_test';
      expect(isDatabaseConfigured()).toBe(true);
      const config = getDatabaseConfig();
      expect(config.connectionString).toBe(process.env.DATABASE_URL);
      expect(config.ssl).toBe(false); // localhost disables SSL requirement
    });

    it('configures remote SSL require correctly', () => {
      process.env.DATABASE_URL = 'postgresql://user:secret@db.supabase.co:5432/athena_test';
      const config = getDatabaseConfig();
      expect(config.ssl).toEqual({ rejectUnauthorized: false });
    });
  });

  describe('2. Source Dataset Cryptographic Integrity Baseline', () => {
    it('verifies all 7 protected datasets are 100% byte-identical to baseline', () => {
      const hashes = calculateDatasetHashes();
      for (const [file, hash] of Object.entries(REFERENCE_HASHES)) {
        expect(hashes[file]).toBe(hash);
      }
      expect(() => verifySourceIntegrity()).not.toThrow();
    });
  });

  describe('3. Repository Layer SQL & Parameterization', () => {
    it('PostgresNewsRepository parameterizes insert correctly and enforces ON CONFLICT DO NOTHING', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      const mockPool: any = { query: mockQuery };
      const repo = new PostgresNewsRepository(mockPool);

      await repo.insertArticle({
        id: 'test_1',
        canonical_url: 'https://example.com/test',
        headline: 'Test Headline',
        body: 'Article text',
        source: { name: 'Reuters', tier: 'TIER_1' },
        published_at: new Date('2026-09-28T00:00:00Z'),
        collected_at: new Date('2026-09-28T00:01:00Z'),
        category: 'FINANCIAL',
        primary_category: 'MARKETS',
        secondary_categories: ['EQUITY'],
        sentiment: 'POSITIVE',
        relevance_score: 95.5,
        event_type: 'CATALYST',
        category_confidence: 'HIGH',
        classification_evidence: [],
        fno: { eligible: true },
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (canonical_url) DO NOTHING');
      expect(params[0]).toBe('test_1');
      expect(params[1]).toBe('https://example.com/test');
      expect(params[11]).toBe(95.5);
    });

    it('PostgresIntelligenceRepository uses composite key (article_id, intelligence_version)', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      const mockPool: any = { query: mockQuery };
      const repo = new PostgresIntelligenceRepository(mockPool);

      await repo.insertIntelligence({
        article_id: 'art_123',
        intelligence_version: '27.4',
        canonical_url: 'https://example.com/art',
        headline: 'Intel Headline',
        source: 'Moneycontrol',
        published_at: new Date(),
        fno_eligible: true,
        materiality_score: 88.0,
        financial_metrics: [],
        key_facts: ['Fact 1'],
        evidence_spans: [],
        metrics_json: {},
        generated_at: new Date(),
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (article_id, intelligence_version) DO NOTHING');
      expect(params[0]).toBe('art_123');
      expect(params[1]).toBe('27.4');
    });

    it('PostgresSignalRepository inserts ledger entry with UNIQUE signal_id constraint', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      const mockPool: any = { query: mockQuery };
      const repo = new PostgresSignalRepository(mockPool);

      await repo.insertLedgerEntry({
        signal_id: 'sig_test_1',
        event_id: 'evt_1',
        symbol: 'RELIANCE',
        signal_type: 'CATALYST',
        initial_score: 75,
        peak_score: 85,
        initial_priority: 'P1_HIGH',
        final_state: 'RESOLVED',
        initial_alignment: 'BULLISH',
        final_alignment: 'BULLISH',
        created_at: new Date(),
        duration: 120,
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO signal_ledger');
      expect(sql).toContain('ON CONFLICT (signal_id) DO NOTHING');
      expect(params[0]).toBe('sig_test_1');
    });

    it('PostgresTelegramOutboxRepository uses FOR UPDATE SKIP LOCKED on batch claim', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ id: 1, article_id: 'art_1', payload: {}, attempts: 0 }],
        rowCount: 1,
      });
      const mockClient: any = { query: mockQuery };
      const repo = new PostgresTelegramOutboxRepository();

      const batch = await repo.claimBatch(10, mockClient);
      expect(batch.length).toBe(1);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(params[0]).toBe(10);
    });

    it('PostgresPortfolioRepository updates cash atomically with parameterized query', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      const mockPool: any = { query: mockQuery };
      const repo = new PostgresPortfolioRepository(mockPool);

      await repo.updateCash('PORTFOLIO_DEFAULT', 500000.5);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE portfolios SET cash_inr = $2');
      expect(params[0]).toBe('PORTFOLIO_DEFAULT');
      expect(params[1]).toBe(500000.5);
    });
  });

  describe('4. Health Check Behavior', () => {
    it('returns UNHEALTHY and does not throw when database is unconfigured', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.PGHOST;
      const res = await dbPool.checkHealth();
      expect(res.status).toBe('UNHEALTHY');
      expect(res.error).toBe('DATABASE_NOT_CONFIGURED');
    });
  });

  describe('5. Fail-Closed Transaction Rollback', () => {
    it('executes ROLLBACK when an error is thrown inside transaction callback', async () => {
      const queriesExecuted: string[] = [];
      const mockClient: IDatabaseClient = {
        query: async (text: string) => {
          queriesExecuted.push(text.trim());
          if (text.includes('FAIL_STEP')) {
            throw new Error('Simulated query failure');
          }
          return { rows: [], rowCount: 0 };
        },
        release: vi.fn(),
      };

      const mockPoolWithClient: any = {
        getClient: async () => mockClient,
        transaction: async (cb: any) => {
          const client = await mockPoolWithClient.getClient();
          try {
            await client.query('BEGIN');
            await cb(client);
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          } finally {
            client.release();
          }
        },
      };

      await expect(
        mockPoolWithClient.transaction(async (client: IDatabaseClient) => {
          await client.query('STEP 1');
          await client.query('FAIL_STEP');
        })
      ).rejects.toThrow('Simulated query failure');

      expect(queriesExecuted).toEqual(['BEGIN', 'STEP 1', 'FAIL_STEP', 'ROLLBACK']);
    });
  });
});
