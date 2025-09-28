import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { createPlan, deletePlan, getAllPlans, updatePlan } from '../controllers/adminPlanController';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', getAllPlans as any);
router.post('/', createPlan as any);
router.put('/:id', updatePlan as any);
router.delete('/:id', deletePlan as any);

export default router;


