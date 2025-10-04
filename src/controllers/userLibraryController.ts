import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exercise, Meal, Plan, WeeklyPlan } from '../models';

// Helper function to validate decimal with max 2 decimal places
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

export const getUserMeals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search, isCommon } = req.query as {
      search?: string;
      isCommon?: string;
    };

    const filter: any = {
      $or: [{ isCommon: true }, { createdBy: req.user._id }],
    };
    if (isCommon === 'true') filter.$or = [{ isCommon: true }];
    if (isCommon === 'false') filter.$or = [{ createdBy: req.user._id }];
    if (search) filter.$text = { $search: search };

    const items = await Meal.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch {
    return res
      .status(500)
      .json({ error: 'Internal server error', message: 'Failed to get meals' });
  }
};

export const createUserMeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const {
      name,
      description,
      ingredients,
      image,
      calories,
      carbs,
      protein,
      fat,
      weightGrams,
    } = req.body;
    if (
      !name ||
      calories === undefined ||
      carbs === undefined ||
      protein === undefined ||
      fat === undefined ||
      weightGrams === undefined
    ) {
      return res
        .status(400)
        .json({
          error: 'Validation error',
          message:
            'Name, calories, carbs, protein, fat và weightGrams là bắt buộc',
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
      isCommon: false,
      createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: meal });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to create meal',
      });
  }
};

export const updateUserMeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const meal = await Meal.findById(id);
    if (!meal)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Meal not found' });
    if (meal.isCommon)
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Cannot update common meals' });
    if (String(meal.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update other users meals',
        });
    const updateData = req.body;
    // Validate decimal places (max 2) for nutrition values
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
    const updated = await Meal.findByIdAndUpdate(id, updateData, { new: true });
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to update meal',
      });
  }
};

export const deleteUserMeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const meal = await Meal.findById(id);
    if (!meal)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Meal not found' });
    if (meal.isCommon)
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Cannot delete common meals' });
    if (String(meal.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete other users meals',
        });
    await Meal.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: 'Meal deleted successfully' });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to delete meal',
      });
  }
};

export const getUserExercises = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search, isCommon } = req.query as {
      search?: string;
      isCommon?: string;
    };

    const filter: any = {
      $or: [{ isCommon: true }, { createdBy: req.user._id }],
    };
    if (isCommon === 'true') filter.$or = [{ isCommon: true }];
    if (isCommon === 'false') filter.$or = [{ createdBy: req.user._id }];
    if (search) filter.$text = { $search: search };

    const items = await Exercise.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to get exercises',
      });
  }
};

export const createUserExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const {
      name,
      description,
      durationMinutes,
      caloriesBurned,
      videoUrl,
      difficulty = 'basic',
    } = req.body;
    if (
      !name ||
      durationMinutes === undefined ||
      caloriesBurned === undefined
    ) {
      return res
        .status(400)
        .json({
          error: 'Validation error',
          message: 'Name, durationMinutes và caloriesBurned là bắt buộc',
        });
    }
    if (durationMinutes < 0 || caloriesBurned < 0) {
      return res
        .status(400)
        .json({
          error: 'Validation error',
          message: 'Values cannot be negative',
        });
    }
    const exercise = await Exercise.create({
      name,
      description,
      durationMinutes,
      caloriesBurned,
      videoUrl,
      difficulty,
      isCommon: false,
      createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: exercise });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to create exercise',
      });
  }
};

export const updateUserExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const exercise = await Exercise.findById(id);
    if (!exercise)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Exercise not found' });
    if (exercise.isCommon)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update common exercises',
        });
    if (String(exercise.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update other users exercises',
        });
    const updateData = req.body;
    if (
      updateData.durationMinutes !== undefined &&
      updateData.durationMinutes < 0
    )
      return res
        .status(400)
        .json({
          error: 'Validation error',
          message: 'Duration cannot be negative',
        });
    if (
      updateData.caloriesBurned !== undefined &&
      updateData.caloriesBurned < 0
    )
      return res
        .status(400)
        .json({
          error: 'Validation error',
          message: 'Calories burned cannot be negative',
        });
    const updated = await Exercise.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to update exercise',
      });
  }
};

