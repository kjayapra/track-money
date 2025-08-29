import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import csv from 'csv-parser';
import { initializeDatabase, query as pgQuery } from './postgres-db.js';
// PDF parsing will be implemented with user's sample file

const app = express();
const PORT = process.env.PORT || 3001; // Server port

// Initialize database (SQLite for dev, PostgreSQL for production)
let db: sqlite3.Database | null = null;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  db = new sqlite3.Database('track-money.db');
}

// Initialize database schema
const initializeDBSchema = async () => {
  if (isProduction) {
    await initializeDatabase();
    return;
  }
  
  if (!db) return;
  
  db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      merchant_name TEXT,
      date DATETIME NOT NULL,
      category_id TEXT,
      source_id TEXT,
      original_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'credit_card',
      last_four TEXT,
      bank_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
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
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
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

  categories.forEach(([id, name, color, icon]) => {
    db.run('INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)', 
      [id, name, color, icon]);
  });

  // Insert default sources
  const defaultSources = [
    ['default_credit_card', 'Default Credit Card', 'credit_card', null, null],
    ['default_bank_account', 'Default Bank Account', 'bank_account', null, null]
  ];

  defaultSources.forEach(([id, name, type, lastFour, bankName]) => {
    db.run('INSERT OR IGNORE INTO sources (id, name, type, last_four, bank_name) VALUES (?, ?, ?, ?, ?)', 
      [id, name, type, lastFour, bankName]);
  });

  // Add source_id columns to existing tables if they don't exist
  db.run('ALTER TABLE transactions ADD COLUMN source_id TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding source_id to transactions:', err);
    }
  });
  
  db.run('ALTER TABLE uploaded_files ADD COLUMN source_id TEXT', (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding source_id to uploaded_files:', err);
    }
  });
  });
};

// Initialize the database
initializeDBSchema().catch(console.error);

// Database query helpers
const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  if (isProduction) {
    const result = await pgQuery(sql, params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('SQLite database not initialized'));
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
};

const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  if (isProduction) {
    const result = await pgQuery(sql, params);
    return result.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('SQLite database not initialized'));
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }
};

const dbRun = async (sql: string, params: any[] = []): Promise<any> => {
  if (isProduction) {
    return await pgQuery(sql, params);
  } else {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('SQLite database not initialized'));
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
};

