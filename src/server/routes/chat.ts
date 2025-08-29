import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    const chatService = req.app.locals.services.chatService;
    
    // For demo purposes, using a dummy user ID
    const userId = 'demo-user';
    const response = await chatService.processMessage(userId, message);
    
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;