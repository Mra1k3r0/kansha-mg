/**
 * Base Repository Interface
 * Generic CRUD operations that all repositories must implement
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Generic repository interface
 * All entity repositories extend this base interface
 */
export interface IRepository<T, CreateDTO, UpdateDTO> {
  /**
   * Find entity by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find all entities with optional pagination
   */
  findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Create a new entity
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: string, data: UpdateDTO): Promise<T | null>;

  /**
   * Delete an entity by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count total entities
   */
  count(filter?: Record<string, unknown>): Promise<number>;
}
