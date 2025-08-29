import { Pool } from 'pg';

// Database connection
let pool: Pool;

export const initializePostgresDB = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use Supabase PostgreSQL
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  } else {
    // Development: Use local PostgreSQL
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'track_money_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });
  }
  
  return pool;
};

// Database initialization for PostgreSQL
export const initializeDatabase = async () => {
  if (!pool) {
    pool = initializePostgresDB();
  }
  
  const client = await pool.connect();
  
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'credit_card',
        last_four TEXT,
        bank_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        merchant_name TEXT,
        date TIMESTAMP NOT NULL,
        category_id TEXT,
        source_id TEXT,
        original_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES sources (id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT,
        source_id TEXT,
        transactions_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processing',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        error_message TEXT,
        FOREIGN KEY (source_id) REFERENCES sources (id)
      )
    `);

    // Insert default categories
    const categories = [
      ['groceries', 'Groceries', '#10B981', '🛒'],
      ['restaurants', 'Restaurants', '#F59E0B', '🍽️'],
      ['gas', 'Gas & Fuel', '#EF4444', '⛽'],
      ['shopping', 'Shopping', '#8B5CF6', '🛍️'],
      ['utilities', 'Utilities', '#06B6D4', '🔌'],
      ['entertainment', 'Entertainment', '#EC4899', '🎬'],
      ['healthcare', 'Healthcare', '#14B8A6', '🏥'],
      ['transport', 'Transportation', '#F97316', '🚗'],
      ['travel', 'Travel', '#3B82F6', '✈️'],
      ['fitness', 'Fitness & Gym', '#16A34A', '💪'],
      ['education', 'Education', '#7C3AED', '📚'],
      ['subscriptions', 'Subscriptions', '#DC2626', '📱'],
      ['bills', 'Bills & Insurance', '#0891B2', '📋'],
      ['personal_care', 'Personal Care', '#BE185D', '💄'],
      ['home_garden', 'Home & Garden', '#059669', '🏠'],
      ['other', 'Other', '#6B7280', '📦']
    ];

    for (const [id, name, color, icon] of categories) {
      await client.query(
        'INSERT INTO categories (id, name, color, icon) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [id, name, color, icon]
      );
    }

    // Insert default sources
    const defaultSources = [
      ['default_credit_card', 'Default Credit Card', 'credit_card', null, null],
      ['default_bank_account', 'Default Bank Account', 'bank_account', null, null]
    ];

    for (const [id, name, type, lastFour, bankName] of defaultSources) {
      await client.query(
        'INSERT INTO sources (id, name, type, last_four, bank_name) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING',
        [id, name, type, lastFour, bankName]
      );
    }

    console.log('PostgreSQL Database initialized with categories and default sources');
  } catch (error) {
    console.error('PostgreSQL Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
  if (!pool) {
    pool = initializePostgresDB();
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

// Export the pool for direct access if needed
export const getPool = () => {
  if (!pool) {
    pool = initializePostgresDB();
  }
  return pool;
};