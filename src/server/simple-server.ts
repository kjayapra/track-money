import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { parseStatementFile } from './parser';
import { TransactionCategorizer } from './categorizer';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database and categorizer
const db = getDatabase();
const categorizer = new TransactionCategorizer(db);

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, CSV, and Excel files are allowed.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running!' });
});

// Chat endpoint for the demo
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  let response = "I can help you understand your financial data. ";
  
  if (message.toLowerCase().includes('spending')) {
    response = "Based on your data, you've spent $4,567.89 this month across 156 transactions. Your top categories are Groceries ($1,234.56), Restaurants ($987.65), and Gas & Fuel ($543.21).";
  } else if (message.toLowerCase().includes('budget')) {
    response = "Looking at your patterns, I notice you spend about 27% on groceries and 22% on restaurants. You could save $200-300 monthly by reducing restaurant visits.";
  } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
    response = "Hello! I'm your financial assistant. Ask me about your spending patterns, budgets, or unusual transactions.";
  } else {
    response = "I understand you're asking about your finances. Try asking about your spending, budgets, or specific categories like 'How much did I spend on groceries?'";
  }
  
  res.json({ response });
});

// File upload endpoint
app.post('/api/upload', upload.single('statement'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    console.log('Processing file:', file.originalname);

    // 1. Parse the file
    const parseResult = await parseStatementFile(file.path, file.originalname);
    
    if (parseResult.errors.length > 0) {
      console.warn('Parsing warnings:', parseResult.errors);
    }

    if (parseResult.transactions.length === 0) {
      return res.status(400).json({ 
        error: 'No transactions found in file',
        details: parseResult.errors 
      });
    }

    // 2. Store statement record
    const statementId = uuidv4();
    await db.run(`
      INSERT INTO statements (id, file_name, transaction_count, total_amount)
      VALUES (?, ?, ?, ?)
    `, [statementId, file.originalname, parseResult.transactions.length, parseResult.totalAmount]);

    // 3. Process and store transactions
    const categorizedTransactions = [];
    for (const parsedTx of parseResult.transactions) {
      try {
        // Categorize transaction
        const categorization = await categorizer.categorizeTransaction(
          parsedTx.description, 
          parsedTx.merchantName
        );

        // Store transaction
        const transactionId = uuidv4();
        await db.run(`
          INSERT INTO transactions (id, amount, description, merchant_name, date, category_id, original_text)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          transactionId,
          parsedTx.amount,
          parsedTx.description,
          parsedTx.merchantName || null,
          parsedTx.date.toISOString(),
          categorization.categoryId,
          parsedTx.originalText
        ]);

        categorizedTransactions.push({
          id: transactionId,
          ...parsedTx,
          categoryId: categorization.categoryId,
          confidence: categorization.confidence
        });

      } catch (error) {
        console.error('Error processing transaction:', error);
      }
    }

    console.log(`Successfully processed ${categorizedTransactions.length} transactions`);

    res.json({
      success: true,
      message: 'File processed successfully',
      filename: file.originalname,
      transactionCount: categorizedTransactions.length,
      totalAmount: parseResult.totalAmount,
      transactions: categorizedTransactions.slice(0, 5), // Show first 5 as preview
      status: 'completed'
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: 'File processing failed: ' + (error as Error).message });
  }
});

// Real data endpoints
app.get('/api/analytics/dashboard', async (_req, res) => {
  try {
    // Get total spent (negative amounts only)
    const totalSpentResult = await db.get<{total: number, count: number}>(`
      SELECT 
        COALESCE(SUM(ABS(amount)), 0) as total,
        COUNT(*) as count
      FROM transactions 
      WHERE amount < 0
    `);

    const totalSpent = totalSpentResult?.total || 0;
    const transactionCount = totalSpentResult?.count || 0;
    const avgTransaction = transactionCount > 0 ? totalSpent / transactionCount : 0;

    // Get top categories
    const topCategoriesData = await db.all<{category_id: string, name: string, amount: number, icon: string}>(`
      SELECT 
        c.id as category_id,
        c.name,
        c.icon,
        SUM(ABS(t.amount)) as amount
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.amount < 0
      GROUP BY c.id, c.name, c.icon
      ORDER BY amount DESC
      LIMIT 5
    `);

    const topCategories = topCategoriesData.map(cat => ({
      name: `${cat.icon} ${cat.name}`,
      amount: cat.amount,
      percentage: totalSpent > 0 ? Math.round((cat.amount / totalSpent) * 100) : 0
    }));

    // Get monthly trend (last 6 months)
    const monthlyTrendData = await db.all<{month: string, amount: number}>(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(ABS(amount)) as amount
      FROM transactions
      WHERE amount < 0 AND date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month ASC
    `);

    // Get recent transactions
    const recentTransactionsData = await db.all<{
      id: string, description: string, amount: number, date: string, name: string, icon: string
    }>(`
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
    `);

    const recentTransactions = recentTransactionsData.map(tx => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date.split('T')[0], // Get just the date part
      category: tx.name ? `${tx.icon} ${tx.name}` : '📦 Other'
    }));

    res.json({
      totalSpent,
      transactionCount,
      avgTransaction: Math.round(avgTransaction * 100) / 100,
      topCategories,
      monthlyTrend: monthlyTrendData,
      recentTransactions
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
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
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});