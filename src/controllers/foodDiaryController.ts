import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FoodEntry } from '../models';

interface CreateFoodEntryRequest {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealId?: string;
  customMeal?: {
    name: string;
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
  };
}

export const getFoodDiaryByDate = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { date } = req.params;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const entries = await FoodEntry.find({
      userId: req.user._id,
      date: targetDate,
    }).populate('mealId');

    const dailyTotals = {
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
    };

    entries.forEach((entry) => {
      if (entry.mealId && typeof entry.mealId === 'object') {
        const meal = entry.mealId as any;
        dailyTotals.calories += meal.calories || 0;
        dailyTotals.carbs += meal.carbs || 0;
        dailyTotals.protein += meal.protein || 0;
        dailyTotals.fat += meal.fat || 0;
      } else if (entry.customMeal) {
        dailyTotals.calories += entry.customMeal.calories || 0;
        dailyTotals.carbs += entry.customMeal.carbs || 0;
        dailyTotals.protein += entry.customMeal.protein || 0;
        dailyTotals.fat += entry.customMeal.fat || 0;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        entries,
        totals: dailyTotals,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get food diary',
    });
  }
};

export const addFoodEntry = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { date, mealType, mealId, customMeal }: CreateFoodEntryRequest = req.body;

    if (!date || !mealType) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Date and meal type are required',
      });
    }

    if (!mealId && !customMeal) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Either mealId or customMeal is required',
      });
    }

    if (customMeal) {
      if (!customMeal.name || customMeal.calories === undefined) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Custom meal must have name and calories',
        });
      }
    }

    const entry = await FoodEntry.create({
      userId: req.user._id,
      date: new Date(date),
      mealType,
      mealId: mealId || undefined,
      customMeal: customMeal || undefined,
    });

    const populatedEntry = await FoodEntry.findById(entry._id).populate('mealId');

    return res.status(201).json({
      success: true,
      data: populatedEntry,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add food entry',
    });
  }
};

export const updateFoodEntry = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const entry = await FoodEntry.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      updateData,
      { new: true }
    ).populate('mealId');

    if (!entry) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Food entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update food entry',
    });
  }
};

export const deleteFoodEntry = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const entry = await FoodEntry.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!entry) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Food entry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Food entry deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete food entry',
    });
  }
};