// Configure multer for file uploads
const upload = multer({ 
  dest: process.env.NODE_ENV === 'production' ? '/tmp' : 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Categorization function
function categorizeTransaction(description: string, merchantName?: string): string {
  const text = (description + ' ' + (merchantName || '')).toLowerCase();
  
  const rules = [
    // Subscription services (check first to catch recurring payments)
    { categoryId: 'subscriptions', keywords: ['netflix', 'spotify', 'apple music', 'youtube premium', 'disney+', 'hulu', 'amazon prime', 'subscription', 'claude.ai', 'anthropic', 'openai', 'gpt', 'notion', 'slack', 'zoom', 'adobe', 'microsoft', 'office 365', 'google one', 'dropbox', 'icloud'] },
    
    // Fitness & Health
    { categoryId: 'fitness', keywords: ['gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'planet fitness', 'la fitness', 'equinox', '24 hour fitness', 'bintang badminton', 'badminton', 'sports club', 'tennis', 'swimming', 'martial arts'] },
    
    // Education
    { categoryId: 'education', keywords: ['udemy', 'coursera', 'khan academy', 'skillshare', 'pluralsight', 'linkedin learning', 'education', 'tuition', 'school', 'university', 'college', 'textbook', 'course', 'training', 'certification', 'interviewing.io', 'hellointerview'] },
    
    // Personal Care & Beauty
    { categoryId: 'personal_care', keywords: ['salon', 'spa', 'barber', 'haircut', 'massage', 'manicure', 'pedicure', 'facial', 'beauty', 'cosmetics', 'skincare', 'footlax', 'kashish salon'] },
    
    // Bills & Insurance
    { categoryId: 'bills', keywords: ['insurance', 'phone bill', 'internet', 'cable', 'wireless', 'verizon', 'at&t', 'comcast', 'xfinity', 'mortgage', 'rent', 'hoa', 'property tax'] },
    
    // Home & Garden
    { categoryId: 'home_garden', keywords: ['home depot', 'lowes', 'ikea', 'furniture', 'appliances', 'garden', 'hardware', 'home improvement', 'decor'] },
    
    // Groceries
    { categoryId: 'groceries', keywords: ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'safeway', 'apni mandi', 'mandi', 'trader joe', 'whole foods', 'kroger', 'new india bazar'] },
    
    // Restaurants & Food
    { categoryId: 'restaurants', keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'starbucks', 'mcdonald', 'biryani', 'indian', 'namaste', 'paradise', 'mylapore', 'jollibee', 'doordash', 'tst*', 'sq *', 'dd *', 'uber eats', 'grubhub', 'postmates', 'food delivery', 'kitchen', 'cuisine', 'hungry bear', 'chick-fil-a'] },
    
    // Gas & Fuel
    { categoryId: 'gas', keywords: ['gas', 'fuel', 'shell', 'exxon', 'chevron', 'bp', 'valero', 'electrify america'] },
    
    // Shopping (general retail)
    { categoryId: 'shopping', keywords: ['amazon', 'ebay', 'shop', 'store', 'retail', 'mktpl', 'marketplace', 'mall', 'clothing', 'fashion', 'shoes', 'electronics', 'flavcity'] },
    
    // Utilities
    { categoryId: 'utilities', keywords: ['electric', 'water', 'utility', 'power', 'pge', 'sdge', 'gas company'] },
    
    // Transportation
    { categoryId: 'transport', keywords: ['uber', 'lyft', 'taxi', 'bus', 'parking', 'metro', 'clipper', 'bart', 'caltrain', 'bridge toll', 'monterey parking'] },
    
    // Entertainment
    { categoryId: 'entertainment', keywords: ['movie', 'theater', 'cinema', 'concert', 'show', 'ticket', 'entertainment', 'mystery spot', 'amusement', 'park'] },
    
    // Healthcare
    { categoryId: 'healthcare', keywords: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical', 'dentist', 'vision', 'health'] },
    
    // Travel
    { categoryId: 'travel', keywords: ['hotel', 'flight', 'airline', 'airbnb', 'booking', 'expedia', 'travel', 'vacation', 'resort', 'lodge', 'ynp', 'curry village', 'degnans', 'basecamp eatery'] }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.categoryId;
    }
  }

  return 'other';
}

// Parse date function
function parseDate(dateStr: string): Date | null {
  try {
    const cleanDate = dateStr.replace(/[^\d\/\-]/g, '');
    
    const formats = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{4})-(\d{2})-(\d{2})$/,
      /^(\d{1,2})\/(\d{1,2})$/
    ];

    for (const format of formats) {
      const match = cleanDate.match(format);
      if (match) {
        if (format === formats[2]) {
          const currentYear = new Date().getFullYear();
          return new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (format === formats[1]) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else {
          return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        }
      }
    }
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
  } catch (error) {
    return null;
  }
  return null;
}

// Parse amount function
function parseAmount(amountStr: string): number {
  try {
    const cleanAmount = amountStr.replace(/[$,\s]/g, '');
    if (cleanAmount.includes('(') && cleanAmount.includes(')')) {
      const number = parseFloat(cleanAmount.replace(/[()]/g, ''));
      return isNaN(number) ? NaN : -Math.abs(number);
    }
    const number = parseFloat(cleanAmount);
    return isNaN(number) ? NaN : number;
  } catch (error) {
    return NaN;
  }
}

// CSV parsing function
async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve) => {
    const transactions: any[] = [];
    const rows: any[] = [];
    let hasHeaders = false;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        // Detect if file has headers by checking first row
        if (rows.length > 0) {
          const firstRow = rows[0];
          const keys = Object.keys(firstRow);
          
          // Check if first row looks like headers (contains common header terms)
          hasHeaders = keys.some(key => 
            /date|description|amount|transaction|debit|credit|name|memo/i.test(key) ||
            /date|description|amount|transaction|debit|credit|name|memo/i.test(firstRow[key])
          );
          
          // If no headers detected, try to parse as positional data
          if (!hasHeaders) {
            console.log('No headers detected, attempting positional parsing');
            parseRowsWithoutHeaders(rows, transactions);
          } else {
            console.log('Headers detected, using standard parsing');
            parseRowsWithHeaders(rows, transactions);
          }
        }
        
        console.log(`Parsed ${transactions.length} transactions from CSV`);
        resolve(transactions);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        resolve([]);
      });
  });
}

// Parse rows when headers are present
function parseRowsWithHeaders(rows: any[], transactions: any[]) {
  rows.forEach((row) => {
        try {
          const dateFields = ['Date', 'Transaction Date', 'Posted Date', 'date'];
          const descriptionFields = ['Description', 'Merchant', 'Transaction Description', 'description'];
          const amountFields = ['Amount', 'Transaction Amount', 'Debit', 'Credit', 'amount'];

          let date: Date | null = null;
          let description = '';
          let amount = 0;

          // Find date - expanded field list
          const allDateFields = [...dateFields, 'Transaction Date', 'Posted Date'];
          for (const field of allDateFields) {
            if (row[field]) {
              date = parseDate(row[field]);
              if (date) break;
            }
          }

          // Find description - check Name field first, then other fields
          const allDescriptionFields = ['Name', ...descriptionFields, 'Transaction'];
          for (const field of allDescriptionFields) {
            if (row[field] && String(row[field]).trim()) {
              description = String(row[field]).trim();
              break;
            }
          }

          // Find amount - handle Debit/Credit columns separately
          if (row['Debit'] && row['Debit'] !== '') {
            amount = -Math.abs(parseAmount(String(row['Debit'])));
          } else if (row['Credit'] && row['Credit'] !== '') {
            amount = Math.abs(parseAmount(String(row['Credit'])));
          } else {
            // Fallback to other amount fields
            for (const field of amountFields) {
              if (row[field]) {
                const parsedAmount = parseAmount(String(row[field]));
                if (!isNaN(parsedAmount) && parsedAmount !== 0) {
                  amount = parsedAmount;
                  break;
                }
              }
            }
          }

          if (date && description && amount !== 0) {
            // Extract additional fields from the row
            const transactionType = row['Transaction'] || (amount < 0 ? 'DEBIT' : 'CREDIT');
            const memo = row['Memo'] || '';
            const location = extractLocation(description);
            const referenceId = extractReferenceId(memo);
            
            // Check for card number in the CSV data itself
            const csvCardNumber = row['Card No.'] || row['Card'] || row['CardNumber'];
            
            transactions.push({
              date,
              description,
              amount,
              originalText: JSON.stringify(row),
              merchantName: description.split(' ').slice(0, 3).join(' '),
              transactionType,
              memo,
              location,
              referenceId,
              csvCardNumber
            });
          }
        } catch (error) {
          console.error('Error parsing CSV row:', error);
        }
      });
}

