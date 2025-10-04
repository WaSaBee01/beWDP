import { PayOS } from '@payos/node';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

const PRICES: Record<'monthly' | 'yearly', number> = {
  monthly: 99000, // 99k VND/tháng
  yearly: 950400, // 99k * 12 * 0.8 = 950.4k VND/năm (giảm 20%)
};

// Create payment checkout
export const createVipPayment = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { type } = req.body as { type?: string }; // 'monthly' or 'yearly'

    if (!type || (type !== 'monthly' && type !== 'yearly')) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Loại gói không hợp lệ. Chọn monthly hoặc yearly',
      });
    }

    const userId = req.user._id;
    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const packageType = type as 'monthly' | 'yearly';
    const amount = PRICES[packageType];

    // Generate unique order code (last 6 digits of timestamp + random 2 digits)
    const orderCode = Number(String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));

    // Create JWT token for verification
    const token = jwt.sign(
      {
        userId: String(userId),
        orderCode,
        type: packageType,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '2h' }
    );

    // Initialize PayOS
    const payOS = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID || '',
      apiKey: process.env.PAYOS_API_KEY || '',
      checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
    });

    const paymentData = {
      amount,
      orderCode,
      description: `Thanh toán VIP - GymNet`,
      returnUrl: `${origin}/pricing/success?token=${token}`,
      cancelUrl: `${origin}/pricing`,
    };
    console.log(`${origin}/pricing/success?token=${token}`);

    try {
      const paymentLinkResponse = await payOS.paymentRequests.create(paymentData);

      return res.status(200).json({
        success: true,
        data: {
          paymentLink: paymentLinkResponse.checkoutUrl,
          amount,
          type: packageType,
        },
      });
    } catch (error) {
      console.error('PayOS error:', error);
      return res.status(400).json({
        error: 'Payment error',
        message: 'Không thể tạo link thanh toán. Vui lòng thử lại.',
      });
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tạo thanh toán',
    });
  }
};

// Handle payment success callback
export const handleVipPaymentSuccess = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Token không hợp lệ',
      });
    }

    // Verify token
    let decoded: { userId?: string; orderCode?: number; type?: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
        userId?: string;
        orderCode?: number;
        type?: string;
      };
    } catch {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }

    const { userId, type } = decoded;

    if (!userId || !type || (type !== 'monthly' && type !== 'yearly')) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Thông tin thanh toán không hợp lệ',
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Không tìm thấy người dùng',
      });
    }

    // Calculate expiration date
    const expiresAt = new Date();

    if (type === 'monthly') {
      // Add 1 month
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      // Add 12 months (1 year)
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // If user already has VIP and not expired, extend from current expiration
    if (user.isVip && user.vipExpiresAt && user.vipExpiresAt > new Date()) {
      expiresAt.setTime(user.vipExpiresAt.getTime());
      if (type === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }
    }

    // Update user VIP status
    user.isVip = true;
    user.vipExpiresAt = expiresAt;
    // Also update subscriptionStatus for backward compatibility
    user.subscriptionStatus = 'premium';
    user.subscriptionExpiresAt = expiresAt;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Thanh toán thành công',
      data: {
        isVip: true,
        vipExpiresAt: expiresAt,
      },
    });
  } catch (error) {
    console.error('Error handling payment success:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể xử lý thanh toán',
    });
  }
};

