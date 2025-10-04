import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { createWeeklyPlan, deleteWeeklyPlan, getAllWeeklyPlans, updateWeeklyPlan } from '../controllers/adminWeeklyPlanController';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', getAllWeeklyPlans as any);
router.post('/', createWeeklyPlan as any);
router.put('/:id', updateWeeklyPlan as any);
router.delete('/:id', deleteWeeklyPlan as any);

export default router;


