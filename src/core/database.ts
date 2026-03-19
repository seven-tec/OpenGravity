import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Message, LongTermMemory } from '../types/index.js';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    try {
      const dbDir = dirname(dbPath);
      mkdirSync(dbDir, { recursive: true });
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.initTables();
    } catch (error) {
      console.error(`❌ [Database] Failed to initialize database at ${dbPath}:`, (error as Error).message);
      throw error;
    }
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        tool_calls TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS long_term_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_memory_user ON long_term_memory(user_id);
    `);
  }

  async initialize(): Promise<void> {
    // Already handled in constructor, but kept for compatibility if needed
    console.log('📦 [Database] Schema and directory verified');
  }

  addMessage(userId: string, role: Message['role'], content: string, toolCalls?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO messages (user_id, role, content, tool_calls)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, role, content, toolCalls ?? null);
    return result.lastInsertRowid as number;
  }

  getRecentMessages(userId: string, limit: number): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, role, content, tool_calls as toolCalls, 
             created_at as createdAt
      FROM messages
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as Message[];
  }

  searchMessages(query: string, limit: number, userId?: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, role, content, tool_calls as toolCalls, 
             created_at as createdAt
      FROM messages
      WHERE (? = '' OR content LIKE ?)
      ${userId ? 'AND user_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const searchTerm = `%${query}%`;
    return userId 
      ? stmt.all(query, searchTerm, userId, limit) as Message[]
      : stmt.all(query, searchTerm, limit) as Message[];
  }

  getMemory(userId: string, key: string): LongTermMemory | null {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, key, value, importance,
             created_at as createdAt, updated_at as updatedAt
      FROM long_term_memory
      WHERE user_id = ? AND key = ?
    `);
    return stmt.get(userId, key) as LongTermMemory | null;
  }

  setMemory(userId: string, key: string, value: string, importance = 1): void {
    const stmt = this.db.prepare(`
      INSERT INTO long_term_memory (user_id, key, value, importance)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        importance = excluded.importance,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, key, value, importance);
  }

  searchMemory(userId: string, query: string): LongTermMemory[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id as userId, key, value, importance,
             created_at as createdAt, updated_at as updatedAt
      FROM long_term_memory
      WHERE user_id = ? AND (key LIKE ? OR value LIKE ?)
      ORDER BY importance DESC, updated_at DESC
    `);
    const searchTerm = `%${query}%`;
    return stmt.all(userId, searchTerm, searchTerm) as LongTermMemory[];
  }

  clearOldMessages(userId: string, keepLast: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM messages
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
    `);
    stmt.run(userId, userId, keepLast);
  }

  close(): void {
    this.db.close();
  }
}
