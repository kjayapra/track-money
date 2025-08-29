import { Database } from '../database/Database';
import { TransactionService } from './TransactionService';
import { SpendingAnalysis, Transaction, SpendingInsight } from '../../types';
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export class AnalyticsService {
  constructor(
    private db: Database,
    private transactionService: TransactionService
  ) {}

  async generateSpendingAnalysis(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SpendingAnalysis> {
    const transactions = await this.transactionService.getTransactionsByDateRange(
      userId,
      startDate,
      endDate
    );

    const expenses = transactions.filter(t => t.amount < 0);
    const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransactionAmount = expenses.length > 0 ? totalSpent / expenses.length : 0;

    const topCategories = await this.getTopCategoriesAnalysis(userId, startDate, endDate);
    const monthlyTrend = await this.getMonthlyTrendAnalysis(userId, 12);
    const anomalies = await this.detectSpendingAnomalies(userId, startDate, endDate);

    return {
      totalSpent,
      transactionCount: expenses.length,
      avgTransactionAmount,
      topCategories,
      monthlyTrend,
      anomalies
    };
  }

  async getTopCategoriesAnalysis(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ categoryId: string; categoryName: string; amount: number; percentage: number }>> {
    const categories = await this.transactionService.getSpendingByCategory(userId, startDate, endDate);
    const totalSpent = categories.reduce((sum, c) => sum + c.amount, 0);

    return categories
      .map(cat => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        amount: cat.amount,
        percentage: totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }

  async getMonthlyTrendAnalysis(
    userId: string,
    months: number = 12
  ): Promise<Array<{ month: string; amount: number }>> {
    const monthlyData = await this.transactionService.getMonthlySpending(userId);
    return monthlyData.slice(0, months).reverse();
  }

  async detectSpendingAnomalies(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; amount: number; description: string; reason: string }>> {
    const transactions = await this.transactionService.getTransactionsByDateRange(
      userId,
      startDate,
      endDate
    );

    const expenses = transactions.filter(t => t.amount < 0);
    if (expenses.length < 10) return [];

    const amounts = expenses.map(t => Math.abs(t.amount));
    const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = [];
    const threshold = mean + (2 * stdDev); // 2 standard deviations above mean

    for (const transaction of expenses) {
      const amount = Math.abs(transaction.amount);
      if (amount > threshold) {
        anomalies.push({
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description,
          reason: `Unusual spending: $${amount.toFixed(2)} is ${((amount - mean) / stdDev).toFixed(1)} standard deviations above your average of $${mean.toFixed(2)}`
        });
      }
    }

    return anomalies.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }

  async generateSpendingInsights(userId: string): Promise<SpendingInsight[]> {
    const insights: SpendingInsight[] = [];
    const currentMonth = new Date();
    const lastMonth = subMonths(currentMonth, 1);

    const currentMonthStart = startOfMonth(currentMonth);
    const currentMonthEnd = endOfMonth(currentMonth);
    const lastMonthStart = startOfMonth(lastMonth);
    const lastMonthEnd = endOfMonth(lastMonth);

    try {
      const currentMonthSpending = await this.getMonthSpending(userId, currentMonthStart, currentMonthEnd);
      const lastMonthSpending = await this.getMonthSpending(userId, lastMonthStart, lastMonthEnd);

      const spendingChange = ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;

      if (Math.abs(spendingChange) > 20) {
        const severity = Math.abs(spendingChange) > 50 ? 'high' : 'medium';
        const trend = spendingChange > 0 ? 'increased' : 'decreased';
        
        insights.push({
          id: uuidv4(),
          userId,
          type: 'trend',
          title: `Spending ${trend} significantly`,
          description: `Your spending has ${trend} by ${Math.abs(spendingChange).toFixed(1)}% compared to last month (${format(lastMonth, 'MMM yyyy')})`,
          data: { currentMonth: currentMonthSpending, lastMonth: lastMonthSpending, change: spendingChange },
          severity,
          isRead: false,
          createdAt: new Date()
        });
      }

      const anomalies = await this.detectSpendingAnomalies(userId, currentMonthStart, new Date());
      if (anomalies.length > 0) {
        insights.push({
          id: uuidv4(),
          userId,
          type: 'anomaly',
          title: 'Unusual spending detected',
          description: `Found ${anomalies.length} transactions that are significantly higher than your usual spending patterns`,
          data: { anomalies: anomalies.slice(0, 3) },
          severity: 'medium',
          isRead: false,
          createdAt: new Date()
        });
      }

      const budgetAlerts = await this.checkBudgetAlerts(userId, currentMonthStart, currentMonthEnd);
      insights.push(...budgetAlerts);

      const recommendations = await this.generateRecommendations(userId);
      insights.push(...recommendations);

    } catch (error) {
      console.error('Error generating spending insights:', error);
    }

    return insights.slice(0, 10);
  }

  async getRecurringTransactions(userId: string): Promise<Array<{
    description: string;
    amount: number;
    frequency: number;
    categoryName: string;
    lastTransaction: Date;
  }>> {
    const rows = await this.db.all<any>(`
      SELECT 
        t.description,
        t.merchant_name,
        AVG(ABS(t.amount)) as avg_amount,
        COUNT(*) as frequency,
        c.name as category_name,
        MAX(t.date) as last_transaction
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? 
        AND t.date >= date('now', '-6 months')
        AND t.amount < 0
      GROUP BY 
        CASE 
          WHEN t.merchant_name IS NOT NULL AND t.merchant_name != '' 
          THEN t.merchant_name 
          ELSE t.description 
        END
      HAVING COUNT(*) >= 3
      ORDER BY frequency DESC, avg_amount DESC
      LIMIT 20
    `, [userId]);

    return rows.map(row => ({
      description: row.merchant_name || row.description,
      amount: row.avg_amount,
      frequency: row.frequency,
      categoryName: row.category_name || 'Uncategorized',
      lastTransaction: new Date(row.last_transaction)
    }));
  }

  async getCategoryTrends(
    userId: string,
    categoryId: string,
    months: number = 6
  ): Promise<Array<{ month: string; amount: number; transactionCount: number }>> {
    const rows = await this.db.all<any>(`
      SELECT 
        strftime('%Y-%m', t.date) as month,
        SUM(ABS(t.amount)) as amount,
        COUNT(*) as transaction_count
      FROM transactions t
      WHERE t.user_id = ? 
        AND t.category_id = ?
        AND t.amount < 0
        AND t.date >= date('now', '-${months} months')
      GROUP BY strftime('%Y-%m', t.date)
      ORDER BY month DESC
    `, [userId, categoryId]);

    return rows.map(row => ({
      month: row.month,
      amount: row.amount || 0,
      transactionCount: row.transaction_count || 0
    }));
  }

  private async getMonthSpending(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const row = await this.db.get<any>(`
      SELECT SUM(ABS(amount)) as total
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ? AND amount < 0
    `, [userId, startDate.toISOString(), endDate.toISOString()]);

    return row?.total || 0;
  }

  private async checkBudgetAlerts(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SpendingInsight[]> {
    const budgets = await this.db.all<any>(`
      SELECT b.*, c.name as category_name
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.start_date <= ? AND b.end_date >= ?
    `, [userId, endDate.toISOString(), startDate.toISOString()]);

    const alerts: SpendingInsight[] = [];

    for (const budget of budgets) {
      const spent = await this.db.get<any>(`
        SELECT SUM(ABS(amount)) as total
        FROM transactions
        WHERE user_id = ? AND category_id = ? AND date >= ? AND date <= ? AND amount < 0
      `, [userId, budget.category_id, startDate.toISOString(), endDate.toISOString()]);

      const totalSpent = spent?.total || 0;
      const percentage = (totalSpent / budget.amount) * 100;

      if (percentage > 90) {
        alerts.push({
          id: uuidv4(),
          userId,
          type: 'budget_alert',
          title: `Budget exceeded: ${budget.category_name}`,
          description: `You've spent $${totalSpent.toFixed(2)} (${percentage.toFixed(0)}%) of your $${budget.amount} budget for ${budget.category_name}`,
          data: { budgetAmount: budget.amount, spent: totalSpent, percentage },
          severity: percentage > 100 ? 'high' : 'medium',
          isRead: false,
          createdAt: new Date()
        });
      }
    }

    return alerts;
  }

  private async generateRecommendations(userId: string): Promise<SpendingInsight[]> {
    const recommendations: SpendingInsight[] = [];
    
    const topCategories = await this.getTopCategoriesAnalysis(
      userId,
      startOfMonth(subMonths(new Date(), 1)),
      endOfMonth(subMonths(new Date(), 1))
    );

    if (topCategories.length > 0) {
      const topCategory = topCategories[0];
      if (topCategory.percentage > 30) {
        recommendations.push({
          id: uuidv4(),
          userId,
          type: 'recommendation',
          title: 'Consider setting a budget',
          description: `${topCategory.categoryName} represents ${topCategory.percentage.toFixed(0)}% of your spending. Consider setting a monthly budget to track this category better.`,
          data: { category: topCategory },
          severity: 'low',
          isRead: false,
          createdAt: new Date()
        });
      }
    }

    return recommendations;
  }
}