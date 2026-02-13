/**
 * Users API Routes
 */

import type { FastifyInstance } from 'fastify';
import { getDB } from '../database/index.js';

export function registerUserRoutes(app: FastifyInstance) {
  const prefix = '/api/users';

  // Check if admin exists (must be before /:id)
  app.get(`${prefix}/admin/exists`, async () => {
    const hasAdmin = await getDB().users.hasAdminUser();
    return { hasAdmin };
  });

  // Find user by email
  app.get(`${prefix}/email/:email`, async (req) => {
    const { email } = req.params as { email: string };
    const user = await getDB().users.findByEmail(email);
    if (!user) return { error: 'User not found' };
    return user;
  });

  // Find user by username
  app.get(`${prefix}/username/:username`, async (req) => {
    const { username } = req.params as { username: string };
    const user = await getDB().users.findByUsername(username);
    if (!user) return { error: 'User not found' };
    return user;
  });

  // List users with filters
  app.get(prefix, async (req) => {
    const { limit, offset, search, role } = req.query as Record<string, string>;
    return getDB().users.findWithFilter({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      search,
      role: role as 'admin' | 'moderator' | 'user',
    });
  });

  // Find user by ID
  app.get(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const user = await getDB().users.findById(id);
    if (!user) return { error: 'User not found' };
    return user;
  });

  // Create user
  app.post(prefix, async (req, reply) => {
    const data = req.body as { email: string; password: string; name: string; username?: string; role?: string };
    const user = await getDB().users.create(data);
    reply.code(201);
    return user;
  });

  // Update user
  app.put(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const user = await getDB().users.update(id, req.body as Record<string, unknown>);
    if (!user) return { error: 'User not found' };
    return user;
  });

  // Delete user
  app.delete(`${prefix}/:id`, async (req) => {
    const { id } = req.params as { id: string };
    const deleted = await getDB().users.delete(id);
    return { success: deleted };
  });

  // Update last login
  app.post(`${prefix}/:id/login`, async (req) => {
    const { id } = req.params as { id: string };
    await getDB().users.updateLastLogin(id);
    return { success: true };
  });

  // Update last seen
  app.post(`${prefix}/:id/seen`, async (req) => {
    const { id } = req.params as { id: string };
    await getDB().users.updateLastSeen(id);
    return { success: true };
  });

  // Update notes timestamp
  app.post(`${prefix}/:id/notes-updated`, async (req) => {
    const { id } = req.params as { id: string };
    await getDB().users.updateNotesTimestamp(id);
    return { success: true };
  });

  // Update password hash
  app.post(`${prefix}/:id/password`, async (req) => {
    const { id } = req.params as { id: string };
    const { hash, algorithm } = req.body as { hash: string; algorithm: string };
    await getDB().users.updatePasswordHash(id, hash, algorithm);
    return { success: true };
  });

  // Suspend user
  app.post(`${prefix}/:id/suspend`, async (req) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };
    await getDB().users.suspendUser(id, reason);
    return { success: true };
  });

  // Unsuspend user
  app.post(`${prefix}/:id/unsuspend`, async (req) => {
    const { id } = req.params as { id: string };
    await getDB().users.unsuspendUser(id);
    return { success: true };
  });
}