// Parse rows when no headers are present (positional data)
function parseRowsWithoutHeaders(rows: any[], transactions: any[]) {
  rows.forEach((row) => {
    try {
      const values = Object.values(row);
      
      // Common patterns for CSV without headers:
      // Pattern 1: Date, Amount, ?, ?, Description (like CreditCard2.csv)
      if (values.length >= 5) {
        const dateStr = String(values[0]).replace(/"/g, '');
        const amountStr = String(values[1]).replace(/"/g, '');
        const description = String(values[4]).replace(/"/g, '');
        
        const date = parseDate(dateStr);
        const amount = parseAmount(amountStr);
        
        if (date && description && !isNaN(amount) && amount !== 0) {
          transactions.push({
            date,
            description,
            amount,
            originalText: JSON.stringify(row),
            merchantName: description.split(' ').slice(0, 3).join(' '),
            transactionType: amount < 0 ? 'DEBIT' : 'CREDIT',
            memo: '',
            location: extractLocation(description),
            referenceId: '',
            csvCardNumber: null
          });
        }
      }
    } catch (error) {
      console.error('Error parsing CSV row without headers:', error);
    }
  });
}

// PDF parsing function
// Try to convert user's PDF to CSV format for testing
async function parsePDF(_filePath: string): Promise<any[]> {
  try {
    // Copy user's PDF to analyze it
    const userPdfPath = path.join(__dirname, '../../uploads/sample-file');
    
    if (fs.existsSync(userPdfPath)) {
      console.log('Found user PDF file, attempting to parse...');
      // For now, return empty array but log that we found the file
      console.log('PDF file detected but parsing not implemented yet - please convert to CSV format');
      console.log('Example CSV format:');
      console.log('Date,Description,Amount');
      console.log('07/28/2024,Walmart Supercenter,-89.45');
      console.log('07/27/2024,Shell Gas Station,-45.67');
      return [];
    }
    
    return [];
  } catch (error) {
    console.error('PDF parsing error:', error);
    return [];
  }
}

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running!' });
});

// Sources API endpoints
app.get('/api/sources', async (_req, res) => {
  try {
    const sources = await dbAll('SELECT * FROM sources ORDER BY created_at DESC');
    res.json({ sources });
  } catch (err) {
    console.error('Error fetching sources:', err);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

app.post('/api/sources', async (req, res) => {
  try {
    const { name, type, lastFour, bankName } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await dbRun(
      'INSERT INTO sources (id, name, type, last_four, bank_name) VALUES (?, ?, ?, ?, ?)',
      [id, name, type, lastFour, bankName]
    );
    
    const source = await dbGet('SELECT * FROM sources WHERE id = ?', [id]);
    res.status(201).json({ source });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed') || err.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'Source with this name already exists' });
    }
    console.error('Error creating source:', err);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  let response = "I can help you understand your financial data. ";
  
  if (message.toLowerCase().includes('spending')) {
    response = "Based on your uploaded data, I can see your spending patterns. Upload a statement to get detailed analysis!";
  } else if (message.toLowerCase().includes('budget')) {
    response = "I can help you analyze your spending categories and suggest budget improvements. Upload your statements first!";
  } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
    response = "Hello! I'm your financial assistant. Upload a credit card statement and I'll analyze your spending patterns!";
  }
  
  res.json({ response });
});

// Extract card info from filename (legacy function - no longer used)
// function extractCardInfo(filename: string) {
//   // Extract card number (e.g., "Credit Card - 4150" -> "4150")
//   const cardMatch = filename.match(/(?:card|credit).*?(\d{4})/i);
//   const cardNumber = cardMatch ? `****${cardMatch[1]}` : null;
//   
//   // Extract statement period from filename
//   const periodMatch = filename.match(/(\d{2}-\d{2}-\d{4}).*?(\d{2}-\d{2}-\d{4})/);
//   const statementPeriod = periodMatch ? `${periodMatch[1]} to ${periodMatch[2]}` : null;
//   
//   return { cardNumber, statementPeriod };
// }

// Extract location from description
function extractLocation(description: string): string | null {
  // Look for common patterns like "MERCHANT NAME CITY STATE"
  const locationMatch = description.match(/([A-Z][A-Z\s]*)\s+([A-Z]{2})$/);
  if (locationMatch) {
    return `${locationMatch[1].trim()}, ${locationMatch[2]}`;
  }
  
  // Look for specific state abbreviations
  const stateMatch = description.match(/\b([A-Z]{2})\s*$/);
  if (stateMatch) {
    return stateMatch[1];
  }
  
  return null;
}

// Extract reference ID from memo field
function extractReferenceId(memo: string): string | null {
  if (!memo) return null;
  
  // Extract the first number sequence from memo (usually the reference)
  const refMatch = memo.match(/(\d{20,})/);
  if (refMatch) {
    return refMatch[1];
  }
  
  return null;
}

// File upload endpoint with real parsing
app.post('/api/upload', upload.single('statement'), async (req, res) => {
  let fileId: string | null = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = file.originalname.toLowerCase();
    console.log(`Processing file: ${file.originalname}`);

    // Create file record in database
    fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const sourceId = req.body.sourceId || req.body.source_id || 'default_credit_card';
    
    await dbRun(`
      INSERT INTO uploaded_files (
        id, filename, original_name, file_size, mime_type, source_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      fileId,
      file.filename,
      file.originalname,
      file.size,
      file.mimetype,
      sourceId,
      'processing'
    ]);

    // Note: Card information is now stored in the source, not extracted from filename

    let transactions: any[] = [];

    // Check file content to determine type
    const fileBuffer = fs.readFileSync(file.path);
    const isPdf = fileBuffer.toString('utf8', 0, 4) === '%PDF';
    const isLikelyCsv = fileName.endsWith('.csv') || fileBuffer.toString('utf8', 0, 100).includes(',');

    if (isLikelyCsv || fileName.endsWith('.csv')) {
      transactions = await parseCSV(file.path);
    } else if (isPdf || fileName.endsWith('.pdf')) {
      transactions = await parsePDF(file.path);
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use CSV or PDF files.' });
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions found in the file' });
    }

    // Store transactions in database with duplicate checking
    let storedCount = 0;
    let duplicateCount = 0;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    for (const tx of transactions) {
      try {
        const categoryId = categorizeTransaction(tx.description, tx.merchantName);
        
        // Check for duplicate transaction
        const row = await dbGet(`
          SELECT COUNT(*) as count FROM transactions 
          WHERE description = ? AND amount = ? AND date = ?
        `, [tx.description, tx.amount, tx.date.toISOString()]);
        const isDuplicate = (row?.count || 0) > 0;

        if (isDuplicate) {
          duplicateCount++;
          console.log(`Skipping duplicate transaction: ${tx.description} - ${tx.amount} on ${tx.date.toISOString()}`);
          continue;
        }

        const id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        await dbRun(`
          INSERT INTO transactions (
            id, amount, description, merchant_name, date, category_id, source_id, original_text
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          tx.amount,
          tx.description,
          tx.merchantName,
          tx.date.toISOString(),
          categoryId,
          sourceId,
          tx.originalText || tx.description
        ]);
        storedCount++;
      } catch (error) {
        console.error('Error storing transaction:', error);
      }
    }

    console.log(`Successfully stored ${storedCount} transactions, skipped ${duplicateCount} duplicates`);

    // Update file record with completion status
    await dbRun(`
      UPDATE uploaded_files SET 
        transactions_count = ?, 
        processed_count = ?, 
        duplicate_count = ?, 
        status = 'completed',
        processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [transactions.length, storedCount, duplicateCount, fileId]);

    // Clean up uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch (error) {
      console.warn('Could not delete uploaded file:', error);
    }

    res.json({
      success: true,
      message: `File processed successfully. ${storedCount} new transactions added${duplicateCount > 0 ? `, ${duplicateCount} duplicates skipped` : ''}`,
      filename: file.originalname,
      transactionCount: storedCount,
      duplicateCount,
      totalAmount,
      fileId,
      preview: transactions.slice(0, 5).map(t => ({
        description: t.description,
        amount: t.amount,
        date: t.date.toISOString().split('T')[0],
        category: categorizeTransaction(t.description, t.merchantName)
      }))
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    
    // Update file record with error status if fileId exists
    if (fileId) {
      try {
        await dbRun(`
          UPDATE uploaded_files SET 
            status = 'failed',
            error_message = ?,
            processed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [(error as Error).message, fileId]);
      } catch (updateError) {
        console.error('Error updating file status:', updateError);
      }
    }
    
    res.status(500).json({ error: 'File processing failed: ' + (error as Error).message });
  }
});

