/**
 * Folder Domain Model
 */

export interface Folder {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface CreateFolderDTO {
  name: string;
  color: string;
}

export interface UpdateFolderDTO {
  name?: string;
  color?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}
