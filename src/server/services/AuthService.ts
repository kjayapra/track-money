import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from '../database/Database';
import { User } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  constructor(private db: Database) {}

  async register(email: string, name: string, password: string): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await this.db.get<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const userId = uuidv4();
    const now = new Date();
    
    await this.db.run(`
      INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, email, name, hashedPassword, now.toISOString(), now.toISOString()]);

    const user: User = {
      id: userId,
      email,
      name,
      createdAt: now,
      updatedAt: now
    };

    const token = this.generateToken(userId);
    
    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const userRow = await this.db.get<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!userRow) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userRow.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const user: User = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      createdAt: new Date(userRow.created_at),
      updatedAt: new Date(userRow.updated_at)
    };

    const token = this.generateToken(user.id);
    
    return { user, token };
  }

  async getUserById(id: string): Promise<User | null> {
    const userRow = await this.db.get<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!userRow) return null;

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      createdAt: new Date(userRow.created_at),
      updatedAt: new Date(userRow.updated_at)
    };
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'name' | 'email'>>): Promise<User | null> {
    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }

    if (updates.email !== undefined) {
      fields.push('email = ?');
      params.push(updates.email);
    }

    if (fields.length === 0) {
      return this.getUserById(id);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await this.db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getUserById(id);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const userRow = await this.db.get<any>('SELECT password_hash FROM users WHERE id = ?', [id]);
    if (!userRow) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userRow.password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await this.db.run(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [hashedPassword, new Date().toISOString(), id]
    );
  }

  verifyToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret()) as { userId: string };
      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.getJwtSecret(),
      { expiresIn: '7d' }
    );
  }

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }
}