// Get uploaded files endpoint
app.get('/api/uploaded-files', (_req, res) => {
  db.all(`
    SELECT 
      id, 
      original_name, 
      file_size, 
      transactions_count, 
      processed_count, 
      duplicate_count, 
      status, 
      uploaded_at, 
      processed_at, 
      error_message
    FROM uploaded_files 
    ORDER BY uploaded_at DESC 
    LIMIT 20
  `, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Failed to fetch uploaded files' });
    } else {
      res.json({ uploadedFiles: rows });
    }
  });
});

// Recategorize existing transactions endpoint
app.post('/api/recategorize-transactions', async (_req, res) => {
  try {
    console.log('Starting transaction recategorization...');
    
    // Get all transactions
    const transactions = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT id, description, merchant_name, category_id
        FROM transactions
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    let updatedCount = 0;
    let unchangedCount = 0;

    // Recategorize each transaction
    for (const transaction of transactions) {
      const newCategoryId = categorizeTransaction(transaction.description, transaction.merchant_name);
      
      if (newCategoryId !== transaction.category_id) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE transactions SET category_id = ? WHERE id = ?',
            [newCategoryId, transaction.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        updatedCount++;
        console.log(`Updated transaction ${transaction.id}: ${transaction.category_id} -> ${newCategoryId}`);
      } else {
        unchangedCount++;
      }
    }

    console.log(`Recategorization complete: ${updatedCount} updated, ${unchangedCount} unchanged`);
    
    res.json({
      success: true,
      message: `Recategorization complete: ${updatedCount} transactions updated, ${unchangedCount} unchanged`,
      updatedCount,
      unchangedCount,
      totalTransactions: transactions.length
    });

  } catch (error) {
    console.error('Recategorization error:', error);
    res.status(500).json({ error: 'Failed to recategorize transactions: ' + (error as Error).message });
  }
});