export const deleteUserExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const exercise = await Exercise.findById(id);
    if (!exercise)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Exercise not found' });
    if (exercise.isCommon)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete common exercises',
        });
    if (String(exercise.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete other users exercises',
        });
    await Exercise.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: 'Exercise deleted successfully' });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to delete exercise',
      });
  }
};

export const getUserPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search, isCommon } = req.query as {
      search?: string;
      isCommon?: string;
    };

    const filter: any = {
      $or: [{ isCommon: true }, { createdBy: req.user._id }],
    };
    if (isCommon === 'true') filter.$or = [{ isCommon: true }];
    if (isCommon === 'false') filter.$or = [{ createdBy: req.user._id }];
    if (search) filter.$text = { $search: search };

    const items = await Plan.find(filter)
      .populate('meals.meal')
      .populate('exercises.exercise')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch {
    return res
      .status(500)
      .json({ error: 'Internal server error', message: 'Failed to get plans' });
  }
};

export const createUserPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { name, description, meals, exercises, goal } = req.body as {
      name: string;
      description?: string;
      meals: Array<{ time: string; meal: string }>;
      exercises: Array<{ time: string; exercise: string }>;
      goal?: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle';
    };
    if (!name)
      return res
        .status(400)
        .json({ error: 'Validation error', message: 'Name is required' });
    let caloriesIn = 0,
      carbs = 0,
      protein = 0,
      fat = 0,
      caloriesOut = 0;
    if (Array.isArray(meals)) {
      const mealIds = meals.map((m) => m.meal);
      const mealDocs = await Meal.find({ _id: { $in: mealIds } });
      const idToMeal = new Map(mealDocs.map((m) => [String(m._id), m]));
      meals.forEach((m) => {
        const meal = idToMeal.get(m.meal);
        if (meal) {
          caloriesIn += meal.calories;
          carbs += meal.carbs;
          protein += meal.protein;
          fat += meal.fat;
        }
      });
    }
    if (Array.isArray(exercises)) {
      const exIds = exercises.map((e) => e.exercise);
      const exDocs = await Exercise.find({ _id: { $in: exIds } });
      const idToEx = new Map(exDocs.map((e: any) => [String(e._id), e]));
      exercises.forEach((e) => {
        const ex = idToEx.get(e.exercise);
        if (ex && (ex as any).caloriesBurned)
          caloriesOut += (ex as any).caloriesBurned;
      });
    }
    const plan = await Plan.create({
      name,
      description,
      goal,
      meals,
      exercises,
      isCommon: false,
      createdBy: req.user._id,
      totals: { caloriesIn, carbs, protein, fat, caloriesOut },
    });
    return res.status(201).json({ success: true, data: plan });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to create plan',
      });
  }
};

export const updateUserPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Plan not found' });
    if (plan.isCommon)
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Cannot update common plans' });
    if (String(plan.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update other users plans',
        });
    const updateData = req.body as any;
    if (updateData.meals || updateData.exercises) {
      let caloriesIn = 0,
        carbs = 0,
        protein = 0,
        fat = 0,
        caloriesOut = 0;
      if (Array.isArray(updateData.meals)) {
        const mealIds = updateData.meals.map((m: any) => m.meal);
        const mealDocs = await Meal.find({ _id: { $in: mealIds } });
        const idToMeal = new Map(mealDocs.map((m) => [String(m._id), m]));
        updateData.meals.forEach((m: any) => {
          const meal = idToMeal.get(m.meal);
          if (meal) {
            caloriesIn += meal.calories;
            carbs += meal.carbs;
            protein += meal.protein;
            fat += meal.fat;
          }
        });
      }
      if (Array.isArray(updateData.exercises)) {
        const exIds = updateData.exercises.map((e: any) => e.exercise);
        const exDocs = await Exercise.find({ _id: { $in: exIds } });
        const idToEx = new Map(exDocs.map((e: any) => [String(e._id), e]));
        updateData.exercises.forEach((e: any) => {
          const ex = idToEx.get(e.exercise);
          if (ex && (ex as any).caloriesBurned)
            caloriesOut += (ex as any).caloriesBurned;
        });
      }
      updateData.totals = { caloriesIn, carbs, protein, fat, caloriesOut };
    }
    const updated = await Plan.findByIdAndUpdate(id, updateData, { new: true });
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to update plan',
      });
  }
};

