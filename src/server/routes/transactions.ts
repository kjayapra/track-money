import express from 'express';

const router = express.Router();

// Get transactions
router.get('/', async (req, res) => {
  try {
    // TODO: Implement transaction endpoints
    res.json({ message: 'Transaction endpoints to be implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;