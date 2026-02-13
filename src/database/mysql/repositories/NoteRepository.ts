/**
 * MySQL Note Repository Implementation
 * Implements INoteRepository for MySQL database
 */

import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';
import type { INoteRepository, NoteQueryOptions } from '../../interfaces/INoteRepository.js';
import type { PaginatedResult, QueryOptions } from '../../interfaces/IRepository.js';
import type { 
  Note, 
  CreateNoteDTO, 
  UpdateNoteDTO, 
  NoteVersion, 
  Comment,
  Visibility 
} from '../../../domain/models/Note.js';
import { query, execute } from '../connection.js';

interface NoteRow extends RowDataPacket {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  tags: string;
  pinned: number;
  favorite: number;
  folder_id: string | null;
  visibility: Visibility;
  password: string | null;
  share_url: string | null;
  short_id: string | null;
  expires_at: string | null;
  views: number;
  versions: string;
  comments: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  deleted_at: string | null;
  original_folder_id: string | null;
  original_pinned: number | null;
  original_favorite: number | null;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    pinned: Boolean(row.pinned),
    favorite: Boolean(row.favorite),
    folderId: row.folder_id,
    visibility: row.visibility,
    password: row.password || undefined,
    shareUrl: row.share_url || undefined,
    shortId: row.short_id || undefined,
    expiresAt: row.expires_at || undefined,
    views: row.views || 0,
    versions: row.versions ? JSON.parse(row.versions) : [],
    comments: row.comments ? JSON.parse(row.comments) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at || undefined,
    originalFolderId: row.original_folder_id,
    originalPinned: row.original_pinned !== null ? Boolean(row.original_pinned) : undefined,
    originalFavorite: row.original_favorite !== null ? Boolean(row.original_favorite) : undefined,
  };
}

export class NoteRepository implements INoteRepository {
  async findById(id: string): Promise<Note | null> {
    const rows = await query<NoteRow[]>(
      'SELECT * FROM notes WHERE id = ? LIMIT 1',
      [id]
    );
    return rows.length > 0 ? rowToNote(rows[0]) : null;
  }

  async findByOwnerId(ownerId: string, options?: NoteQueryOptions): Promise<Note[]> {
    const conditions: string[] = ['owner_id = ?'];
    const params: unknown[] = [ownerId];

    if (options?.onlyDeleted) {
      conditions.push('is_deleted = 1');
    } else if (!options?.includeDeleted) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }

    if (options?.folderId !== undefined) {
      if (options.folderId === null) {
        conditions.push('folder_id IS NULL');
      } else {
        conditions.push('folder_id = ?');
        params.push(options.folderId);
      }
    }

    if (options?.visibility) {
      conditions.push('visibility = ?');
      params.push(options.visibility);
    }

    const orderBy = options?.orderBy || 'updated_at';
    const orderDir = options?.orderDirection || 'DESC';

    const rows = await query<NoteRow[]>(
      `SELECT * FROM notes WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} ${orderDir}`,
      params
    );