export const deleteUserPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Plan not found' });
    if (plan.isCommon)
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Cannot delete common plans' });
    if (String(plan.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete other users plans',
        });
    await Plan.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: 'Plan deleted successfully' });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to delete plan',
      });
  }
};

export const getUserWeeklyPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search, isCommon } = req.query as {
      search?: string;
      isCommon?: string;
    };

    const filter: any = {
      $or: [{ isCommon: true }, { createdBy: req.user._id }],
    };
    if (isCommon === 'true') filter.$or = [{ isCommon: true }];
    if (isCommon === 'false') filter.$or = [{ createdBy: req.user._id }];
    if (search) filter.$text = { $search: search };

    const items = await WeeklyPlan.find(filter)
      .populate(
        'days.monday days.tuesday days.wednesday days.thursday days.friday days.saturday days.sunday'
      )
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: items });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to get weekly plans',
      });
  }
};

export const createUserWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { name, description, days, goal } = req.body as {
      name: string;
      description?: string;
      days: Record<string, string>;
      goal?: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle';
    };
    if (!name)
      return res
        .status(400)
        .json({ error: 'Validation error', message: 'Name is required' });
    const planIds = Object.values(days || {}).filter(Boolean);
    const plans = planIds.length
      ? await Plan.find({ _id: { $in: planIds } })
      : [];
    const totals = plans.reduce(
      (acc, p) => ({
        caloriesIn: acc.caloriesIn + (p.totals?.caloriesIn || 0),
        carbs: acc.carbs + (p.totals?.carbs || 0),
        protein: acc.protein + (p.totals?.protein || 0),
        fat: acc.fat + (p.totals?.fat || 0),
        caloriesOut: acc.caloriesOut + (p.totals?.caloriesOut || 0),
      }),
      { caloriesIn: 0, carbs: 0, protein: 0, fat: 0, caloriesOut: 0 }
    );
    const wp = await WeeklyPlan.create({
      name,
      description,
      days,
      goal,
      totals,
      isCommon: false,
      createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: wp });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to create weekly plan',
      });
  }
};

export const updateUserWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const wp = await WeeklyPlan.findById(id);
    if (!wp)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Weekly plan not found' });
    if (wp.isCommon)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update common weekly plans',
        });
    if (String(wp.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot update other users weekly plans',
        });
    const updateData = req.body as any;
    if (updateData.days) {
      const planIds = Object.values(updateData.days || {}).filter(Boolean);
      const plans = planIds.length
        ? await Plan.find({ _id: { $in: planIds } })
        : [];
      updateData.totals = plans.reduce(
        (acc, p) => ({
          caloriesIn: acc.caloriesIn + (p.totals?.caloriesIn || 0),
          carbs: acc.carbs + (p.totals?.carbs || 0),
          protein: acc.protein + (p.totals?.protein || 0),
          fat: acc.fat + (p.totals?.fat || 0),
          caloriesOut: acc.caloriesOut + (p.totals?.caloriesOut || 0),
        }),
        { caloriesIn: 0, carbs: 0, protein: 0, fat: 0, caloriesOut: 0 }
      );
    }
    const updated = await WeeklyPlan.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res
        .status(400)
        .json({ error: 'Validation error', message: err.message });
    }
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to update weekly plan',
      });
  }
};

export const deleteUserWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const wp = await WeeklyPlan.findById(id);
    if (!wp)
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Weekly plan not found' });
    if (wp.isCommon)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete common weekly plans',
        });
    if (String(wp.createdBy) !== req.user._id)
      return res
        .status(403)
        .json({
          error: 'Forbidden',
          message: 'Cannot delete other users weekly plans',
        });
    await WeeklyPlan.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: 'Weekly plan deleted successfully' });
  } catch {
    return res
      .status(500)
      .json({
        error: 'Internal server error',
        message: 'Failed to delete weekly plan',
      });
  }
};


