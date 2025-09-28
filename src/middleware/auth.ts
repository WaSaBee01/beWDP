import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { verifyToken } from '../services/authService';

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: {
    _id: string;
    email: string;
    name: string;
    role: string;
    subscriptionStatus: string;
    subscriptionExpiresAt?: string;
    isVip?: boolean;
    vipExpiresAt?: string;
    isFirstLogin?: boolean;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-__v');

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
      return;
    }

    // Attach user to request
    req.user = {
      _id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString(),
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt?.toISOString(),
      isFirstLogin: user.isFirstLogin,
    };

    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};
