import express from 'express';
import { createSurvey, getSurvey, updateSurvey } from '../controllers/surveyController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All survey routes require authentication
router.use(authenticate as any);

// Get user's survey
router.get('/', getSurvey as any);

// Create survey
router.post('/', createSurvey as any);

// Update survey
router.put('/', updateSurvey as any);

export default router;