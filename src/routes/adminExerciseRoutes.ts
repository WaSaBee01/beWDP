import express from 'express';
import {
  createExercise,
  deleteExercise,
  getAllExercises,
  updateExercise,
} from '../controllers/adminExerciseController';
import {
  createExerciseComment,
  deleteExerciseComment,
  getExerciseComments,
} from '../controllers/commentController';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', getAllExercises as any);
router.post('/', createExercise as any);
router.put('/:id', updateExercise as any);
router.delete('/:id', deleteExercise as any);

// Exercise Comments (admin can also view and reply)
router.get('/:exerciseId/comments', getExerciseComments as any);
router.post('/:exerciseId/comments', createExerciseComment as any);
router.delete('/:exerciseId/comments/:commentId', deleteExerciseComment as any);

export default router;
