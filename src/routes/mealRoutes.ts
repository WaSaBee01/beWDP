import express from 'express';
import { authenticate } from '../middleware/auth';
import { getAllMeals, getMealById, getTemplateMeals } from '../controllers/mealController';

const router = express.Router();

router.use(authenticate as any);
router.get('/', getAllMeals as any);
router.get('/:id', getMealById as any);
router.get('/templates/:goal', getTemplateMeals as any);

export default router;

