import { Database } from '../database/Database';
import { Category } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class CategoryService {
  constructor(private db: Database) {}

  async createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    const id = uuidv4();
    const now = new Date();

    await this.db.run(`
      INSERT INTO categories (
        id, name, parent_id, color, icon, is_system, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      category.name,
      category.parentId || null,
      category.color,
      category.icon,
      category.isSystem ? 1 : 0,
      category.userId || null,
      now.toISOString(),
      now.toISOString()
    ]);

    return this.getCategoryById(id) as Promise<Category>;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const row = await this.db.get<any>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapRowToCategory(row);
  }

  async getCategoriesByUser(userId: string, includeSystem: boolean = true): Promise<Category[]> {
    let sql = 'SELECT * FROM categories WHERE (user_id = ? OR user_id IS NULL)';
    const params = [userId];

    if (!includeSystem) {
      sql += ' AND is_system = 0';
    }

    sql += ' ORDER BY is_system DESC, name ASC';

    const rows = await this.db.all<any>(sql, params);
    return rows.map(row => this.mapRowToCategory(row));
  }

  async getSystemCategories(): Promise<Category[]> {
    const rows = await this.db.all<any>('SELECT * FROM categories WHERE is_system = 1 ORDER BY name ASC');
    return rows.map(row => this.mapRowToCategory(row));
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }

    if (updates.parentId !== undefined) {
      fields.push('parent_id = ?');
      params.push(updates.parentId);
    }

    if (updates.color !== undefined) {
      fields.push('color = ?');
      params.push(updates.color);
    }

    if (updates.icon !== undefined) {
      fields.push('icon = ?');
      params.push(updates.icon);
    }

    if (fields.length === 0) {
      return this.getCategoryById(id);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await this.db.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getCategoryById(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = await this.getCategoryById(id);
    if (!category || category.isSystem) {
      return false;
    }

    const result = await this.db.run('DELETE FROM categories WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async findCategoryByName(name: string, userId?: string): Promise<Category | null> {
    let sql = 'SELECT * FROM categories WHERE LOWER(name) = LOWER(?)';
    const params = [name];

    if (userId) {
      sql += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(userId);
    }

    sql += ' ORDER BY is_system DESC LIMIT 1';

    const row = await this.db.get<any>(sql, params);
    if (!row) return null;
    return this.mapRowToCategory(row);
  }

  async suggestCategory(description: string, userId?: string): Promise<Category | null> {
    const desc = description.toLowerCase();
    
    const categoryMappings = [
      { keywords: ['grocery', 'supermarket', 'food', 'market'], categoryName: 'Groceries' },
      { keywords: ['gas', 'fuel', 'exxon', 'shell', 'chevron'], categoryName: 'Gas & Fuel' },
      { keywords: ['restaurant', 'cafe', 'coffee', 'mcdonald', 'subway'], categoryName: 'Restaurants' },
      { keywords: ['amazon', 'target', 'store', 'shop'], categoryName: 'Shopping' },
      { keywords: ['electric', 'water', 'utility'], categoryName: 'Utilities' },
      { keywords: ['uber', 'lyft', 'taxi'], categoryName: 'Transportation' },
      { keywords: ['movie', 'theater', 'netflix'], categoryName: 'Entertainment' },
      { keywords: ['pharmacy', 'doctor', 'hospital'], categoryName: 'Healthcare' }
    ];

    for (const mapping of categoryMappings) {
      if (mapping.keywords.some(keyword => desc.includes(keyword))) {
        const category = await this.findCategoryByName(mapping.categoryName, userId);
        if (category) return category;
      }
    }

    return null;
  }

  private mapRowToCategory(row: any): Category {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      color: row.color,
      icon: row.icon,
      isSystem: row.is_system === 1,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}