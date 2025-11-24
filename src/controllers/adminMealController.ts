import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Meal } from '../models';

const validateDecimal = (value: number, fieldName: string): string | null => {
  if (value < 0) {
    return `${fieldName} cannot be negative`;
  }
  const decimalPart = value.toString().split('.')[1];
  if (decimalPart && decimalPart.length > 2) {
    return `${fieldName} can only have up to 2 decimal places`;
  }
  return null;
};

interface Ingredient {
  name: string;
  weightGram: number;
}

interface CreateMealRequest {
  name: string;
  description?: string;
  ingredients?: Ingredient[];
  image?: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  weightGrams: number;
}

export const getAllMeals = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { search, isTemplate, goal } = req.query as {
      search?: string;
      isTemplate?: string;
      goal?: string;
    };

    const filter: Record<string, unknown> = {
      isCommon: true,
    };

    if (isTemplate !== undefined) {
      filter.isTemplate = isTemplate === 'true';
    }

    if (goal) {
      filter.goal = goal;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const meals = await Meal.find(filter).populate('createdBy', 'name email');
    
    return res.status(200).json({
      success: true,
      data: meals,
    });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get meals',
    });
  }
};

//create meal
export const createMeal = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { name, description, ingredients, image, calories, carbs, protein, fat, weightGrams }: CreateMealRequest = req.body;

    if (
      !name ||
      calories === undefined ||
      carbs === undefined ||
      protein === undefined ||
      fat === undefined ||
      weightGrams === undefined
    ) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name, calories, carbs, protein, fat và weightGrams là bắt buộc',
      });
    }

    // Validate decimal places (max 2)
    const caloriesError = validateDecimal(calories, 'Calories');
    if (caloriesError) {
      return res.status(400).json({ error: 'Validation error', message: caloriesError });
    }
    const carbsError = validateDecimal(carbs, 'Carbs');
    if (carbsError) {
      return res.status(400).json({ error: 'Validation error', message: carbsError });
    }
    const proteinError = validateDecimal(protein, 'Protein');
    if (proteinError) {
      return res.status(400).json({ error: 'Validation error', message: proteinError });
    }
    const fatError = validateDecimal(fat, 'Fat');
    if (fatError) {
      return res.status(400).json({ error: 'Validation error', message: fatError });
    }
    const weightError = validateDecimal(weightGrams, 'Weight');
    if (weightError) {
      return res.status(400).json({ error: 'Validation error', message: weightError });
    }

    const meal = await Meal.create({
      name,
      description,
      ingredients,
      image,
      calories,
      carbs,
      protein,
      fat,
      weightGrams,
      isCommon: true,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      data: meal,
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: (err as { message?: string }).message || 'Validation error',
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create meal',
    });
  }
};

export const deleteMeal = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;

    const meal = await Meal.findByIdAndDelete(id);

    if (!meal) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Meal not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Meal deleted successfully',
    });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete meal',
    });
  }
};

// Update an existing meal
export const updateMeal = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    if (updateData.calories !== undefined) {
      const error = validateDecimal(updateData.calories, 'Calories');
      if (error) {
        return res.status(400).json({ error: 'Validation error', message: error });
      }
    }
    if (updateData.carbs !== undefined) {
      const error = validateDecimal(updateData.carbs, 'Carbs');
      if (error) {
        return res.status(400).json({ error: 'Validation error', message: error });
      }
    }
    if (updateData.protein !== undefined) {
      const error = validateDecimal(updateData.protein, 'Protein');
      if (error) {
        return res.status(400).json({ error: 'Validation error', message: error });
      }
    }
    if (updateData.fat !== undefined) {
      const error = validateDecimal(updateData.fat, 'Fat');
      if (error) {
        return res.status(400).json({ error: 'Validation error', message: error });
      }
    }
    if (updateData.weightGrams !== undefined) {
      const error = validateDecimal(updateData.weightGrams, 'Weight');
      if (error) {
        return res.status(400).json({ error: 'Validation error', message: error });
      }
    }

    const meal = await Meal.findByIdAndUpdate(id, updateData, { new: true });

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
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: (err as { message?: string }).message || 'Validation error',
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update meal',
    });
  }
};


