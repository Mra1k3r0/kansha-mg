/**
 * Note Repository Interface
 */

import type { Note, CreateNoteDTO, UpdateNoteDTO, NoteVersion, Comment } from '../../domain/models/Note.js';
import type { IRepository, QueryOptions, PaginatedResult } from './IRepository.js';

export interface NoteQueryOptions extends QueryOptions {
  ownerId?: string;
  folderId?: string | null;
  tags?: string[];
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  visibility?: string;
}

export interface INoteRepository extends IRepository<Note, CreateNoteDTO & { ownerId: string }, UpdateNoteDTO> {
  findByOwnerId(ownerId: string, options?: NoteQueryOptions): Promise<Note[]>;
  findByShortId(shortId: string): Promise<Note | null>;
  findWithFilter(options: NoteQueryOptions): Promise<PaginatedResult<Note>>;
  upsert(id: string, ownerId: string, data: Partial<Note>): Promise<Note>;
  bulkUpsert(notes: Array<Partial<Note> & { id: string; ownerId: string }>): Promise<number>;
  addVersion(noteId: string, version: NoteVersion): Promise<void>;
  addComment(noteId: string, comment: Comment): Promise<void>;
  incrementViews(noteId: string): Promise<void>;
  softDelete(noteId: string, ownerId: string): Promise<void>;
  restore(noteId: string, ownerId: string): Promise<void>;
  permanentDelete(noteId: string, ownerId: string): Promise<boolean>;
  deleteByOwnerId(ownerId: string): Promise<number>;
  updateFolderReference(folderId: string, ownerId: string, newFolderId: string | null): Promise<number>;
}
