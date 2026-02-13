/**
 * Raw Query Routes - Advanced Database Operations
 */

import type { FastifyInstance } from 'fastify';
import { getDB } from '../database/index.js';
import { execute, query, withTransaction } from '../database/mysql/connection.js';

export function registerRawRoutes(app: FastifyInstance) {
  const prefix = '/api/raw';

  // Database status
  app.get(`${prefix}/status`, async () => {
    return getDB().getStatus();
  });

  // Health check
  app.get(`${prefix}/health`, async (req, reply) => {
    const healthy = await getDB().healthCheck();
    reply.code(healthy ? 200 : 503);
    return { healthy };
  });

  // Run migrations
  app.post(`${prefix}/migrate`, async () => {
    await getDB().migrate();
    return { success: true };
  });

  // Count records in table
  app.get(`${prefix}/count/:table`, async (req, reply) => {
    const { table } = req.params as { table: string };
    const allowed = ['users', 'notes', 'folders', 'sessions', 'audit_logs'];
    if (!allowed.includes(table)) {
      reply.code(400);
      return { error: 'Invalid table' };
    }
    const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
    return { count: (result as Array<{ count: number }>)[0].count };
  });

  // Execute raw SELECT query
  app.post(`${prefix}/query`, async (req) => {
    const { sql, params } = req.body as { sql: string; params?: unknown[] };
    return query(sql, params);
  });

  // Execute raw INSERT/UPDATE/DELETE
  app.post(`${prefix}/execute`, async (req) => {
    const { sql, params } = req.body as { sql: string; params?: unknown[] };
    const result = await execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId,
    };
  });

  // Execute multiple queries in transaction
  app.post(`${prefix}/transaction`, async (req) => {
    const { queries } = req.body as { queries: Array<{ sql: string; params?: unknown[] }> };
    return withTransaction(async (conn) => {
      const res: unknown[] = [];
      for (const q of queries) {
        const [rows] = await conn.execute(q.sql, q.params);
        res.push(rows);
      }
      return res;
    });
  });
}
