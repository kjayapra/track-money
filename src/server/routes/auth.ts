import express from 'express';
import { AuthService } from '../services/AuthService';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const authService = new AuthService(req.app.locals.services.database);
    const result = await authService.register(email, name, password);
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const authService = new AuthService(req.app.locals.services.database);
    const result = await authService.login(email, password);
    
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const authService = new AuthService(req.app.locals.services.database);
    const userId = authService.verifyToken(token);
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await authService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;