/**
 * Routes Index - Fastify
 */

import type { FastifyInstance } from 'fastify';
import { registerUserRoutes } from './users.js';
import { registerNoteRoutes } from './notes.js';
import { registerFolderRoutes } from './folders.js';
import { registerRawRoutes } from './raw.js';

export function registerRoutes(app: FastifyInstance) {
  registerUserRoutes(app);
  registerNoteRoutes(app);
  registerFolderRoutes(app);
  registerRawRoutes(app);
}
