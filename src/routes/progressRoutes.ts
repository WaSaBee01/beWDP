import express from 'express';
import {
    applyDailyPlan,
    applyWeeklyPlan,
    deleteProgressEntry,
    getProgressEntries,
    getProgressEntryByDate,
    toggleCompletion,
    upsertProgressEntry,
} from '../controllers/progressController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

router.get('/', getProgressEntries as any);
router.get('/:date', getProgressEntryByDate as any);
router.post('/', upsertProgressEntry as any);
router.post('/apply-daily', applyDailyPlan as any);
router.post('/apply-weekly', applyWeeklyPlan as any);
router.post('/toggle-completion', toggleCompletion as any);
router.delete('/:date', deleteProgressEntry as any);

export default router;

