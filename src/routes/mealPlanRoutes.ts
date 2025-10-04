import express from 'express';
import { createMealPlan, deleteMealPlan, getAllMealPlans, updateMealPlan } from '../controllers/mealPlanController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All meal plan routes require authentication
router.use(authenticate as any);

// Meal plan routes
router.get('/', getAllMealPlans as any);
router.post('/', createMealPlan as any);
router.put('/:id', updateMealPlan as any);
router.delete('/:id', deleteMealPlan as any);

export default router;