    return rows.map(rowToNote);
  }

  async findByShortId(shortId: string): Promise<Note | null> {
    const rows = await query<NoteRow[]>(
      'SELECT * FROM notes WHERE short_id = ? LIMIT 1',
      [shortId]
    );
    return rows.length > 0 ? rowToNote(rows[0]) : null;
  }

  async findAll(options?: QueryOptions): Promise<PaginatedResult<Note>> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const orderBy = options?.orderBy || 'updated_at';
    const orderDir = options?.orderDirection || 'DESC';

    const [rows, countResult] = await Promise.all([
      query<NoteRow[]>(
        `SELECT * FROM notes WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
        [limit, offset]
      ),
      query<RowDataPacket[]>('SELECT COUNT(*) as total FROM notes WHERE (is_deleted = 0 OR is_deleted IS NULL)'),
    ]);

    return {
      data: rows.map(rowToNote),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async findWithFilter(options: NoteQueryOptions): Promise<PaginatedResult<Note>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const orderBy = options.orderBy || 'updated_at';
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

    if (options.folderId !== undefined) {
      if (options.folderId === null) {
        conditions.push('folder_id IS NULL');
      } else {
        conditions.push('folder_id = ?');
        params.push(options.folderId);
      }
    }

    if (options.visibility) {
      conditions.push('visibility = ?');
      params.push(options.visibility);
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(() => 'JSON_CONTAINS(tags, ?)');
      conditions.push(`(${tagConditions.join(' OR ')})`);
      options.tags.forEach(tag => params.push(JSON.stringify(tag)));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countResult] = await Promise.all([
      query<NoteRow[]>(
        `SELECT * FROM notes ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM notes ${whereClause}`,
        params
      ),
    ]);

    return {
      data: rows.map(rowToNote),
      total: (countResult[0] as { total: number }).total,
      limit,
      offset,
    };
  }

  async create(data: CreateNoteDTO & { ownerId: string }): Promise<Note> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO notes (
        id, owner_id, title, content, tags, pinned, favorite, folder_id,
        visibility, password, created_at, updated_at, versions, comments, views, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.ownerId,
        data.title,
        data.content,
        JSON.stringify(data.tags || []),
        data.pinned ? 1 : 0,
        data.favorite ? 1 : 0,
        data.folderId || null,
        data.visibility || 'private',
        data.password || null,
        now,
        now,
        '[]',
        '[]',
        0,
        0,
      ]
    );

    return this.findById(id) as Promise<Note>;
  }

  async update(id: string, data: UpdateNoteDTO): Promise<Note | null> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.pinned !== undefined) {
      updates.push('pinned = ?');
      params.push(data.pinned ? 1 : 0);
    }
    if (data.favorite !== undefined) {
      updates.push('favorite = ?');
      params.push(data.favorite ? 1 : 0);
    }
    if (data.folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(data.folderId);
    }
    if (data.visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(data.visibility);
    }
    if (data.password !== undefined) {
      updates.push('password = ?');
      params.push(data.password);
    }
    if (data.shareUrl !== undefined) {
      updates.push('share_url = ?');
      params.push(data.shareUrl);
    }
    if (data.shortId !== undefined) {
      updates.push('short_id = ?');
      params.push(data.shortId);
    }
    if (data.expiresAt !== undefined) {
      updates.push('expires_at = ?');
      params.push(data.expiresAt);
    }
    if (data.isDeleted !== undefined) {
      updates.push('is_deleted = ?');
      params.push(data.isDeleted ? 1 : 0);
    }
    if (data.deletedAt !== undefined) {
      updates.push('deleted_at = ?');
      params.push(data.deletedAt);
    }
    if (data.originalFolderId !== undefined) {
      updates.push('original_folder_id = ?');
      params.push(data.originalFolderId);
    }
    if (data.originalPinned !== undefined) {
      updates.push('original_pinned = ?');
      params.push(data.originalPinned ? 1 : 0);
    }
    if (data.originalFavorite !== undefined) {
      updates.push('original_favorite = ?');
      params.push(data.originalFavorite ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await execute(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM notes WHERE id = ?', [id]);
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
      `SELECT COUNT(*) as total FROM notes ${whereClause}`,
      params
    );

    return (result[0] as { total: number }).total;
  }

  async upsert(id: string, ownerId: string, data: Partial<Note>): Promise<Note> {
    const existing = await query<NoteRow[]>(
      'SELECT id FROM notes WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );

    if (existing.length > 0) {
      await this.update(id, data);
    } else {
      const now = new Date().toISOString();
      await execute(
        `INSERT INTO notes (
          id, owner_id, title, content, tags, pinned, favorite, folder_id,
          visibility, password, share_url, short_id, expires_at, views,
          versions, comments, created_at, updated_at, is_deleted,
          deleted_at, original_folder_id, original_pinned, original_favorite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ownerId,
          data.title || '',
          data.content || '',
          JSON.stringify(data.tags || []),
          data.pinned ? 1 : 0,
          data.favorite ? 1 : 0,
          data.folderId || null,
          data.visibility || 'private',
          data.password || null,
          data.shareUrl || null,
          data.shortId || null,
          data.expiresAt || null,
          data.views || 0,
          JSON.stringify(data.versions || []),
          JSON.stringify(data.comments || []),
          data.createdAt || now,
          data.updatedAt || now,
          data.isDeleted ? 1 : 0,
          data.deletedAt || null,
          data.originalFolderId || null,
          data.originalPinned !== undefined ? (data.originalPinned ? 1 : 0) : null,
          data.originalFavorite !== undefined ? (data.originalFavorite ? 1 : 0) : null,
        ]
      );
    }

    return this.findById(id) as Promise<Note>;
  }

  async bulkUpsert(notes: Array<Partial<Note> & { id: string; ownerId: string }>): Promise<number> {
    let count = 0;
    
    // Process each note individually - upserts are idempotent
    // Using Promise.allSettled to continue even if some fail
    const results = await Promise.allSettled(
      notes.map(async (note, index) => {
        try {
          await this.upsert(note.id, note.ownerId, note);
          return 1;
        } catch (error) {
          console.error(`[Notes] Upsert failed for note ${index} (${note.id}):`, error instanceof Error ? error.message : error);
          throw error;
        }
      })
    );

    // Count successful upserts and log failures
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        count++;
      } else {
        console.error(`[Notes] Note ${i} rejected:`, result.reason?.message || result.reason);
      }
    }

    return count;
  }

  async addVersion(noteId: string, version: NoteVersion): Promise<void> {
    const note = await this.findById(noteId);
    if (!note) return;

    const versions = [...note.versions, version];
    await execute(
      'UPDATE notes SET versions = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(versions), new Date().toISOString(), noteId]
    );
  }

  async addComment(noteId: string, comment: Comment): Promise<void> {
    const note = await this.findById(noteId);
    if (!note) return;

    const comments = [...note.comments, comment];
    await execute(
      'UPDATE notes SET comments = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(comments), new Date().toISOString(), noteId]
    );
  }

  async incrementViews(noteId: string): Promise<void> {
    await execute(
      'UPDATE notes SET views = views + 1 WHERE id = ?',
      [noteId]
    );
  }

  async softDelete(noteId: string, ownerId: string): Promise<void> {
    const note = await this.findById(noteId);
    if (!note || note.ownerId !== ownerId) return;

    await execute(
      `UPDATE notes SET 
        is_deleted = 1, 
        deleted_at = ?, 
        original_folder_id = folder_id,
        original_pinned = pinned,
        original_favorite = favorite,
        folder_id = NULL,
        pinned = 0,
        favorite = 0,
        updated_at = ?
      WHERE id = ? AND owner_id = ?`,
      [new Date().toISOString(), new Date().toISOString(), noteId, ownerId]
    );
  }

  async restore(noteId: string, ownerId: string): Promise<void> {
    await execute(
      `UPDATE notes SET 
        is_deleted = 0, 
        deleted_at = NULL,
        folder_id = original_folder_id,
        pinned = COALESCE(original_pinned, 0),
        favorite = COALESCE(original_favorite, 0),
        original_folder_id = NULL,
        original_pinned = NULL,
        original_favorite = NULL,
        updated_at = ?
      WHERE id = ? AND owner_id = ?`,
      [new Date().toISOString(), noteId, ownerId]
    );
  }

  async permanentDelete(noteId: string, ownerId: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, ownerId]
    );
    return result.affectedRows > 0;
  }

  async deleteByOwnerId(ownerId: string): Promise<number> {
    const result = await execute(
      'DELETE FROM notes WHERE owner_id = ?',
      [ownerId]
    );
    return result.affectedRows;
  }

  async updateFolderReference(folderId: string, ownerId: string, newFolderId: string | null): Promise<number> {
    const result = await execute(
      'UPDATE notes SET folder_id = ?, updated_at = ? WHERE folder_id = ? AND owner_id = ?',
      [newFolderId, new Date().toISOString(), folderId, ownerId]
    );
    return result.affectedRows;
  }
}
