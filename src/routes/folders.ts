/**
 * Folders API Routes
 */

import type { FastifyInstance } from 'fastify';
import { getDB } from '../database/index.js';

export function registerFolderRoutes(app: FastifyInstance) {
  const prefix = '/api/folders';

  // Find folders by owner
  app.get(`${prefix}/owner/:ownerId`, async (req) => {
    const { ownerId } = req.params as { ownerId: string };
    const { includeDeleted, onlyDeleted } = req.query as Record<string, string>;
    return getDB().folders.findByOwnerId(ownerId, {
      includeDeleted: includeDeleted === 'true',
      onlyDeleted: onlyDeleted === 'true',
    });
  });

  // List folders with filters
  app.get(prefix, async (req) => {
    const { limit, offset, ownerId, includeDeleted, onlyDeleted } = req.query as Record<string, string>;
    return getDB().folders.findWithFilter({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      ownerId,
      includeDeleted: includeDeleted === 'true',
      onlyDeleted: onlyDeleted === 'true',
    });
  });

  // Find folder by ID
  app.get(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const folder = await getDB().folders.findById(id);
    if (!folder) return { error: 'Folder not found' };
    return folder;
  });

  // Create folder
  app.post(prefix, async (req, reply) => {
    const data = req.body as { ownerId: string; name: string; color: string };
    const folder = await getDB().folders.create(data);
    reply.code(201);
    return folder;
  });

  // Upsert folder
  app.post(`${prefix}/upsert`, async (req) => {
    const { id, ownerId, ...data } = req.body as { id: string; ownerId: string; [key: string]: unknown };
    return getDB().folders.upsert(id, ownerId, data);
  });

  // Bulk upsert folders
  app.post(`${prefix}/bulk-upsert`, async (req, reply) => {
    console.log('[Folders] Bulk upsert request received');
    try {
      const folders = req.body as Array<{ id: string; ownerId: string; [key: string]: unknown }>;
      console.log(`[Folders] Bulk upsert: ${Array.isArray(folders) ? folders.length : 'NOT AN ARRAY'} items`);
      
      if (!Array.isArray(folders)) {
        console.log('[Folders] Bulk upsert error: Request body is not an array');
        return reply.code(400).send({ error: 'Request body must be an array of folders' });
      }
      
      if (folders.length > 0) {
        console.log(`[Folders] First folder ID: ${folders[0]?.id}, ownerId: ${folders[0]?.ownerId}`);
      }
      
      const count = await getDB().folders.bulkUpsert(folders);
      console.log(`[Folders] Bulk upsert success: ${count} folders synced`);
      return { synced: count };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : 'No stack';
      console.error('[Folders] Bulk upsert error:', errMsg);
      console.error('[Folders] Bulk upsert stack:', errStack);
      return reply.code(500).send({ 
        error: errMsg || 'Failed to bulk upsert folders' 
      });
    }
  });

  // Update folder
  app.put(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const folder = await getDB().folders.update(id, req.body as Record<string, unknown>);
    if (!folder) return { error: 'Folder not found' };
    return folder;
  });

  // Delete folder
  app.delete(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await getDB().folders.delete(id);
    return { success: deleted };
  });

  // Delete folders by owner
  app.delete(`${prefix}/owner/:ownerId`, async (req) => {
    const { ownerId } = req.params as { ownerId: string };
    const count = await getDB().folders.deleteByOwnerId(ownerId);
    return { deleted: count };
  });

  // Permanent delete
  app.delete(`${prefix}/:id/permanent`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.query as { ownerId: string };
    const deleted = await getDB().folders.permanentDelete(id, ownerId);
    return { success: deleted };
  });

  // Soft delete (trash)
  app.post(`${prefix}/:id/trash`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.body as { ownerId: string };
    await getDB().folders.softDelete(id, ownerId);
    return { success: true };
  });

  // Restore from trash
  app.post(`${prefix}/:id/restore`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.body as { ownerId: string };
    await getDB().folders.restore(id, ownerId);
    return { success: true };
  });
}
