import express from 'express';
import { addFoodEntry, deleteFoodEntry, getFoodDiaryByDate, updateFoodEntry } from '../controllers/foodDiaryController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);
router.get('/:date', getFoodDiaryByDate as any);
router.post('/entry', addFoodEntry as any);
router.put('/entry/:id', updateFoodEntry as any);
router.delete('/entry/:id', deleteFoodEntry as any);

export default router;

