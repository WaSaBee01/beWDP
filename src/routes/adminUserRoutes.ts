import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { listUsers, setActive } from '../controllers/adminUserController';

const router = express.Router();

router.use(authenticate as any);
router.use(requireRole('admin') as any);

router.get('/', listUsers as any);
router.put('/:id/active', setActive as any);

export default router;


