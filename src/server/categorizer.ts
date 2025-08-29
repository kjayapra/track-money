import { Database, Category } from './database';

export interface CategorizationResult {
  categoryId: string;
  confidence: number;
  reasoning: string;
}

export class TransactionCategorizer {
  private categories: Map<string, Category> = new Map();

  constructor(private db: Database) {
    this.loadCategories();
  }

  private async loadCategories() {
    try {
      const categories = await this.db.all<Category>('SELECT * FROM categories');
      this.categories.clear();
      categories.forEach(cat => this.categories.set(cat.id, cat));
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async categorizeTransaction(description: string, merchantName?: string): Promise<CategorizationResult> {
    const text = (description + ' ' + (merchantName || '')).toLowerCase();
    
    // Rule-based categorization
    const rules = [
      {
        categoryId: 'groceries',
        keywords: ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'safeway', 'kroger', 'food', 'market'],
        confidence: 0.9
      },
      {
        categoryId: 'gas',
        keywords: ['gas', 'fuel', 'shell', 'exxon', 'chevron', 'bp', '76', 'mobil', 'station'],
        confidence: 0.9
      },
      {
        categoryId: 'restaurants',
        keywords: ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'taco', 'subway', 'mcdonald', 'starbucks', 'kfc', 'dining'],
        confidence: 0.85
      },
      {
        categoryId: 'shopping',
        keywords: ['amazon', 'ebay', 'shop', 'store', 'retail', 'mall', 'outlet', 'department'],
        confidence: 0.8
      },
      {
        categoryId: 'utilities',
        keywords: ['electric', 'water', 'gas company', 'utility', 'power', 'energy', 'pge', 'edison'],
        confidence: 0.9
      },
      {
        categoryId: 'transport',
        keywords: ['uber', 'lyft', 'taxi', 'bus', 'metro', 'transit', 'parking', 'toll'],
        confidence: 0.85
      },
      {
        categoryId: 'entertainment',
        keywords: ['netflix', 'spotify', 'hulu', 'disney', 'movie', 'theater', 'cinema', 'concert', 'game'],
        confidence: 0.85
      },
      {
        categoryId: 'healthcare',
        keywords: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical', 'clinic', 'health'],
        confidence: 0.9
      },
      {
        categoryId: 'travel',
        keywords: ['airline', 'hotel', 'booking', 'expedia', 'airbnb', 'flight', 'airport'],
        confidence: 0.85
      }
    ];

    // Find the best matching rule
    for (const rule of rules) {
      const matchCount = rule.keywords.filter(keyword => text.includes(keyword)).length;
      if (matchCount > 0) {
        const category = this.categories.get(rule.categoryId);
        if (category) {
          return {
            categoryId: rule.categoryId,
            confidence: rule.confidence * (matchCount / rule.keywords.length),
            reasoning: `Matched keywords: ${rule.keywords.filter(k => text.includes(k)).join(', ')}`
          };
        }
      }
    }

    // Default to 'other' category
    return {
      categoryId: 'other',
      confidence: 0.3,
      reasoning: 'No specific category rules matched, defaulted to Other'
    };
  }

  async getAllCategories(): Promise<Category[]> {
    await this.loadCategories(); // Refresh categories
    return Array.from(this.categories.values());
  }

  getCategoryById(id: string): Category | undefined {
    return this.categories.get(id);
  }
}