import { Pool, QueryResultRow } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query<T>(text, params as any[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a set of statements inside a single transaction.
 * The callback receives a `run` function scoped to the transaction client.
 */
export async function withTransaction<T>(
  fn: (run: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = async <R extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => {
      const res = await client.query<R>(text, params as any[]);
      return res.rows;
    };
    const result = await fn(run);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
