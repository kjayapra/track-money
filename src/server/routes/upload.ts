import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('statement'), async (req, res) => {
  try {
    res.json({ message: 'Upload endpoints to be implemented' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;