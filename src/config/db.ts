import { RowDataPacket, ResultSetHeader, createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export let pool = undefined as ReturnType<typeof createPool> | undefined;

export const initPool = (config: any) => {
  pool = createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: config.connectionLimit ?? 10,
    queueLimit: 0,
    timezone: 'local',
  });
};

export const connection = async () => {
  if (!pool) throw new Error('Database connection pool is not initialized');
  try {
    const conn = await pool.getConnection();
    return conn;
  } catch (err) {
    console.error('[db.connection] error', err);
    throw new Error('Database connection error');
  }
};

export const queryRows = async <T extends RowDataPacket>(sql: string, params: any[] = []) => {
  if (!sql) throw new Error('SQL query is required');
  if (!Array.isArray(params)) throw new Error('Parameters must be an array');

  const conn = await connection();
  try {
    const [rows] = await conn.query<T[]>(sql, params);
    return rows;
  } finally {
    try {
      conn.release();
    } catch (e) {
      console.error('[db.queryRows] release error', e);
    }
  }
};

export const queryInsertion = async <T extends ResultSetHeader>(
  sql: string,
  params: any[] = []
) => {
  if (!sql) throw new Error('SQL query is required');
  if (!Array.isArray(params)) throw new Error('Parameters must be an array');

  const conn = await connection();
  try {
    const [result] = await conn.query<T>(sql, params);
    return result;
  } finally {
    try {
      conn.release();
    } catch (e) {
      console.error('[db.queryInsertion] release error', e);
    }
  }
};
