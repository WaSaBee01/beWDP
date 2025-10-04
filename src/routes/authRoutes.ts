import express from 'express';
import passport from 'passport';
import { getCurrentUser, googleCallback, login, logout, register } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Email/Password routes
router.post('/register', register as any);
router.post('/login', login as any);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  googleCallback as any
);

// Protected routes
router.get('/me', authenticate as any, getCurrentUser as any);
router.post('/logout', authenticate as any, logout as any);

export default router;
