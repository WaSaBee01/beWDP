import express from 'express';
import { addFoodEntry, deleteFoodEntry, getFoodDiaryByDate, updateFoodEntry } from '../controllers/foodDiaryController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All food diary routes require authentication
router.use(authenticate as any);

// Get food diary by date
router.get('/:date', getFoodDiaryByDate as any);

// Add food entry
router.post('/entry', addFoodEntry as any);

// Update food entry
router.put('/entry/:id', updateFoodEntry as any);

// Delete food entry
router.delete('/entry/:id', deleteFoodEntry as any);

export default router;

