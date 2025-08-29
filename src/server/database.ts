import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'track-money.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initialize();
  }

  private async initialize() {
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT DEFAULT 'default',
          amount REAL NOT NULL,
          description TEXT NOT NULL,
          merchant_name TEXT,
          date DATETIME NOT NULL,
          category_id TEXT,
          original_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      -- Statements table
      CREATE TABLE IF NOT EXISTS statements (
          id TEXT PRIMARY KEY,
          user_id TEXT DEFAULT 'default',
          file_name TEXT NOT NULL,
          transaction_count INTEGER DEFAULT 0,
          total_amount REAL DEFAULT 0,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default categories
      INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES
      ('groceries', 'Groceries', '#10B981', '🛒'),
      ('restaurants', 'Restaurants', '#F59E0B', '🍽️'),
      ('gas', 'Gas & Fuel', '#EF4444', '⛽'),
      ('shopping', 'Shopping', '#8B5CF6', '🛍️'),
      ('utilities', 'Utilities', '#06B6D4', '🔌'),
      ('entertainment', 'Entertainment', '#EC4899', '🎬'),
      ('healthcare', 'Healthcare', '#14B8A6', '🏥'),
      ('transport', 'Transportation', '#F97316', '🚗'),
      ('travel', 'Travel', '#3B82F6', '✈️'),
      ('other', 'Other', '#6B7280', '📦');
    `;

    return new Promise<void>((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Database initialization error:', err);
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  merchant_name?: string;
  date: string;
  category_id?: string;
  original_text?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface Statement {
  id: string;
  user_id: string;
  file_name: string;
  transaction_count: number;
  total_amount: number;
  processed_at: string;
}

// Singleton instance
let db: Database | null = null;

export function getDatabase(): Database {
  if (!db) {
    db = new Database();
  }
  return db;
}