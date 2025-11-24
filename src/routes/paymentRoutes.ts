import express from 'express';
import { createVipPayment, handleVipPaymentSuccess } from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.post('/vip/checkout', authenticate as any, createVipPayment as any);

router.post('/vip/success', handleVipPaymentSuccess as any);

export default router;

