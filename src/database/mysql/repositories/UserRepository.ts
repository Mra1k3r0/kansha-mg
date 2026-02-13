/**
 * MySQL User Repository
 */

import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';
import type { IUserRepository, UserQueryOptions } from '../../interfaces/IUserRepository.js';
import type { PaginatedResult, QueryOptions } from '../../interfaces/IRepository.js';
import type { User, CreateUserDTO, UpdateUserDTO, HashAlgorithm } from '../../../domain/models/User.js';
import { query, execute } from '../connection.js';

interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  hash_algorithm: HashAlgorithm;
  name: string;
  role: string;
  permissions: string;
  suspended: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  notes_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    hashAlgorithm: row.hash_algorithm || 'pbkdf2',
    name: row.name,
    role: row.role as User['role'],
    permissions: row.permissions ? JSON.parse(row.permissions) : [],
    suspended: Boolean(row.suspended),
    suspendedAt: row.suspended_at || undefined,
    suspendedReason: row.suspended_reason || undefined,
    lastLoginAt: row.last_login_at || undefined,
    lastSeenAt: row.last_seen_at || undefined,
    notesUpdatedAt: row.notes_updated_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const rows = await query<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await query<UserRow[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await query<UserRow[]>('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    return rows.length > 0 ? rowToUser(rows[0]) : null;
  }

  async findAll(options?: QueryOptions): Promise<PaginatedResult<User>> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const orderBy = options?.orderBy || 'created_at';
    const orderDir = options?.orderDirection || 'DESC';

    const [rows, countResult] = await Promise.all([
      query<UserRow[]>(`SELECT * FROM users ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`, [limit, offset]),
      query<RowDataPacket[]>('SELECT COUNT(*) as total FROM users'),
    ]);

    return {
      data: rows.map(rowToUser),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async findWithFilter(options: UserQueryOptions): Promise<PaginatedResult<User>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.search) {
      conditions.push('(username LIKE ? OR email LIKE ? OR name LIKE ?)');
      const pattern = `%${options.search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (options.role) {
      conditions.push('role = ?');
      params.push(options.role);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countResult] = await Promise.all([
      query<UserRow[]>(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM users ${where}`, params),
    ]);

    return {
      data: rows.map(rowToUser),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async create(data: CreateUserDTO): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const role = data.role || 'user';
    const username = data.username || data.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 6);

    await execute(
      `INSERT INTO users (id, username, email, password_hash, hash_algorithm, name, role, permissions, suspended, created_at, updated_at, last_login_at, last_seen_at, notes_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, data.email, data.password, 'pbkdf2', data.name, role, '[]', 0, now, now, now, now, now]
    );

    return this.findById(id) as Promise<User>;
  }

  async update(id: string, data: UpdateUserDTO): Promise<User | null> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.username !== undefined) { updates.push('username = ?'); params.push(data.username); }
    if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email); }
    if (data.role !== undefined) { updates.push('role = ?'); params.push(data.role); }
    if (data.permissions !== undefined) { updates.push('permissions = ?'); params.push(JSON.stringify(data.permissions)); }
    if (data.suspended !== undefined) {
      updates.push('suspended = ?');
      params.push(data.suspended ? 1 : 0);
      if (data.suspended) {
        updates.push('suspended_at = ?');
        params.push(new Date().toISOString());
      } else {
        updates.push('suspended_at = NULL', 'suspended_reason = NULL');
      }
    }
    if (data.suspendedReason !== undefined) { updates.push('suspended_reason = ?'); params.push(data.suspendedReason); }

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = ?');
    params.push(new Date().toISOString(), id);

    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM users ${where}`, params);
    return (result[0] as { total: number }).total;
  }

  async hasAdminUser(): Promise<boolean> {
    const result = await query<RowDataPacket[]>("SELECT COUNT(*) as c FROM users WHERE role = 'admin' LIMIT 1");
    return (result[0] as { c: number }).c > 0;
  }

  async updateLastLogin(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await execute('UPDATE users SET last_login_at = ?, last_seen_at = ? WHERE id = ?', [now, now, userId]);
  }

  async updateLastSeen(userId: string): Promise<void> {
    await execute('UPDATE users SET last_seen_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
  }

  async updateNotesTimestamp(userId: string): Promise<void> {
    await execute('UPDATE users SET notes_updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
  }

  async updatePasswordHash(userId: string, hash: string, algorithm: string): Promise<void> {
    await execute('UPDATE users SET password_hash = ?, hash_algorithm = ?, updated_at = ? WHERE id = ?', [hash, algorithm, new Date().toISOString(), userId]);
  }

  async suspendUser(userId: string, reason?: string): Promise<void> {
    await execute('UPDATE users SET suspended = 1, suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?', [new Date().toISOString(), reason || null, new Date().toISOString(), userId]);
  }

  async unsuspendUser(userId: string): Promise<void> {
    await execute('UPDATE users SET suspended = 0, suspended_at = NULL, suspended_reason = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]);
  }
}
