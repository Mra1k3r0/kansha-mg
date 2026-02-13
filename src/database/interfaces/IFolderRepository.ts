/**
 * Folder Repository Interface
 */

import type { Folder, CreateFolderDTO, UpdateFolderDTO } from '../../domain/models/Folder.js';
import type { IRepository, QueryOptions, PaginatedResult } from './IRepository.js';

export interface FolderQueryOptions extends QueryOptions {
  ownerId?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export interface IFolderRepository extends IRepository<Folder, CreateFolderDTO & { ownerId: string }, UpdateFolderDTO> {
  findByOwnerId(ownerId: string, options?: FolderQueryOptions): Promise<Folder[]>;
  findWithFilter(options: FolderQueryOptions): Promise<PaginatedResult<Folder>>;
  upsert(id: string, ownerId: string, data: Partial<Folder>): Promise<Folder>;
  bulkUpsert(folders: Array<Partial<Folder> & { id: string; ownerId: string }>): Promise<number>;
  softDelete(folderId: string, ownerId: string): Promise<void>;
  restore(folderId: string, ownerId: string): Promise<void>;
  permanentDelete(folderId: string, ownerId: string): Promise<boolean>;
  deleteByOwnerId(ownerId: string): Promise<number>;
}
