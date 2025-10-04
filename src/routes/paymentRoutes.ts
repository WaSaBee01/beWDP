import express from 'express';
import { createVipPayment, handleVipPaymentSuccess } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Create VIP payment checkout (requires auth)
router.post('/vip/checkout', authenticate as any, createVipPayment as any);

// Handle VIP payment success callback (public, but validates token)
router.post('/vip/success', handleVipPaymentSuccess as any);

export default router;

