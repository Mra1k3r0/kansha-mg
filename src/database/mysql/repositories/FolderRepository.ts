/**
 * MySQL Folder Repository Implementation
 * Implements IFolderRepository for MySQL database
 */

import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';
import type { IFolderRepository, FolderQueryOptions } from '../../interfaces/IFolderRepository.js';
import type { PaginatedResult, QueryOptions } from '../../interfaces/IRepository.js';
import type { Folder, CreateFolderDTO, UpdateFolderDTO } from '../../../domain/models/Folder.js';
import { query, execute, withTransaction } from '../connection.js';

interface FolderRow extends RowDataPacket {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string | null;
  is_deleted: number;
  deleted_at: string | null;
}

function rowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at || undefined,
  };
}

export class FolderRepository implements IFolderRepository {
  async findById(id: string): Promise<Folder | null> {
    const rows = await query<FolderRow[]>(
      'SELECT * FROM folders WHERE id = ? LIMIT 1',
      [id]
    );
    return rows.length > 0 ? rowToFolder(rows[0]) : null;
  }

  async findByOwnerId(ownerId: string, options?: FolderQueryOptions): Promise<Folder[]> {
    const conditions: string[] = ['owner_id = ?'];
    const params: unknown[] = [ownerId];

    if (options?.onlyDeleted) {
      conditions.push('is_deleted = 1');
    } else if (!options?.includeDeleted) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    const orderBy = options?.orderBy || 'created_at';
    const orderDir = options?.orderDirection || 'DESC';

    const rows = await query<FolderRow[]>(
      `SELECT * FROM folders WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} ${orderDir}`,
      params
    );

    return rows.map(rowToFolder);
  }

  async findAll(options?: QueryOptions): Promise<PaginatedResult<Folder>> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const orderBy = options?.orderBy || 'created_at';
    const orderDir = options?.orderDirection || 'DESC';

    const [rows, countResult] = await Promise.all([
      query<FolderRow[]>(
        `SELECT * FROM folders WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
        [limit, offset]
      ),
      query<RowDataPacket[]>('SELECT COUNT(*) as total FROM folders WHERE (is_deleted = 0 OR is_deleted IS NULL)'),
    ]);

    return {
      data: rows.map(rowToFolder),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async findWithFilter(options: FolderQueryOptions): Promise<PaginatedResult<Folder>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const orderBy = options.orderBy || 'created_at';
    const orderDir = options.orderDirection || 'DESC';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.ownerId) {
      conditions.push('owner_id = ?');
      params.push(options.ownerId);
    }

    if (options.onlyDeleted) {
      conditions.push('is_deleted = 1');
    } else if (!options.includeDeleted) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countResult] = await Promise.all([
      query<FolderRow[]>(
        `SELECT * FROM folders ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM folders ${whereClause}`,
        params
      ),
    ]);

    return {
      data: rows.map(rowToFolder),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async create(data: CreateFolderDTO & { ownerId: string }): Promise<Folder> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO folders (id, owner_id, name, color, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.ownerId, data.name, data.color, now, now, 0]
    );

    return this.findById(id) as Promise<Folder>;
  }

  async update(id: string, data: UpdateFolderDTO): Promise<Folder | null> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.isDeleted !== undefined) {
      updates.push('is_deleted = ?');
      params.push(data.isDeleted ? 1 : 0);
    }
    if (data.deletedAt !== undefined) {
      updates.push('deleted_at = ?');
      params.push(data.deletedAt);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await execute(
      `UPDATE folders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM folders WHERE id = ?', [id]);
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM folders ${whereClause}`,
      params
    );

    return (result[0] as { total: number }).total;
  }

  async upsert(id: string, ownerId: string, data: Partial<Folder>): Promise<Folder> {
    const existing = await query<FolderRow[]>(
      'SELECT id FROM folders WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );

    if (existing.length > 0) {
      await this.update(id, data);
    } else {
      const now = new Date().toISOString();
      await execute(
        `INSERT INTO folders (id, owner_id, name, color, created_at, updated_at, is_deleted, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ownerId,
          data.name || '',
          data.color || '#808080',
          data.createdAt || now,
          data.updatedAt || now,
          data.isDeleted ? 1 : 0,
          data.deletedAt || null,
        ]
      );
    }

    return this.findById(id) as Promise<Folder>;
  }

  async bulkUpsert(folders: Array<Partial<Folder> & { id: string; ownerId: string }>): Promise<number> {
    let count = 0;
    
    await withTransaction(async () => {
      for (const folder of folders) {
        await this.upsert(folder.id, folder.ownerId, folder);
        count++;
      }
    });

    return count;
  }

  async softDelete(folderId: string, ownerId: string): Promise<void> {
    await execute(
      `UPDATE folders SET is_deleted = 1, deleted_at = ?, updated_at = ? 
       WHERE id = ? AND owner_id = ?`,
      [new Date().toISOString(), new Date().toISOString(), folderId, ownerId]
    );
  }

  async restore(folderId: string, ownerId: string): Promise<void> {
    await execute(
      `UPDATE folders SET is_deleted = 0, deleted_at = NULL, updated_at = ? 
       WHERE id = ? AND owner_id = ?`,
      [new Date().toISOString(), folderId, ownerId]
    );
  }

  async permanentDelete(folderId: string, ownerId: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM folders WHERE id = ? AND owner_id = ?',
      [folderId, ownerId]
    );
    return result.affectedRows > 0;
  }

  async deleteByOwnerId(ownerId: string): Promise<number> {
    const result = await execute(
      'DELETE FROM folders WHERE owner_id = ?',
      [ownerId]
    );
    return result.affectedRows;
  }
}
