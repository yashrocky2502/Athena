import pg from 'pg';
import { getDatabaseConfig, isDatabaseConfigured } from './config.ts';

const { Pool } = pg;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
}

export interface IDatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface IDatabasePool {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  getClient(): Promise<IDatabaseClient>;
  transaction<T>(callback: (client: IDatabaseClient) => Promise<T>): Promise<T>;
  checkHealth(): Promise<{ status: 'HEALTHY' | 'UNHEALTHY'; latencyMs: number; error?: string }>;
  close(): Promise<void>;
}

class PostgresDatabasePool implements IDatabasePool {
  private pool: pg.Pool | null = null;
  private isClosing: boolean = false;

  private getPool(): pg.Pool {
    if (this.isClosing) {
      throw new Error('[DatabasePool] Pool is closing down');
    }

    if (!this.pool) {
      if (!isDatabaseConfigured()) {
        throw new Error('[DatabasePool] PostgreSQL is not configured. DATABASE_URL or PG* variables required.');
      }

      const config = getDatabaseConfig();
      this.pool = new Pool({
        connectionString: config.connectionString,
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        max: config.maxConnections,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });

      this.pool.on('error', (err: Error) => {
        console.error('[DatabasePool] Unexpected pool error on idle client:', err.message);
      });
    }

    return this.pool;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const pool = this.getPool();
    const result = await pool.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  public async getClient(): Promise<IDatabaseClient> {
    const pool = this.getPool();
    const client = await pool.connect();
    return {
      query: async <T = any>(text: string, params?: any[]) => {
        const result = await client.query(text, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount,
        };
      },
      release: () => client.release(),
    };
  }

  public async transaction<T>(callback: (client: IDatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr: any) {
        console.error('[DatabasePool] Rollback failed:', rollbackErr.message);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  public async checkHealth(): Promise<{ status: 'HEALTHY' | 'UNHEALTHY'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (!isDatabaseConfigured()) {
        return {
          status: 'UNHEALTHY',
          latencyMs: 0,
          error: 'DATABASE_NOT_CONFIGURED',
        };
      }
      await this.query('SELECT 1 AS health_check');
      return {
        status: 'HEALTHY',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        status: 'UNHEALTHY',
        latencyMs: Date.now() - start,
        error: err?.message || String(err),
      };
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      this.isClosing = true;
      await this.pool.end();
      this.pool = null;
      this.isClosing = false;
    }
  }
}

export const dbPool: IDatabasePool = new PostgresDatabasePool();
