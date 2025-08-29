import { Database } from '../database/Database';
import { Transaction, TransactionFilter, Account, Category } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class TransactionService {
  constructor(private db: Database) {}

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const id = uuidv4();
    const now = new Date();
    
    await this.db.run(`
      INSERT INTO transactions (
        id, user_id, account_id, amount, description, date, category_id,
        merchant_name, merchant_category, is_recurring, tags, notes,
        confidence, is_verified, original_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      transaction.userId,
      transaction.accountId,
      transaction.amount,
      transaction.description,
      transaction.date.toISOString(),
      transaction.categoryId || null,
      transaction.merchantName || null,
      transaction.merchantCategory || null,
      transaction.isRecurring ? 1 : 0,
      JSON.stringify(transaction.tags || []),
      transaction.notes || null,
      transaction.confidence || null,
      transaction.isVerified ? 1 : 0,
      transaction.originalText || null,
      now.toISOString(),
      now.toISOString()
    ]);

    return this.getTransactionById(id) as Promise<Transaction>;
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const row = await this.db.get<any>(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `, [id]);

    if (!row) return null;
    return this.mapRowToTransaction(row);
  }

  async getTransactionsByUser(
    userId: string, 
    filter: TransactionFilter = {},
    limit: number = 100,
    offset: number = 0
  ): Promise<Transaction[]> {
    let sql = `
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id = ?
    `;
    const params: any[] = [userId];

    if (filter.startDate) {
      sql += ' AND t.date >= ?';
      params.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
      sql += ' AND t.date <= ?';
      params.push(filter.endDate.toISOString());
    }

    if (filter.categoryIds && filter.categoryIds.length > 0) {
      sql += ` AND t.category_id IN (${filter.categoryIds.map(() => '?').join(',')})`;
      params.push(...filter.categoryIds);
    }

    if (filter.accountIds && filter.accountIds.length > 0) {
      sql += ` AND t.account_id IN (${filter.accountIds.map(() => '?').join(',')})`;
      params.push(...filter.accountIds);
    }

    if (filter.minAmount !== undefined) {
      sql += ' AND ABS(t.amount) >= ?';
      params.push(filter.minAmount);
    }

    if (filter.maxAmount !== undefined) {
      sql += ' AND ABS(t.amount) <= ?';
      params.push(filter.maxAmount);
    }

    if (filter.searchTerm) {
      sql += ' AND (t.description LIKE ? OR t.merchant_name LIKE ?)';
      const searchParam = `%${filter.searchTerm}%`;
      params.push(searchParam, searchParam);
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => 't.tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      filter.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.all<any>(sql, params);
    return rows.map(row => this.mapRowToTransaction(row));
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    const fields = [];
    const params = [];

    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      params.push(updates.amount);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      params.push(updates.description);
    }

    if (updates.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(updates.categoryId);
    }

    if (updates.merchantName !== undefined) {
      fields.push('merchant_name = ?');
      params.push(updates.merchantName);
    }

    if (updates.tags !== undefined) {
      fields.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      params.push(updates.notes);
    }

    if (updates.isVerified !== undefined) {
      fields.push('is_verified = ?');
      params.push(updates.isVerified ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.getTransactionById(id);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await this.db.run(`
      UPDATE transactions 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `, params);

    return this.getTransactionById(id);
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM transactions WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async bulkCreateTransactions(transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Transaction[]> {
    const results: Transaction[] = [];
    
    await this.db.beginTransaction();
    try {
      for (const transaction of transactions) {
        const created = await this.createTransaction(transaction);
        results.push(created);
      }
      await this.db.commit();
    } catch (error) {
      await this.db.rollback();
      throw error;
    }

    return results;
  }

  async getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.getTransactionsByUser(userId, { startDate, endDate });
  }

  async getTransactionsByCategory(userId: string, categoryId: string): Promise<Transaction[]> {
    return this.getTransactionsByUser(userId, { categoryIds: [categoryId] });
  }

  async getSpendingByCategory(userId: string, startDate: Date, endDate: Date): Promise<Array<{categoryId: string; categoryName: string; amount: number; count: number}>> {
    const rows = await this.db.all<any>(`
      SELECT 
        t.category_id,
        c.name as category_name,
        SUM(ABS(t.amount)) as amount,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date >= ? AND t.date <= ? AND t.amount < 0
      GROUP BY t.category_id, c.name
      ORDER BY amount DESC
    `, [userId, startDate.toISOString(), endDate.toISOString()]);

    return rows.map(row => ({
      categoryId: row.category_id || 'uncategorized',
      categoryName: row.category_name || 'Uncategorized',
      amount: row.amount || 0,
      count: row.count || 0
    }));
  }

  async getMonthlySpending(userId: string): Promise<Array<{month: string; amount: number}>> {
    const rows = await this.db.all<any>(`
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(ABS(t.amount)) as amount
      FROM transactions t
      WHERE t.user_id = ? AND t.amount < 0
      GROUP BY strftime('%Y-%m', t.date)
      ORDER BY month DESC
      LIMIT 12
    `, [userId]);

    return rows.map(row => ({
      month: row.month,
      amount: row.amount || 0
    }));
  }

  private mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      amount: row.amount,
      description: row.description,
      date: new Date(row.date),
      categoryId: row.category_id,
      merchantName: row.merchant_name,
      merchantCategory: row.merchant_category,
      isRecurring: row.is_recurring === 1,
      tags: JSON.parse(row.tags || '[]'),
      notes: row.notes,
      confidence: row.confidence,
      isVerified: row.is_verified === 1,
      originalText: row.original_text,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}