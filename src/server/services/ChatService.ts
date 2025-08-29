import OpenAI from 'openai';
import { Database } from '../database/Database';
import { AnalyticsService } from './AnalyticsService';
import { ChatMessage } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export class ChatService {
  private openai?: OpenAI;

  constructor(
    private db: Database,
    private analyticsService: AnalyticsService,
    apiKey?: string
  ) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async processMessage(userId: string, message: string): Promise<string> {
    try {
      // Store user message
      await this.storeChatMessage(userId, message, '');

      // Try to answer using data analysis first
      const dataResponse = await this.analyzeDataQuery(userId, message);
      if (dataResponse) {
        await this.updateChatMessage(userId, message, dataResponse);
        return dataResponse;
      }

      // Fall back to AI if available
      if (this.openai) {
        const aiResponse = await this.getAIResponse(userId, message);
        await this.updateChatMessage(userId, message, aiResponse);
        return aiResponse;
      }

      // Default response if no AI available
      const defaultResponse = this.getDefaultResponse(message);
      await this.updateChatMessage(userId, message, defaultResponse);
      return defaultResponse;

    } catch (error) {
      console.error('Error processing chat message:', error);
      return "I'm sorry, I encountered an error processing your request. Please try again.";
    }
  }

  private async analyzeDataQuery(userId: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase();
    
    try {
      // Spending queries
      if (this.containsKeywords(lowerMessage, ['spent', 'spending', 'spend', 'total'])) {
        return await this.handleSpendingQuery(userId, lowerMessage);
      }

      // Category queries
      if (this.containsKeywords(lowerMessage, ['category', 'categories', 'groceries', 'restaurants', 'gas'])) {
        return await this.handleCategoryQuery(userId, lowerMessage);
      }

      // Budget queries
      if (this.containsKeywords(lowerMessage, ['budget', 'over budget', 'remaining'])) {
        return await this.handleBudgetQuery(userId, lowerMessage);
      }

      // Transaction queries
      if (this.containsKeywords(lowerMessage, ['transaction', 'purchase', 'bought', 'charge'])) {
        return await this.handleTransactionQuery(userId, lowerMessage);
      }

      // Anomaly queries
      if (this.containsKeywords(lowerMessage, ['unusual', 'anomaly', 'weird', 'strange', 'suspicious'])) {
        return await this.handleAnomalyQuery(userId, lowerMessage);
      }

      // Trend queries
      if (this.containsKeywords(lowerMessage, ['trend', 'pattern', 'month', 'compare'])) {
        return await this.handleTrendQuery(userId, lowerMessage);
      }

    } catch (error) {
      console.error('Error in data analysis:', error);
    }

    return null;
  }

  private async handleSpendingQuery(userId: string, message: string): Promise<string> {
    const currentMonth = new Date();
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);

    // Check if asking about specific time period
    let period = 'this month';
    if (message.includes('week')) {
      const now = new Date();
      startDate.setDate(now.getDate() - 7);
      period = 'this week';
    } else if (message.includes('year')) {
      startDate.setMonth(0, 1);
      endDate.setMonth(11, 31);
      period = 'this year';
    } else if (message.includes('last month')) {
      const lastMonth = subMonths(currentMonth, 1);
      startDate.setTime(startOfMonth(lastMonth).getTime());
      endDate.setTime(endOfMonth(lastMonth).getTime());
      period = 'last month';
    }

    const analysis = await this.analyticsService.generateSpendingAnalysis(userId, startDate, endDate);

    return `You've spent $${analysis.totalSpent.toFixed(2)} ${period} across ${analysis.transactionCount} transactions. Your average transaction was $${analysis.avgTransactionAmount.toFixed(2)}. 

Your top spending categories were:
${analysis.topCategories.slice(0, 3).map((cat, i) => 
  `${i + 1}. ${cat.categoryName}: $${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)`
).join('\n')}`;
  }

  private async handleCategoryQuery(userId: string, message: string): Promise<string> {
    const currentMonth = new Date();
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);

    const categories = await this.analyticsService.getTopCategoriesAnalysis(userId, startDate, endDate);
    
    // Check if asking about specific category
    const specificCategory = this.extractCategory(message);
    if (specificCategory) {
      const category = categories.find(c => 
        c.categoryName.toLowerCase().includes(specificCategory.toLowerCase())
      );
      
      if (category) {
        return `You've spent $${category.amount.toFixed(2)} on ${category.categoryName} this month, which represents ${category.percentage.toFixed(1)}% of your total spending.`;
      } else {
        return `I couldn't find any significant spending in the ${specificCategory} category this month.`;
      }
    }

    return `Your spending by category this month:
${categories.slice(0, 5).map((cat, i) => 
  `${i + 1}. ${cat.categoryName}: $${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)`
).join('\n')}`;
  }

  private async handleBudgetQuery(userId: string, message: string): Promise<string> {
    // This would query budget data from the database
    // For now, return a placeholder response
    return "Budget tracking is available in the analytics section. You can set up budgets for different categories and I'll help you track your progress against them.";
  }

  private async handleTransactionQuery(userId: string, message: string): Promise<string> {
    // This would search for specific transactions
    return "I can help you find specific transactions. Try asking about transactions from a particular merchant or category, like 'Show me transactions from Starbucks' or 'What did I spend at grocery stores?'";
  }

  private async handleAnomalyQuery(userId: string, message: string): Promise<string> {
    const currentMonth = new Date();
    const startDate = startOfMonth(currentMonth);
    const endDate = endOfMonth(currentMonth);

    const anomalies = await this.analyticsService.detectSpendingAnomalies(userId, startDate, endDate);
    
    if (anomalies.length === 0) {
      return "I haven't detected any unusual spending patterns this month. Your spending appears to be consistent with your normal patterns.";
    }

    return `I found ${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''} this month:

${anomalies.slice(0, 3).map(anomaly => 
  `• $${Math.abs(anomaly.amount).toFixed(2)} at ${anomaly.description} on ${format(anomaly.date, 'MMM dd')}\n  ${anomaly.reason}`
).join('\n\n')}`;
  }

  private async handleTrendQuery(userId: string, message: string): Promise<string> {
    const monthlyTrend = await this.analyticsService.getMonthlyTrendAnalysis(userId, 6);
    
    if (monthlyTrend.length < 2) {
      return "I need more historical data to analyze spending trends. Please upload more statements to see spending patterns over time.";
    }

    const latest = monthlyTrend[0];
    const previous = monthlyTrend[1];
    const change = ((latest.amount - previous.amount) / previous.amount) * 100;
    
    const trend = change > 0 ? 'increased' : 'decreased';
    const trendEmoji = change > 0 ? '📈' : '📉';

    return `${trendEmoji} Your spending has ${trend} by ${Math.abs(change).toFixed(1)}% compared to last month.

Recent monthly spending:
${monthlyTrend.slice(0, 4).map(month => 
  `• ${format(new Date(month.month + '-01'), 'MMM yyyy')}: $${month.amount.toFixed(2)}`
).join('\n')}`;
  }

  private async getAIResponse(userId: string, message: string): Promise<string> {
    if (!this.openai) {
      return this.getDefaultResponse(message);
    }

    try {
      // Get user's financial context
      const context = await this.getUserFinancialContext(userId);
      
      const systemPrompt = `You are a helpful financial assistant for a credit card expense tracking app. 
You have access to the user's financial data and can provide insights about their spending.

User's financial context:
${context}

Provide helpful, personalized responses about their finances. Be concise and actionable.
If you don't have specific data to answer their question, let them know and suggest what they might need to do.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || this.getDefaultResponse(message);
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getDefaultResponse(message);
    }
  }

  private async getUserFinancialContext(userId: string): Promise<string> {
    try {
      const currentMonth = new Date();
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const analysis = await this.analyticsService.generateSpendingAnalysis(userId, startDate, endDate);
      const monthlyTrend = await this.analyticsService.getMonthlyTrendAnalysis(userId, 3);

      return `
Current month spending: $${analysis.totalSpent.toFixed(2)}
Number of transactions: ${analysis.transactionCount}
Average transaction: $${analysis.avgTransactionAmount.toFixed(2)}

Top categories:
${analysis.topCategories.slice(0, 3).map(cat => 
  `- ${cat.categoryName}: $${cat.amount.toFixed(2)} (${cat.percentage.toFixed(1)}%)`
).join('\n')}

Recent monthly spending: ${monthlyTrend.map(m => `${m.month}: $${m.amount.toFixed(2)}`).join(', ')}

${analysis.anomalies.length > 0 ? `Unusual transactions detected: ${analysis.anomalies.length}` : 'No unusual spending detected'}
`;
    } catch (error) {
      return 'Limited financial data available.';
    }
  }

  private getDefaultResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (this.containsKeywords(lowerMessage, ['hello', 'hi', 'hey'])) {
      return "Hello! I'm your financial assistant. I can help you understand your spending patterns, find transactions, and provide insights about your finances. What would you like to know?";
    }
    
    if (this.containsKeywords(lowerMessage, ['help', 'what can you do'])) {
      return "I can help you with:\n• Analyzing your spending patterns\n• Finding specific transactions\n• Identifying unusual expenses\n• Comparing spending across months\n• Understanding your category breakdowns\n\nJust ask me questions about your finances!";
    }
    
    return "I can help you understand your financial data. Try asking me about your spending, specific categories, or unusual transactions. For example: 'How much did I spend this month?' or 'Show me my grocery spending.'";
  }

  private async storeChatMessage(userId: string, message: string, response: string): Promise<void> {
    const id = uuidv4();
    await this.db.run(`
      INSERT INTO chat_messages (id, user_id, message, response, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, userId, message, response, new Date().toISOString()]);
  }

  private async updateChatMessage(userId: string, message: string, response: string): Promise<void> {
    await this.db.run(`
      UPDATE chat_messages 
      SET response = ? 
      WHERE user_id = ? AND message = ? AND response = ''
      ORDER BY created_at DESC 
      LIMIT 1
    `, [response, userId, message]);
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractCategory(message: string): string | null {
    const categories = [
      'groceries', 'restaurants', 'gas', 'fuel', 'shopping', 
      'utilities', 'entertainment', 'healthcare', 'transport', 'travel'
    ];
    
    for (const category of categories) {
      if (message.toLowerCase().includes(category)) {
        return category;
      }
    }
    
    return null;
  }

  async getChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    const rows = await this.db.all<any>(`
      SELECT * FROM chat_messages 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      message: row.message,
      response: row.response,
      context: row.context ? JSON.parse(row.context) : null,
      createdAt: new Date(row.created_at)
    }));
  }
}