import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Meal } from '../models';

export const getAllMeals = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { search } = req.query;

    const filter: any = { $or: [{ isCommon: true }, { createdBy: req.user._id }] };
    if (search) {
      filter.$text = { $search: search as string };
    }

    const meals = await Meal.find(filter).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: meals,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get meals',
    });
  }
};

export const getMealById = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const meal = await Meal.findById(id);

    if (!meal) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Meal not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: meal,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get meal',
    });
  }
};

export const getTemplateMeals = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { goal } = req.params;

    if (!goal || !['weight_loss', 'muscle_gain', 'healthy_lifestyle'].includes(goal)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid goal parameter',
      });
    }

    const meals = await Meal.find({ goal, isTemplate: true });
    
    return res.status(200).json({
      success: true,
      data: meals,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get template meals',
    });
  }
};

