import express from 'express';
import { createSurvey, getSurvey, updateSurvey } from '../controllers/surveyController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

router.get('/', getSurvey as any);

router.post('/', createSurvey as any);

router.put('/', updateSurvey as any);

export default router;