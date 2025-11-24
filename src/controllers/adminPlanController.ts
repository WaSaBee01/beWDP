import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exercise, Meal, Plan } from '../models';

interface PlanMealInput {
  time: string;
  meal: string;
}
interface PlanExerciseInput {
  time: string;
  exercise: string;
}

export const getAllPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search } = req.query as { search?: string };
    const filter: any = {
      isCommon: true, 
    };
    if (search) filter.$text = { $search: search };
    const plans = await Plan.find(filter)
      .populate('createdBy', 'name email')
      .populate('meals.meal')
      .populate('exercises.exercise');
    return res.status(200).json({ success: true, data: plans });
  } catch {
    return res
      .status(500)
      .json({ error: 'Internal server error', message: 'Failed to get plans' });
  }
};

export const createPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { name, description, meals, exercises, goal }: { name: string; description?: string; meals: PlanMealInput[]; exercises: PlanExerciseInput[]; goal?: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle' } = req.body;
    if (!name) return res.status(400).json({ error: 'Validation error', message: 'Name is required' });

    let caloriesIn = 0, carbs = 0, protein = 0, fat = 0, caloriesOut = 0;
    if (Array.isArray(meals)) {
      const mealIds = meals.map(m => m.meal);
      const mealDocs = await Meal.find({ _id: { $in: mealIds } });
      const idToMeal = new Map(mealDocs.map(m => [String(m._id), m]));
      meals.forEach(m => {
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
      const exIds = exercises.map(e => e.exercise);
      const exDocs = await Exercise.find({ _id: { $in: exIds } });
      const idToEx = new Map(exDocs.map(e => [String(e._id), e]));
      exercises.forEach(e => {
        const ex = idToEx.get(e.exercise);
        if (ex) caloriesOut += ex.caloriesBurned;
      });
    }

    const plan = await Plan.create({
      name,
      description,
      goal,
      meals,
      exercises,
      isCommon: req.user.role === 'admin',
      createdBy: req.user._id,
      totals: { caloriesIn, carbs, protein, fat, caloriesOut },
    });
    return res.status(201).json({ success: true, data: plan });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', message: (err as { message?: string }).message });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create plan' });
  }
};
export const deletePlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ error: 'Not found', message: 'Plan not found' });
    return res.status(200).json({ success: true, message: ' deleted successfully' });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete plan' });
  }
};

export const updatePlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { id } = req.params;
    const updateData = req.body;

    // Recompute totals if meals/exercises provided
    if (updateData.meals || updateData.exercises) {
      let caloriesIn = 0, carbs = 0, protein = 0, fat = 0, caloriesOut = 0;
      if (Array.isArray(updateData.meals)) {
        const mealIds = updateData.meals.map((m: PlanMealInput) => m.meal);
        const mealDocs = await Meal.find({ _id: { $in: mealIds } });
        const idToMeal = new Map(mealDocs.map(m => [String(m._id), m]));
        updateData.meals.forEach((m: PlanMealInput) => {
          const meal = idToMeal.get(m.meal);
          if (meal) { caloriesIn += meal.calories; carbs += meal.carbs; protein += meal.protein; fat += meal.fat; }
        });
      }
      if (Array.isArray(updateData.exercises)) {
        const exIds = updateData.exercises.map((e: PlanExerciseInput) => e.exercise);
        const exDocs = await Exercise.find({ _id: { $in: exIds } });
        const idToEx = new Map(exDocs.map(e => [String(e._id), e]));
        updateData.exercises.forEach((e: PlanExerciseInput) => {
          const ex = idToEx.get(e.exercise);
          if (ex) caloriesOut += ex.caloriesBurned;
        });
      }
      updateData.totals = { caloriesIn, carbs, protein, fat, caloriesOut };
    }

    const plan = await Plan.findByIdAndUpdate(id, updateData, { new: true });
    if (!plan) return res.status(404).json({ error: 'Not found', message: 'Plan not found' });
    return res.status(200).json({ success: true, data: plan });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'update failed' });
  }
};



