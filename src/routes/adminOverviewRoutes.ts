import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getOverview } from '../controllers/adminOverviewController';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', getOverview as any);

export default router;