// Filter options endpoint - get all unique values for filters
app.get('/api/transactions/filter-options', (_req, res) => {
  // Get all categories
  db.all(`
    SELECT DISTINCT c.id, c.name, c.icon, c.color
    FROM categories c
    INNER JOIN transactions t ON t.category_id = c.id
    ORDER BY c.name
  `, [], (err, categories: any[]) => {
    if (err) {
      console.error('Categories query error:', err);
      return res.status(500).json({ error: 'Failed to load categories' });
    }

    // Get all unique card numbers
    db.all(`
      SELECT DISTINCT card_number
      FROM transactions
      WHERE card_number IS NOT NULL AND card_number != ''
      ORDER BY card_number
    `, [], (err, cardNumbers: any[]) => {
      if (err) {
        console.error('Card numbers query error:', err);
        return res.status(500).json({ error: 'Failed to load card numbers' });
      }

      // Get date range
      db.get(`
        SELECT 
          MIN(date) as minDate,
          MAX(date) as maxDate
        FROM transactions
      `, [], (err, dateRange: any) => {
        if (err) {
          console.error('Date range query error:', err);
          return res.status(500).json({ error: 'Failed to load date range' });
        }

        // Get unique transaction types
        db.all(`
          SELECT DISTINCT transaction_type
          FROM transactions
          WHERE transaction_type IS NOT NULL AND transaction_type != ''
          ORDER BY transaction_type
        `, [], (err, transactionTypes: any[]) => {
          if (err) {
            console.error('Transaction types query error:', err);
            return res.status(500).json({ error: 'Failed to load transaction types' });
          }

          res.json({
            categories: categories || [],
            cardNumbers: (cardNumbers || []).map((c: any) => c.card_number),
            dateRange: dateRange || { minDate: null, maxDate: null },
            transactionTypes: (transactionTypes || []).map((t: any) => t.transaction_type)
          });
        });
      });
    });
  });
});

