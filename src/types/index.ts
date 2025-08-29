export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: 'credit' | 'debit';
  lastFourDigits: string;
  bank: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  color: string;
  icon: string;
  isSystem: boolean;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date;
  categoryId?: string;
  merchantName?: string;
  merchantCategory?: string;
  isRecurring: boolean;
  tags: string[];
  notes?: string;
  confidence?: number;
  isVerified: boolean;
  originalText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpendingInsight {
  id: string;
  userId: string;
  type: 'anomaly' | 'trend' | 'budget_alert' | 'recommendation';
  title: string;
  description: string;
  data: any;
  severity: 'low' | 'medium' | 'high';
  isRead: boolean;
  createdAt: Date;
}

export interface Statement {
  id: string;
  userId: string;
  accountId: string;
  fileName: string;
  fileType: 'pdf' | 'csv' | 'xlsx';
  statementDate: Date;
  transactionCount: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  categoryIds?: string[];
  accountIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
  tags?: string[];
}

export interface SpendingAnalysis {
  totalSpent: number;
  transactionCount: number;
  avgTransactionAmount: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
  anomalies: Array<{
    date: Date;
    amount: number;
    description: string;
    reason: string;
  }>;
}

export interface EmailReport {
  id: string;
  userId: string;
  type: 'monthly' | 'quarterly';
  reportDate: Date;
  data: SpendingAnalysis;
  sentAt?: Date;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  context?: any;
  createdAt: Date;
}