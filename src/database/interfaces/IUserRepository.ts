/**
 * User Repository Interface
 */

import type { User, CreateUserDTO, UpdateUserDTO, UserRole } from '../../domain/models/User.js';
import type { IRepository, QueryOptions, PaginatedResult } from './IRepository.js';

export interface UserQueryOptions extends QueryOptions {
  search?: string;
  role?: UserRole;
}

export interface IUserRepository extends IRepository<User, CreateUserDTO, UpdateUserDTO> {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findWithFilter(options: UserQueryOptions): Promise<PaginatedResult<User>>;
  hasAdminUser(): Promise<boolean>;
  updateLastLogin(userId: string): Promise<void>;
  updateLastSeen(userId: string): Promise<void>;
  updateNotesTimestamp(userId: string): Promise<void>;
  updatePasswordHash(userId: string, hash: string, algorithm: string): Promise<void>;
  suspendUser(userId: string, reason?: string): Promise<void>;
  unsuspendUser(userId: string): Promise<void>;
}
