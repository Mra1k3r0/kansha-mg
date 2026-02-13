/**
 * User Domain Model
 */

export type UserRole = 'admin' | 'moderator' | 'user';
export type HashAlgorithm = 'sha256' | 'pbkdf2';
export type Permission = string;

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  hashAlgorithm: HashAlgorithm;
  name: string;
  role: UserRole;
  permissions: Permission[];
  suspended: boolean;
  suspendedAt?: string;
  suspendedReason?: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  notesUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  username?: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  name?: string;
  username?: string;
  email?: string;
  role?: UserRole;
  permissions?: Permission[];
  suspended?: boolean;
  suspendedReason?: string;
}
