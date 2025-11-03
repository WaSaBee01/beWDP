import express from 'express';
import multer from 'multer';
import {
  acceptDailyPlan,
  acceptWeeklyPlan,
  calculateMealNutrition,
  generateDailyPlan,
  generateWeeklyPlan,
} from '../controllers/aiPlanController';
import {
  createExerciseComment,
  deleteExerciseComment,
  getExerciseComments,
} from '../controllers/commentController';
import { upload, uploadImage } from '../controllers/uploadController';
import {
  createUserExercise,
  createUserMeal,
  createUserPlan,
  createUserWeeklyPlan,
  deleteUserExercise,
  deleteUserMeal,
  deleteUserPlan,
  deleteUserWeeklyPlan,
  getUserExercises,
  getUserMeals,
  getUserPlans,
  getUserWeeklyPlans,
  updateUserExercise,
  updateUserMeal,
  updateUserPlan,
  updateUserWeeklyPlan,
} from '../controllers/userLibraryController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);

const uploadMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'Validation error',
            message: 'Kích thước file không được vượt quá 5MB',
          });
          return;
        }
        res.status(400).json({
          error: 'Validation error',
          message: err.message,
        });
        return;
      }
      res.status(400).json({
        error: 'Validation error',
        message: err.message || 'Lỗi khi tải file',
      });
      return;
    }
    next();
  });
};

router.post('/upload/image', uploadMiddleware, uploadImage as any);

// Meals
router.get('/meals', getUserMeals as any);
router.post('/meals', createUserMeal as any);
router.put('/meals/:id', updateUserMeal as any);
router.delete('/meals/:id', deleteUserMeal as any);

// Exercises
router.get('/exercises', getUserExercises as any);
router.post('/exercises', createUserExercise as any);
router.put('/exercises/:id', updateUserExercise as any);
router.delete('/exercises/:id', deleteUserExercise as any);

// Exercise Comments
router.get('/exercises/:exerciseId/comments', getExerciseComments as any);
router.post('/exercises/:exerciseId/comments', createExerciseComment as any);
router.delete(
  '/exercises/:exerciseId/comments/:commentId',
  deleteExerciseComment as any
);

// Plans
router.get('/plans', getUserPlans as any);
router.post('/plans', createUserPlan as any);
router.put('/plans/:id', updateUserPlan as any);
router.delete('/plans/:id', deleteUserPlan as any);

// AI Plan Generation
router.post('/plans/ai/generate', generateDailyPlan as any);
router.post('/plans/ai/accept', acceptDailyPlan as any);

// Weekly Plans
router.get('/weekly-plans', getUserWeeklyPlans as any);
router.post('/weekly-plans', createUserWeeklyPlan as any);
router.put('/weekly-plans/:id', updateUserWeeklyPlan as any);
router.delete('/weekly-plans/:id', deleteUserWeeklyPlan as any);

// AI Weekly Plan Generation
router.post('/weekly-plans/ai/generate', generateWeeklyPlan as any);
router.post('/weekly-plans/ai/accept', acceptWeeklyPlan as any);

// AI Meal Nutrition Calculation
router.post('/meals/ai/calculate-nutrition', calculateMealNutrition as any);

export default router;


