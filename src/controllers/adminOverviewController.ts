import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exercise, Meal, Plan, User, WeeklyPlan } from '../models';

export const getOverview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });

    const [usersActive, exercises, meals, dailyPlans, weeklyPlans] = await Promise.all([
      // Tính người dùng active: coi như active nếu isActive=true hoặc chưa có trường (legacy)
      User.countDocuments({ role: 'user', $or: [{ isActive: true }, { isActive: { $exists: false } }] }),
      Exercise.countDocuments({}),
      Meal.countDocuments({}),
      Plan.countDocuments({}),
      WeeklyPlan.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        usersActive,
        exercises,
        meals,
        dailyPlans,
        weeklyPlans,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to get overview' });
  }
};


