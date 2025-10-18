import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { IUser, User } from '../models/User';
import { generateToken } from '../services/authService';

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user data',
    });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to logout',
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void | Response> => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email, name, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Password must be at least 6 characters',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      name,
      password: hashedPassword,
      role: 'user',
      subscriptionStatus: 'free',
      isFirstLogin: true,
    });

    const token = generateToken(newUser as any);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          _id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          subscriptionStatus: newUser.subscriptionStatus,
          isFirstLogin: newUser.isFirstLogin,
        },
        token,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate key',
        message: 'Email already registered',
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register user',
    });
  }
};

// Login with email/password
export const login = async (req: Request, res: Response): Promise<void | Response> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'Invalid email or password',
      });
    }

    // Block if deactivated
    if (user.isActive === false) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị.',
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = generateToken(user as any);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          isFirstLogin: user.isFirstLogin,
        },
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to login',
    });
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`
      );
    }

    const token = generateToken(user as any);

    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`
    );
  } catch (error) {
    res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`
    );
  }
};
