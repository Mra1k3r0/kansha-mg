/**
 * Notes API Routes
 */

import type { FastifyInstance } from 'fastify';
import { getDB } from '../database/index.js';

export function registerNoteRoutes(app: FastifyInstance) {
  const prefix = '/api/notes';

  // Find note by short ID (for sharing)
  app.get(`${prefix}/short/:shortId`, async (req) => {
    const { shortId } = req.params as { shortId: string };
    const note = await getDB().notes.findByShortId(shortId);
    if (!note) return { error: 'Note not found' };
    return note;
  });

  // Find notes by owner
  app.get(`${prefix}/owner/:ownerId`, async (req) => {
    const { ownerId } = req.params as { ownerId: string };
    const { includeDeleted, onlyDeleted, folderId, visibility } = req.query as Record<string, string>;
    return getDB().notes.findByOwnerId(ownerId, {
      includeDeleted: includeDeleted === 'true',
      onlyDeleted: onlyDeleted === 'true',
      folderId: folderId === 'null' ? null : folderId,
      visibility,
    });
  });

  // List notes with filters
  app.get(prefix, async (req) => {
    const { limit, offset, ownerId, folderId, visibility, includeDeleted, onlyDeleted } = req.query as Record<string, string>;
    return getDB().notes.findWithFilter({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      ownerId,
      folderId: folderId === 'null' ? null : folderId,
      visibility,
      includeDeleted: includeDeleted === 'true',
      onlyDeleted: onlyDeleted === 'true',
    });
  });

  // Find note by ID
  app.get(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const note = await getDB().notes.findById(id);
    if (!note) return { error: 'Note not found' };
    return note;
  });

  // Create note
  app.post(prefix, async (req, reply) => {
    const data = req.body as { ownerId: string; title: string; content: string; [key: string]: unknown };
    const note = await getDB().notes.create(data);
    reply.code(201);
    return note;
  });

  // Upsert note
  app.post(`${prefix}/upsert`, async (req) => {
    const { id, ownerId, ...data } = req.body as { id: string; ownerId: string; [key: string]: unknown };
    return getDB().notes.upsert(id, ownerId, data);
  });

  // Bulk upsert notes
  app.post(`${prefix}/bulk-upsert`, async (req) => {
    const notes = req.body as Array<{ id: string; ownerId: string; [key: string]: unknown }>;
    const count = await getDB().notes.bulkUpsert(notes);
    return { synced: count };
  });

  // Update folder reference
  app.post(`${prefix}/update-folder`, async (req) => {
    const { folderId, ownerId, newFolderId } = req.body as { folderId: string; ownerId: string; newFolderId: string | null };
    const count = await getDB().notes.updateFolderReference(folderId, ownerId, newFolderId);
    return { updated: count };
  });

  // Update note
  app.put(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const note = await getDB().notes.update(id, req.body as Record<string, unknown>);
    if (!note) return { error: 'Note not found' };
    return note;
  });

  // Delete note
  app.delete(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await getDB().notes.delete(id);
    return { success: deleted };
  });

  // Delete notes by owner
  app.delete(`${prefix}/owner/:ownerId`, async (req) => {
    const { ownerId } = req.params as { ownerId: string };
    const count = await getDB().notes.deleteByOwnerId(ownerId);
    return { deleted: count };
  });

  // Permanent delete
  app.delete(`${prefix}/:id/permanent`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.query as { ownerId: string };
    const deleted = await getDB().notes.permanentDelete(id, ownerId);
    return { success: deleted };
  });

  // Soft delete (trash)
  app.post(`${prefix}/:id/trash`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.body as { ownerId: string };
    await getDB().notes.softDelete(id, ownerId);
    return { success: true };
  });

  // Restore from trash
  app.post(`${prefix}/:id/restore`, async (req) => {
    const { id } = req.params as { id: string };
    const { ownerId } = req.body as { ownerId: string };
    await getDB().notes.restore(id, ownerId);
    return { success: true };
  });

  // Add version
  app.post(`${prefix}/:id/versions`, async (req) => {
    const { id } = req.params as { id: string };
    const version = req.body as { id: string; title: string; content: string; savedAt: string };
    await getDB().notes.addVersion(id, version);
    return { success: true };
  });

  // Add comment
  app.post(`${prefix}/:id/comments`, async (req) => {
    const { id } = req.params as { id: string };
    const comment = req.body as { id: string; author: string; content: string; createdAt: string };
    await getDB().notes.addComment(id, comment);
    return { success: true };
  });

  // Increment views
  app.post(`${prefix}/:id/view`, async (req) => {
    const { id } = req.params as { id: string };
    await getDB().notes.incrementViews(id);
    return { success: true };
  });
}
