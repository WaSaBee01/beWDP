import express from 'express';
import { authenticate } from '../middleware/auth';
import { getAllMeals, getMealById, getTemplateMeals } from '../controllers/mealController';

const router = express.Router();

// All meal routes require authentication
router.use(authenticate as any);

// Get all meals
router.get('/', getAllMeals as any);

// Get meal by ID
router.get('/:id', getMealById as any);

// Get template meals by goal
router.get('/templates/:goal', getTemplateMeals as any);

export default router;