// Update transaction category endpoint
app.put('/api/transactions/:id/category', (req, res) => {
  const { id } = req.params;
  const { categoryId } = req.body;

  if (!id || !categoryId) {
    return res.status(400).json({ error: 'Transaction ID and category ID are required' });
  }

  db.run(
    'UPDATE transactions SET category_id = ? WHERE id = ?',
    [categoryId, id],
    function(err) {
      if (err) {
        console.error('Update transaction category error:', err);
        return res.status(500).json({ error: 'Failed to update transaction category' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json({ 
        success: true, 
        message: 'Transaction category updated successfully' 
      });
    }
  );
});

// Transactions endpoint
app.get('/api/transactions', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  
  // Filter parameters
  const search = req.query.search as string;
  const dateFrom = req.query.dateFrom as string;
  const dateTo = req.query.dateTo as string;
  const category = req.query.category as string;
  const cardNumber = req.query.cardNumber as string;
  const transactionType = req.query.transactionType as string;
  const amountMin = req.query.amountMin ? parseFloat(req.query.amountMin as string) : null;
  const amountMax = req.query.amountMax ? parseFloat(req.query.amountMax as string) : null;

  // Build WHERE clause dynamically
  let whereClause = '1=1';
  const params: any[] = [];

  if (search) {
    whereClause += ` AND (t.description LIKE ? OR t.merchant_name LIKE ? OR c.name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (dateFrom) {
    whereClause += ` AND t.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    whereClause += ` AND t.date <= ?`;
    params.push(dateTo);
  }

  if (category) {
    whereClause += ` AND c.name = ?`;
    params.push(category);
  }

  if (cardNumber) {
    whereClause += ` AND t.card_number = ?`;
    params.push(cardNumber);
  }

  if (transactionType) {
    whereClause += ` AND t.transaction_type = ?`;
    params.push(transactionType);
  }

  if (amountMin !== null) {
    whereClause += ` AND ABS(t.amount) >= ?`;
    params.push(amountMin);
  }

  if (amountMax !== null) {
    whereClause += ` AND ABS(t.amount) <= ?`;
    params.push(amountMax);
  }

  // Main query with filters
  const mainQuery = `
    SELECT 
      t.id,
      t.description,
      t.merchant_name,
      t.amount,
      t.date,
      t.original_text,
      t.created_at,
      t.card_number,
      t.transaction_type,
      t.location,
      t.memo,
      t.reference_id,
      t.statement_period,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      s.id as source_id,
      s.name as source_name,
      s.type as source_type,
      s.last_four as source_last_four,
      s.bank_name as source_bank_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN sources s ON t.source_id = s.id
    WHERE ${whereClause}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ? OFFSET ?
  `;

  // Count query with same filters
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN sources s ON t.source_id = s.id
    WHERE ${whereClause}
  `;

  db.all(mainQuery, [...params, limit, offset], (err, transactions: any[]) => {
    if (err) {
      console.error('Transactions query error:', err);
      return res.status(500).json({ error: 'Failed to load transactions' });
    }

    // Get filtered count for pagination
    db.get(countQuery, params, (err, countResult: any) => {
      if (err) {
        console.error('Count query error:', err);
        return res.status(500).json({ error: 'Failed to load transaction count' });
      }

      const formattedTransactions = (transactions || []).map((tx: any) => ({
        id: tx.id,
        description: tx.description,
        merchantName: tx.merchant_name,
        amount: tx.amount,
        date: tx.date.split('T')[0],
        originalText: tx.original_text,
        createdAt: tx.created_at,
        cardNumber: tx.card_number,
        transactionType: tx.transaction_type,
        location: tx.location,
        memo: tx.memo,
        referenceId: tx.reference_id,
        statementPeriod: tx.statement_period,
        category: {
          name: tx.category_name || 'Other',
          icon: tx.category_icon || '📦',
          color: tx.category_color || '#6B7280'
        },
        source: tx.source_id ? {
          id: tx.source_id,
          name: tx.source_name,
          type: tx.source_type,
          lastFour: tx.source_last_four,
          bankName: tx.source_bank_name
        } : null
      }));

      res.json({
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          totalPages: Math.ceil((countResult?.total || 0) / limit)
        }
      });
    });
  });
});

// Advanced Analytics endpoint with period comparisons
app.get('/api/analytics/advanced', (req, res) => {
  const period = req.query.period as string || 'month'; // month, quarter, year
  const currentDate = new Date();
  
  // Calculate date ranges for current and prior periods
  let currentStart: Date, currentEnd: Date, priorStart: Date, priorEnd: Date;
  
  if (period === 'month') {
    currentStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    currentEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    priorStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    priorEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  } else if (period === 'quarter') {
    const currentQuarter = Math.floor(currentDate.getMonth() / 3);
    currentStart = new Date(currentDate.getFullYear(), currentQuarter * 3, 1);
    currentEnd = new Date(currentDate.getFullYear(), (currentQuarter + 1) * 3, 0);
    priorStart = new Date(currentDate.getFullYear(), (currentQuarter - 1) * 3, 1);
    priorEnd = new Date(currentDate.getFullYear(), currentQuarter * 3, 0);
  } else { // year
    currentStart = new Date(currentDate.getFullYear(), 0, 1);
    currentEnd = new Date(currentDate.getFullYear(), 11, 31);
    priorStart = new Date(currentDate.getFullYear() - 1, 0, 1);
    priorEnd = new Date(currentDate.getFullYear() - 1, 11, 31);
  }

  const currentStartStr = currentStart.toISOString();
  const currentEndStr = currentEnd.toISOString();
  const priorStartStr = priorStart.toISOString();
  const priorEndStr = priorEnd.toISOString();

  // Get current period spending by category
  db.all(`
    SELECT 
      c.id as category_id,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(ABS(t.amount)), 0) as total_amount,
      AVG(ABS(t.amount)) as avg_amount
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id 
      AND t.date >= ? AND t.date <= ? AND t.amount < 0
    GROUP BY c.id, c.name, c.icon, c.color
    ORDER BY total_amount DESC
  `, [currentStartStr, currentEndStr], (err, currentCategories: any[]) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch current period data' });
    }

    // Get prior period spending by category
    db.all(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(ABS(t.amount)), 0) as total_amount,
        COUNT(t.id) as transaction_count
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id 
        AND t.date >= ? AND t.date <= ? AND t.amount < 0
      GROUP BY c.id, c.name
      ORDER BY total_amount DESC
    `, [priorStartStr, priorEndStr], (err, priorCategories: any[]) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch prior period data' });
      }

      // Get monthly trends for the last 6 months
      db.all(`
        SELECT 
          strftime('%Y-%m', date) as month,
          COUNT(*) as transaction_count,
          COALESCE(SUM(ABS(amount)), 0) as total_spending
        FROM transactions 
        WHERE amount < 0 AND date >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month
      `, (err, monthlyTrends: any[]) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch monthly trends' });
        }

        // Get card comparison data
        db.all(`
          SELECT 
            card_number,
            COUNT(*) as transaction_count,
            COALESCE(SUM(ABS(amount)), 0) as total_spending,
            AVG(ABS(amount)) as avg_transaction,
            MIN(date) as first_transaction,
            MAX(date) as last_transaction
          FROM transactions 
          WHERE amount < 0 AND card_number IS NOT NULL
          GROUP BY card_number
          ORDER BY total_spending DESC
        `, (err, cardComparison: any[]) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch card comparison' });
          }

          // Get location spending analysis
          db.all(`
            SELECT 
              location,
              COUNT(*) as transaction_count,
              COALESCE(SUM(ABS(amount)), 0) as total_spending,
              AVG(ABS(amount)) as avg_amount
            FROM transactions 
            WHERE amount < 0 AND location IS NOT NULL AND location != ''
            GROUP BY location
            ORDER BY total_spending DESC
            LIMIT 10
          `, (err, locationAnalysis: any[]) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to fetch location analysis' });
            }

            // Calculate period comparisons
            const currentTotal = currentCategories.reduce((sum, cat) => sum + cat.total_amount, 0);
            const priorTotal = priorCategories.reduce((sum, cat) => sum + cat.total_amount, 0);
            const periodChange = priorTotal > 0 ? ((currentTotal - priorTotal) / priorTotal) * 100 : 0;

            // Merge current and prior category data for comparison
            const categoryComparisons = currentCategories.map(current => {
              const prior = priorCategories.find(p => p.category_id === current.category_id);
              const priorAmount = prior ? prior.total_amount : 0;
              const change = priorAmount > 0 ? ((current.total_amount - priorAmount) / priorAmount) * 100 : 0;

              return {
                id: current.category_id,
                name: current.category_name,
                icon: current.category_icon,
                color: current.category_color,
                current: {
                  amount: current.total_amount,
                  transactions: current.transaction_count,
                  avgAmount: current.avg_amount
                },
                prior: {
                  amount: priorAmount,
                  transactions: prior ? prior.transaction_count : 0
                },
                change: {
                  amount: current.total_amount - priorAmount,
                  percentage: Math.round(change * 100) / 100
                }
              };
            });

            res.json({
              period: {
                type: period,
                current: {
                  start: currentStart.toISOString().split('T')[0],
                  end: currentEnd.toISOString().split('T')[0],
                  total: Math.round(currentTotal * 100) / 100
                },
                prior: {
                  start: priorStart.toISOString().split('T')[0],
                  end: priorEnd.toISOString().split('T')[0],
                  total: Math.round(priorTotal * 100) / 100
                },
                change: {
                  amount: Math.round((currentTotal - priorTotal) * 100) / 100,
                  percentage: Math.round(periodChange * 100) / 100
                }
              },
              categoryComparisons,
              monthlyTrends: monthlyTrends.map(trend => ({
                month: trend.month,
                spending: Math.round(trend.total_spending * 100) / 100,
                transactions: trend.transaction_count
              })),
              cardComparison: cardComparison.map(card => ({
                cardNumber: card.card_number,
                totalSpending: Math.round(card.total_spending * 100) / 100,
                transactions: card.transaction_count,
                avgTransaction: Math.round(card.avg_transaction * 100) / 100,
                period: {
                  start: card.first_transaction.split('T')[0],
                  end: card.last_transaction.split('T')[0]
                }
              })),
              locationAnalysis: locationAnalysis.map(loc => ({
                location: loc.location,
                spending: Math.round(loc.total_spending * 100) / 100,
                transactions: loc.transaction_count,
                avgAmount: Math.round(loc.avg_amount * 100) / 100
              }))
            });
          });
        });
      });
    });
  });
});

