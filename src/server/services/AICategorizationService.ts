import OpenAI from 'openai';
import { CategoryService } from './CategoryService';
import { Transaction, Category } from '../../types';

export class AICategorizationService {
  private openai: OpenAI;

  constructor(
    private categoryService: CategoryService,
    apiKey?: string
  ) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async categorizeTransaction(
    transaction: Pick<Transaction, 'description' | 'merchantName' | 'merchantCategory' | 'amount'>,
    userId: string,
    availableCategories?: Category[]
  ): Promise<{ categoryId: string; confidence: number; reasoning?: string }> {
    if (!availableCategories) {
      availableCategories = await this.categoryService.getCategoriesByUser(userId);
    }

    const ruleBased = await this.ruleBasedCategorization(transaction, availableCategories);
    if (ruleBased.confidence > 0.8) {
      return ruleBased;
    }

    if (this.openai) {
      try {
        const aiResult = await this.aiCategorization(transaction, availableCategories);
        if (aiResult.confidence > ruleBased.confidence) {
          return aiResult;
        }
      } catch (error) {
        console.warn('AI categorization failed, falling back to rule-based:', error.message);
      }
    }

    return ruleBased;
  }

  private async ruleBasedCategorization(
    transaction: Pick<Transaction, 'description' | 'merchantName' | 'merchantCategory' | 'amount'>,
    categories: Category[]
  ): Promise<{ categoryId: string; confidence: number; reasoning?: string }> {
    const description = (transaction.description || '').toLowerCase();
    const merchantName = (transaction.merchantName || '').toLowerCase();
    const merchantCategory = (transaction.merchantCategory || '').toLowerCase();
    const amount = Math.abs(transaction.amount);

    const rules = [
      {
        test: () => this.containsKeywords([description, merchantName], ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'safeway']),
        category: 'Groceries',
        confidence: 0.9
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['gas', 'fuel', 'shell', 'exxon', 'chevron', 'bp', '76']),
        category: 'Gas & Fuel',
        confidence: 0.9
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'taco', 'subway', 'mcdonalds']),
        category: 'Restaurants',
        confidence: 0.85
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['amazon', 'ebay', 'shop', 'store', 'retail']),
        category: 'Shopping',
        confidence: 0.8
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['electric', 'water', 'gas company', 'utility', 'power']),
        category: 'Utilities',
        confidence: 0.9
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['uber', 'lyft', 'taxi', 'bus', 'metro', 'parking']),
        category: 'Transportation',
        confidence: 0.9
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['netflix', 'spotify', 'hulu', 'disney', 'movie', 'theater']),
        category: 'Entertainment',
        confidence: 0.85
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical']),
        category: 'Healthcare',
        confidence: 0.9
      },
      {
        test: () => this.containsKeywords([description, merchantName], ['insurance', 'allstate', 'geico', 'state farm']),
        category: 'Insurance',
        confidence: 0.9
      },
      {
        test: () => amount > 1000 && this.containsKeywords([description], ['payment', 'transfer']),
        category: 'Other',
        confidence: 0.6
      }
    ];

    for (const rule of rules) {
      if (rule.test()) {
        const category = categories.find(c => c.name === rule.category);
        if (category) {
          return {
            categoryId: category.id,
            confidence: rule.confidence,
            reasoning: `Rule-based: matched keywords for ${rule.category}`
          };
        }
      }
    }

    const otherCategory = categories.find(c => c.name === 'Other');
    return {
      categoryId: otherCategory?.id || categories[0]?.id || 'unknown',
      confidence: 0.3,
      reasoning: 'No matching rules found, defaulting to Other'
    };
  }

  private async aiCategorization(
    transaction: Pick<Transaction, 'description' | 'merchantName' | 'merchantCategory' | 'amount'>,
    categories: Category[]
  ): Promise<{ categoryId: string; confidence: number; reasoning?: string }> {
    const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
    
    const prompt = `
You are a financial transaction categorization expert. Given a transaction description and a list of available categories, determine the most appropriate category.

Transaction Details:
- Description: "${transaction.description}"
- Merchant: "${transaction.merchantName || 'Unknown'}"
- Amount: $${Math.abs(transaction.amount).toFixed(2)}
- Merchant Category: "${transaction.merchantCategory || 'Unknown'}"

Available Categories:
${categoryList}

Please respond with ONLY a JSON object in this exact format:
{
  "categoryId": "category_id_here",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category was chosen"
}

The confidence should be between 0 and 1, where 1 is completely certain.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 200
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    try {
      const parsed = JSON.parse(content);
      
      if (!parsed.categoryId || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response format');
      }

      const category = categories.find(c => c.id === parsed.categoryId);
      if (!category) {
        throw new Error('AI selected invalid category');
      }

      return {
        categoryId: parsed.categoryId,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        reasoning: `AI: ${parsed.reasoning}`
      };
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  async bulkCategorizeTransactions(
    transactions: Array<Pick<Transaction, 'id' | 'description' | 'merchantName' | 'merchantCategory' | 'amount'>>,
    userId: string
  ): Promise<Array<{ transactionId: string; categoryId: string; confidence: number }>> {
    const categories = await this.categoryService.getCategoriesByUser(userId);
    const results = [];

    for (const transaction of transactions) {
      try {
        const result = await this.categorizeTransaction(transaction, userId, categories);
        results.push({
          transactionId: transaction.id,
          categoryId: result.categoryId,
          confidence: result.confidence
        });
      } catch (error) {
        console.error(`Failed to categorize transaction ${transaction.id}:`, error);
        const otherCategory = categories.find(c => c.name === 'Other');
        results.push({
          transactionId: transaction.id,
          categoryId: otherCategory?.id || categories[0]?.id || 'unknown',
          confidence: 0.1
        });
      }
    }

    return results;
  }

  private containsKeywords(texts: string[], keywords: string[]): boolean {
    const combinedText = texts.join(' ').toLowerCase();
    return keywords.some(keyword => combinedText.includes(keyword.toLowerCase()));
  }

  async trainFromUserFeedback(
    userId: string,
    transactionDescription: string,
    merchantName: string,
    actualCategoryId: string,
    previousCategoryId?: string
  ): Promise<void> {
    // This could be used to improve the categorization over time
    // For now, we'll just log the feedback for future improvements
    console.log('User feedback received:', {
      userId,
      transactionDescription,
      merchantName,
      actualCategoryId,
      previousCategoryId
    });
  }
}