import express from 'express';
import { createMealPlan, deleteMealPlan, getAllMealPlans, updateMealPlan } from '../controllers/mealPlanController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

router.get('/', getAllMealPlans as any);
router.post('/', createMealPlan as any);
router.put('/:id', updateMealPlan as any);
router.delete('/:id', deleteMealPlan as any);

export default router;