// Analytics anomalies endpoint
app.get('/api/analytics/anomalies', (_req, res) => {
  try {
    // Find unusually large transactions (more than 3x the average)
    db.get(`
      SELECT AVG(ABS(amount)) as avg_amount, 
             COUNT(*) as total_transactions
      FROM transactions
    `, [], (err, avgData: any) => {
      if (err) {
        console.error('Average amount query error:', err);
        return res.status(500).json({ error: 'Failed to calculate average amount' });
      }

      const avgAmount = avgData?.avg_amount || 0;
      const threshold = avgAmount * 3;

      // Get large transactions
      db.all(`
        SELECT 
          t.id,
          t.description,
          t.merchant_name,
          t.amount,
          t.date,
          t.card_number,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE ABS(t.amount) > ?
        ORDER BY ABS(t.amount) DESC
        LIMIT 10
      `, [threshold], (err, largeTransactions: any[]) => {
        if (err) {
          console.error('Large transactions query error:', err);
          return res.status(500).json({ error: 'Failed to get large transactions' });
        }

        // Find duplicate transactions (same merchant, amount, and date)
        db.all(`
          SELECT 
            t1.id,
            t1.description,
            t1.merchant_name,
            t1.amount,
            t1.date,
            t1.card_number,
            c.name as category_name,
            c.icon as category_icon,
            c.color as category_color,
            COUNT(*) as duplicate_count
          FROM transactions t1
          LEFT JOIN categories c ON t1.category_id = c.id
          WHERE EXISTS (
            SELECT 1 FROM transactions t2 
            WHERE t2.merchant_name = t1.merchant_name 
            AND ABS(t2.amount - t1.amount) < 0.01
            AND t2.date = t1.date
            AND t2.id != t1.id
          )
          GROUP BY t1.merchant_name, t1.amount, t1.date
          ORDER BY t1.date DESC
          LIMIT 10
        `, [], (err, duplicateTransactions: any[]) => {
          if (err) {
            console.error('Duplicate transactions query error:', err);
            return res.status(500).json({ error: 'Failed to get duplicate transactions' });
          }

          // Find frequent transactions (same merchant, more than 5 times in last 30 days)
          db.all(`
            SELECT 
              t.merchant_name,
              COUNT(*) as transaction_count,
              AVG(ABS(t.amount)) as avg_amount,
              SUM(ABS(t.amount)) as total_spent,
              c.name as category_name,
              c.icon as category_icon,
              c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.date >= date('now', '-30 days')
            AND t.merchant_name IS NOT NULL
            AND t.merchant_name != ''
            GROUP BY t.merchant_name, c.name
            HAVING COUNT(*) > 5
            ORDER BY COUNT(*) DESC
            LIMIT 10
          `, [], (err, frequentTransactions: any[]) => {
            if (err) {
              console.error('Frequent transactions query error:', err);
              return res.status(500).json({ error: 'Failed to get frequent transactions' });
            }

            // Find category spending spikes (categories with >50% increase from previous month)
            const currentMonth = new Date();
            const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
            const twoMonthsAgo = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 2, 1);

            db.all(`
              SELECT 
                c.name as category_name,
                c.icon as category_icon,
                c.color as category_color,
                SUM(CASE WHEN t.date >= ? THEN ABS(t.amount) ELSE 0 END) as current_month,
                SUM(CASE WHEN t.date >= ? AND t.date < ? THEN ABS(t.amount) ELSE 0 END) as last_month
              FROM transactions t
              LEFT JOIN categories c ON t.category_id = c.id
              WHERE t.date >= ?
              GROUP BY c.id, c.name, c.icon, c.color
              HAVING last_month > 0
              ORDER BY (current_month - last_month) / last_month DESC
              LIMIT 5
            `, [
              currentMonth.toISOString().split('T')[0],
              lastMonth.toISOString().split('T')[0],
              currentMonth.toISOString().split('T')[0],
              twoMonthsAgo.toISOString().split('T')[0]
            ], (err, categorySpikes: any[]) => {
              if (err) {
                console.error('Category spikes query error:', err);
                return res.status(500).json({ error: 'Failed to get category spikes' });
              }

              res.json({
                averageAmount: Math.round(avgAmount * 100) / 100,
                threshold: Math.round(threshold * 100) / 100,
                largeTransactions: largeTransactions || [],
                duplicateTransactions: duplicateTransactions || [],
                frequentTransactions: frequentTransactions || [],
                categorySpikes: (categorySpikes || []).filter(spike => {
                  const increase = spike.last_month > 0 ? (spike.current_month - spike.last_month) / spike.last_month : 0;
                  return increase > 0.5; // 50% increase
                }).map(spike => ({
                  ...spike,
                  increasePercent: spike.last_month > 0 ? Math.round(((spike.current_month - spike.last_month) / spike.last_month) * 100) : 0
                }))
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Anomalies analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze anomalies' });
  }
});

// Dashboard data endpoint
app.get('/api/analytics/dashboard', (_req, res) => {
  // Get total spent
  db.get(`
    SELECT 
      COALESCE(SUM(ABS(amount)), 0) as total,
      COUNT(*) as count
    FROM transactions 
    WHERE amount < 0
  `, (err, totalResult: any) => {
    if (err) {
      console.error('Dashboard query error:', err);
      return res.status(500).json({ error: 'Failed to load dashboard data' });
    }

    const totalSpent = totalResult?.total || 0;
    const transactionCount = totalResult?.count || 0;
    const avgTransaction = transactionCount > 0 ? totalSpent / transactionCount : 0;

    // Get top categories
    db.all(`
      SELECT 
        c.name,
        c.icon,
        SUM(ABS(t.amount)) as amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.amount < 0
      GROUP BY c.id, c.name, c.icon
      ORDER BY amount DESC
      LIMIT 5
    `, (err, categoriesResult: any[]) => {
      if (err) {
        console.error('Categories query error:', err);
        return res.status(500).json({ error: 'Failed to load categories data' });
      }

      const topCategories = (categoriesResult || []).map((cat: any) => ({
        name: `${cat.icon} ${cat.name}`,
        amount: cat.amount,
        percentage: totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0
      }));

      // Get recent transactions
      db.all(`
        SELECT 
          t.id,
          t.description,
          t.amount,
          t.date,
          c.name,
          c.icon
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 10
      `, (err, transactionsResult: any[]) => {
        if (err) {
          console.error('Transactions query error:', err);
          return res.status(500).json({ error: 'Failed to load transactions data' });
        }

        const recentTransactions = (transactionsResult || []).map((tx: any) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.date.split('T')[0],
          category: tx.name ? `${tx.icon} ${tx.name}` : '📦 Other'
        }));

        res.json({
          totalSpent: Math.round(totalSpent * 100) / 100,
          transactionCount,
          avgTransaction: Math.round(avgTransaction * 100) / 100,
          topCategories,
          monthlyTrend: [], // Will implement if needed
          recentTransactions
        });
      });
    });
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}


// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Database initialized with categories');
});