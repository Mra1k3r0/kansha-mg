/**
 * MySQL Database Adapter - Simple Gateway
 */

import { getPool, closePool, isConnected, healthCheck, query } from './connection.js';
import { UserRepository } from './repositories/UserRepository.js';
import { NoteRepository } from './repositories/NoteRepository.js';
import { FolderRepository } from './repositories/FolderRepository.js';
import { logger } from '../../utils/logger.js';

export class MySQLAdapter {
  readonly users = new UserRepository();
  readonly notes = new NoteRepository();
  readonly folders = new FolderRepository();

  async connect(): Promise<void> {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('MySQL connected');
  }

  async disconnect(): Promise<void> {
    await closePool();
  }

  isConnected(): boolean {
    return isConnected();
  }

  async healthCheck(): Promise<boolean> {
    return healthCheck();
  }

  async getStatus(): Promise<{ connected: boolean; hasAdminUser: boolean; userCount: number }> {
    const connected = await healthCheck();
    if (!connected) return { connected: false, hasAdminUser: false, userCount: 0 };
    
    const [hasAdmin, userCount] = await Promise.all([
      this.users.hasAdminUser(),
      this.users.count(),
    ]);
    return { connected: true, hasAdminUser: hasAdmin, userCount };
  }

  async migrate(): Promise<void> {
    logger.info('Running MySQL migrations...');
    
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(512) NOT NULL,
        hash_algorithm VARCHAR(20) DEFAULT 'pbkdf2',
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'moderator', 'user') DEFAULT 'user',
        permissions JSON,
        suspended TINYINT(1) DEFAULT 0,
        suspended_at DATETIME NULL,
        suspended_reason TEXT NULL,
        last_login_at DATETIME NULL,
        last_seen_at DATETIME NULL,
        notes_updated_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_email (email),
        INDEX idx_username (username),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR(36) PRIMARY KEY,
        owner_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#808080',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at DATETIME NULL,
        INDEX idx_owner (owner_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS notes (
        id VARCHAR(36) PRIMARY KEY,
        owner_id VARCHAR(36) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content LONGTEXT,
        tags JSON,
        pinned TINYINT(1) DEFAULT 0,
        favorite TINYINT(1) DEFAULT 0,
        folder_id VARCHAR(36) NULL,
        visibility ENUM('private', 'unlisted', 'public') DEFAULT 'private',
        password VARCHAR(255) NULL,
        share_url VARCHAR(500) NULL,
        short_id VARCHAR(10) NULL,
        expires_at DATETIME NULL,
        views INT UNSIGNED DEFAULT 0,
        versions JSON,
        comments JSON,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        is_deleted TINYINT(1) DEFAULT 0,
        deleted_at DATETIME NULL,
        original_folder_id VARCHAR(36) NULL,
        original_pinned TINYINT(1) NULL,
        original_favorite TINYINT(1) NULL,
        INDEX idx_owner (owner_id),
        INDEX idx_folder (folder_id),
        INDEX idx_short_id (short_id),
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        token VARCHAR(64) NOT NULL UNIQUE,
        user_id VARCHAR(36) NOT NULL,
        role VARCHAR(20) NOT NULL,
        cf_token VARCHAR(64) NULL,
        cf_token_created_at DATETIME NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX idx_token (token),
        INDEX idx_user (user_id),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        target_type VARCHAR(20) NOT NULL,
        target_id VARCHAR(36) NULL,
        target_name VARCHAR(255) NULL,
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        timestamp DATETIME NOT NULL,
        INDEX idx_user (user_id),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        guest_id VARCHAR(36) NULL,
        endpoint VARCHAR(500) NOT NULL UNIQUE,
        keys_p256dh VARCHAR(500) NOT NULL,
        keys_auth VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const sql of tables) {
      try {
        await query(sql);
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code !== 'ER_TABLE_EXISTS_ERROR') {
          logger.warn({ error: e }, 'Migration warning');
        }
      }
    }

    logger.info('Migrations complete');
  }

  // Raw query for advanced operations
  async raw<T>(sql: string, params?: unknown[]): Promise<T> {
    return query(sql, params) as Promise<T>;
  }
}

let instance: MySQLAdapter | null = null;

export function getDB(): MySQLAdapter {
  if (!instance) instance = new MySQLAdapter();
  return instance;
}
