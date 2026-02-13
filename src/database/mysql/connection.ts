/**
 * MySQL Connection Pool
 * High-performance connection management with pooling
 */

import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

let pool: Pool | null = null;

/**
 * Get or create the MySQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: config.mysql.poolMax,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 30000,
      // Performance optimizations
      namedPlaceholders: true,
      dateStrings: true,
      timezone: '+00:00',
      // Prepared statements
      supportBigNumbers: true,
      bigNumberStrings: true,
    });

    logger.info(
      { host: config.mysql.host, database: config.mysql.database, poolSize: config.mysql.poolMax },
      'MySQL connection pool created'
    );
  }

  return pool;
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}

/**
 * Execute an insert/update/delete query
 */
export async function execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Get a connection from the pool for transactions
 */
export async function getConnection(): Promise<PoolConnection> {
  const pool = getPool();
  return pool.getConnection();
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(
  fn: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Check database connection health
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    logger.error({ error }, 'MySQL health check failed');
    return false;
  }
}

/**
 * Close all connections in the pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('MySQL connection pool closed');
  }
}

/**
 * Check if pool is connected
 */
export function isConnected(): boolean {
  return pool !== null;
}
