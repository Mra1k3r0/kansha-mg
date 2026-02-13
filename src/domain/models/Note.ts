/**
 * Note Domain Model
 */

export type Visibility = 'private' | 'unlisted' | 'public';

export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  savedAt: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Note {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  folderId: string | null;
  visibility: Visibility;
  password?: string;
  shareUrl?: string;
  shortId?: string;
  expiresAt?: string;
  views?: number;
  versions: NoteVersion[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  originalFolderId?: string | null;
  originalPinned?: boolean;
  originalFavorite?: boolean;
}

export interface CreateNoteDTO {
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  folderId?: string | null;
  visibility?: Visibility;
  password?: string;
}

export interface UpdateNoteDTO {
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  folderId?: string | null;
  visibility?: Visibility;
  password?: string;
  shareUrl?: string;
  shortId?: string;
  expiresAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  originalFolderId?: string | null;
  originalPinned?: boolean;
  originalFavorite?: boolean;
}
