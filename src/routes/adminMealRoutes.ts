import express from 'express';
import { calculateMealNutrition } from '../controllers/aiPlanController';
import { authenticate, requireRole } from '../middleware/auth';
import { createMeal, deleteMeal, getAllMeals, updateMeal } from '../controllers/adminMealController';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', getAllMeals as any);
router.post('/', createMeal as any);
router.put('/:id', updateMeal as any);
router.delete('/:id', deleteMeal as any);

router.post('/ai/calculate-nutrition', calculateMealNutrition as any);

export default router;

