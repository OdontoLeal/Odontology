import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';

// OID 1114 = TIMESTAMP WITHOUT TIME ZONE (ej. bloques_horario.inicio, final)
// OID 1082 = DATE
// Prevenir que el driver pg serialice a Date en UTC (+5h) y asegurar que retorne el string local de BD tal cual
types.setTypeParser(1114, (str: string) => str);
types.setTypeParser(1082, (str: string) => str);
import { envConfig } from '../../../app/config/env.config';

class Database {
  private static instance: Database;
  public readonly pool: Pool;

  private constructor() {
    const sslConfig = envConfig.db.ssl ? { rejectUnauthorized: false } : false;

    this.pool = envConfig.db.connectionString
      ? new Pool({
          connectionString: envConfig.db.connectionString,
          ssl: sslConfig,
          max: 15, 
          idleTimeoutMillis: 30000,
        })
      : new Pool({
          host: envConfig.db.host,
          port: envConfig.db.port,
          database: envConfig.db.database,
          user: envConfig.db.user,
          password: envConfig.db.password,
          ssl: sslConfig,
          max: 15,
          idleTimeoutMillis: 30000,
        });

    this.pool.on('connect', (client: PoolClient) => {
      client.query("SET TIME ZONE 'America/Bogota';");
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  public async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const db = Database.getInstance();