import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MealPlan } from '../models';

interface CreateMealPlanRequest {
  weekStartDate: string;
  meals: {
    day: string;
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack?: string;
  }[];
}

export const getAllMealPlans = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const mealPlans = await MealPlan.find({ userId: req.user._id })
      .populate('meals.breakfast meals.lunch meals.dinner meals.snack')
      .sort({ weekStartDate: -1 });

    return res.status(200).json({
      success: true,
      data: mealPlans,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get meal plans',
    });
  }
};

export const createMealPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { weekStartDate, meals }: CreateMealPlanRequest = req.body;

    if (!weekStartDate || !meals || meals.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Week start date and meals are required',
      });
    }

    const mealPlan = await MealPlan.create({
      userId: req.user._id,
      weekStartDate: new Date(weekStartDate),
      meals,
    });

    const populatedPlan = await MealPlan.findById(mealPlan._id).populate(
      'meals.breakfast meals.lunch meals.dinner meals.snack'
    );

    return res.status(201).json({
      success: true,
      data: populatedPlan,
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
      message: 'Failed to create meal plan',
    });
  }
};

export const updateMealPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const mealPlan = await MealPlan.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      updateData,
      { new: true }
    ).populate('meals.breakfast meals.lunch meals.dinner meals.snack');

    if (!mealPlan) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Meal plan not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: mealPlan,
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
      message: 'Failed to update meal plan',
    });
  }
};

export const deleteMealPlan = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const mealPlan = await MealPlan.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!mealPlan) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Meal plan not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Meal plan deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete meal plan',
    });
  }
};

// Helper function to calculate daily totals
export const calculateDailyTotals = (mealPlan: any) => {
  const totals: Record<string, { calories: number; carbs: number; protein: number; fat: number }> = {};

  mealPlan.meals.forEach((dayMeal: any) => {
    const day = dayMeal.day;
    totals[day] = { calories: 0, carbs: 0, protein: 0, fat: 0 };

    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((mealType) => {
      const meal = dayMeal[mealType];
      if (meal && typeof meal === 'object') {
        totals[day].calories += meal.calories || 0;
        totals[day].carbs += meal.carbs || 0;
        totals[day].protein += meal.protein || 0;
        totals[day].fat += meal.fat || 0;
      }
    });
  });

  return totals;
};

