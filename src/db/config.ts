export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && databaseUrl.trim().length > 0) {
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    return {
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      maxConnections: process.env.PG_MAX_CONNECTIONS ? parseInt(process.env.PG_MAX_CONNECTIONS, 10) : 10,
      idleTimeoutMillis: process.env.PG_IDLE_TIMEOUT_MS ? parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) : 30000,
      connectionTimeoutMillis: process.env.PG_CONN_TIMEOUT_MS ? parseInt(process.env.PG_CONN_TIMEOUT_MS, 10) : 5000,
    };
  }

  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const port = process.env.PGPORT || process.env.POSTGRES_PORT ? parseInt(process.env.PGPORT || process.env.POSTGRES_PORT || '5432', 10) : 5432;
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;

  if (host && database && user) {
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    return {
      host,
      port,
      database,
      user,
      password,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      maxConnections: process.env.PG_MAX_CONNECTIONS ? parseInt(process.env.PG_MAX_CONNECTIONS, 10) : 10,
      idleTimeoutMillis: process.env.PG_IDLE_TIMEOUT_MS ? parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) : 30000,
      connectionTimeoutMillis: process.env.PG_CONN_TIMEOUT_MS ? parseInt(process.env.PG_CONN_TIMEOUT_MS, 10) : 5000,
    };
  }

  return {
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export function isDatabaseConfigured(): boolean {
  const config = getDatabaseConfig();
  return Boolean(config.connectionString || (config.host && config.database && config.user));
}
