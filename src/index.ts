/**
 * Kansha MySQL Database Gateway
 * Secured REST API for MySQL database operations
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { getDB } from './database/index.js';
import { registerRoutes } from './routes/index.js';

async function main() {
  const app = Fastify({ logger: false });
  const db = getDB();

  // Register CORS
  await app.register(cors, { origin: true });

  // API Key Authentication - runs on every request
  app.addHook('onRequest', async (request, reply) => {
    // Allow health check without auth
    if (request.url === '/api/raw/health' || request.url === '/') {
      return;
    }

    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      reply.code(401).send({ error: 'Missing API key. Include X-API-Key header.' });
      return;
    }

    if (apiKey !== config.security.apiKey) {
      reply.code(403).send({ error: 'Invalid API key' });
      return;
    }
  });

  // Connect to database
  try {
    await db.connect();
    await db.migrate();
    logger.info('Database ready');
  } catch (err) {
    logger.error('Failed to connect to database');
    console.error(err);
    process.exit(1);
  }

  // Register routes
  registerRoutes(app);

  // Root endpoint (public - shows API info)
  app.get('/', async () => ({
    name: 'Kansha MySQL Gateway',
    version: '1.0.0',
    secured: true,
    message: 'Include X-API-Key header to access endpoints',
  }));

  // Start server
  try {
    await app.listen({ port: config.server.port, host: '0.0.0.0' });
    logger.info(`MySQL Gateway running on http://localhost:${config.server.port}`);
    logger.info('API Key authentication enabled');
  } catch (err) {
    console.error('Server error:', err);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await app.close();
    await db.disconnect();
    process.exit(0);
  });
}

main();
