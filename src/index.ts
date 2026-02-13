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
  const app = Fastify({ 
    logger: false,
    bodyLimit: 50 * 1024 * 1024, // 50MB body limit for large notes
  });
  const db = getDB();

  // Register CORS
  await app.register(cors, { origin: true });

  // Log all incoming requests
  app.addHook('onRequest', async (request) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${request.method} ${request.url}`);
  });

  // API Key Authentication - runs on every request
  app.addHook('onRequest', async (request, reply) => {
    // Allow health check without auth
    if (request.url === '/api/raw/health' || request.url === '/') {
      return;
    }

    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      console.log(`[AUTH] Rejected - Missing API key for ${request.url}`);
      reply.code(401).send({ error: 'Missing API key. Include X-API-Key header.' });
      return;
    }

    if (apiKey !== config.security.apiKey) {
      console.log(`[AUTH] Rejected - Invalid API key for ${request.url}`);
      reply.code(403).send({ error: 'Invalid API key' });
      return;
    }
    
    console.log(`[AUTH] Accepted for ${request.url}`);
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

  // Global error handler - return meaningful error messages
  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    // Log to both logger and console for visibility
    const errorMsg = error.message || 'Unknown error';
    const errorStack = error.stack || 'No stack trace';
    
    logger.error({ error: errorMsg, stack: errorStack, url: request.url }, 'Request error');
    console.error(`[ERROR] ${request.method} ${request.url}:`, errorMsg);
    console.error(`[ERROR STACK]`, errorStack);
    
    reply.status(error.statusCode || 500).send({
      error: errorMsg,
      statusCode: error.statusCode || 500,
    });
  });

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
