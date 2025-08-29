import express from 'express';
import cors from 'cors';
import path from 'path';
import { Database } from './database/Database';
import { TransactionService } from './services/TransactionService';
import { CategoryService } from './services/CategoryService';
import { AnalyticsService } from './services/AnalyticsService';
import { AICategorizationService } from './services/AICategorizationService';
import { EmailService } from './services/EmailService';
import { ChatService } from './services/ChatService';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import categoryRoutes from './routes/categories';
import analyticsRoutes from './routes/analytics';
import uploadRoutes from './routes/upload';
import chatRoutes from './routes/chat';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const database = new Database();
const transactionService = new TransactionService(database);
const categoryService = new CategoryService(database);
const analyticsService = new AnalyticsService(database, transactionService);
const aiCategorizationService = new AICategorizationService(
  categoryService,
  process.env.OPENAI_API_KEY
);
const emailService = new EmailService();
const chatService = new ChatService(database, analyticsService, process.env.OPENAI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make services available to routes
app.locals.services = {
  database,
  transactionService,
  categoryService,
  analyticsService,
  aiCategorizationService,
  emailService,
  chatService,
};

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);

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

// Initialize database and start server
async function startServer() {
  try {
    await database.initialize();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();