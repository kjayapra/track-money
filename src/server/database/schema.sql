-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('credit', 'debit')) NOT NULL,
    last_four_digits TEXT NOT NULL,
    bank TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    date DATETIME NOT NULL,
    category_id TEXT,
    merchant_name TEXT,
    merchant_category TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    tags TEXT, -- JSON array as string
    notes TEXT,
    confidence REAL,
    is_verified BOOLEAN DEFAULT FALSE,
    original_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount REAL NOT NULL,
    period TEXT CHECK(period IN ('monthly', 'quarterly', 'yearly')) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

-- Spending insights table
CREATE TABLE IF NOT EXISTS spending_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('anomaly', 'trend', 'budget_alert', 'recommendation')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    data TEXT, -- JSON data as string
    severity TEXT CHECK(severity IN ('low', 'medium', 'high')) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Statements table
CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT CHECK(file_type IN ('pdf', 'csv', 'xlsx')) NOT NULL,
    statement_date DATETIME NOT NULL,
    transaction_count INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'error')) DEFAULT 'pending',
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);

-- Email reports table
CREATE TABLE IF NOT EXISTS email_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('monthly', 'quarterly')) NOT NULL,
    report_date DATETIME NOT NULL,
    data TEXT, -- JSON data as string
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    context TEXT, -- JSON data as string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_spending_insights_user ON spending_insights(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_budgets_user_category ON budgets(user_id, category_id);

-- Insert default categories
INSERT OR IGNORE INTO categories (id, name, color, icon, is_system) VALUES
('cat_groceries', 'Groceries', '#10B981', '🛒', TRUE),
('cat_restaurants', 'Restaurants', '#F59E0B', '🍽️', TRUE),
('cat_gas', 'Gas & Fuel', '#EF4444', '⛽', TRUE),
('cat_shopping', 'Shopping', '#8B5CF6', '🛍️', TRUE),
('cat_utilities', 'Utilities', '#06B6D4', '🔌', TRUE),
('cat_entertainment', 'Entertainment', '#EC4899', '🎬', TRUE),
('cat_healthcare', 'Healthcare', '#14B8A6', '🏥', TRUE),
('cat_transport', 'Transportation', '#F97316', '🚗', TRUE),
('cat_travel', 'Travel', '#3B82F6', '✈️', TRUE),
('cat_insurance', 'Insurance', '#6366F1', '🛡️', TRUE),
('cat_education', 'Education', '#84CC16', '📚', TRUE),
('cat_subscriptions', 'Subscriptions', '#A855F7', '📱', TRUE),
('cat_other', 'Other', '#6B7280', '📦', TRUE);