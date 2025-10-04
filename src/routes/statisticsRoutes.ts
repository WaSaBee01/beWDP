import express from 'express';
import { getMonthlyStatistics, getStatistics, getWeeklyStatistics } from '../controllers/statisticsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

router.get('/', getStatistics as any);
router.get('/weekly', getWeeklyStatistics as any);
router.get('/monthly', getMonthlyStatistics as any);

export default router;

