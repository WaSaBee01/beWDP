import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Plan, ProgressEntry, WeeklyPlan } from '../models';
import { isWithinReminderWindow } from '../utils/dateHelpers';
import { refreshRemindersForDate } from '../utils/reminderScheduler';

export const getProgressEntries = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const filter: Record<string, unknown> = { userId: req.user._id };
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);

      filter.date = {
        $gte: start,
        $lte: end,
      };
    }

    const entries = await ProgressEntry.find(filter)
      .populate('meals.mealId')
      .populate('exercises.exerciseId')
      .sort({ date: 1 });

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get progress entries',
    });
  }
};

export const getProgressEntryByDate = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date } = req.params;
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOne({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    if (!entry) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Progress entry not found' });
    }

    return res.status(200).json({ success: true, data: entry });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get progress entry',
    });
  }
};

export const upsertProgressEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date, meals, exercises, planId, planType, notes } = req.body as {
      date: string;
      meals?: Array<{ time: string; mealId: string; completed?: boolean }>;
      exercises?: Array<{
        time: string;
        exerciseId: string;
        completed?: boolean;
      }>;
      planId?: string;
      planType?: 'daily' | 'weekly';
      notes?: string;
    };

    if (!date) {
      return res
        .status(400)
        .json({ error: 'Validation error', message: 'Date is required' });
    }

    const entryDate = new Date(date + 'T00:00:00.000Z');
    const normalizedDate = new Date(
      Date.UTC(
        entryDate.getUTCFullYear(),
        entryDate.getUTCMonth(),
        entryDate.getUTCDate()
      )
    );

    const updateData: Record<string, unknown> = {
      userId: req.user._id,
      date: normalizedDate,
    };

    if (meals !== undefined) {
      updateData.meals = meals.map((m) => ({
        time: m.time,
        mealId: new mongoose.Types.ObjectId(m.mealId),
        completed: m.completed || false,
      }));
    }

    if (exercises !== undefined) {
      updateData.exercises = exercises.map((e) => ({
        time: e.time,
        exerciseId: new mongoose.Types.ObjectId(e.exerciseId),
        completed: e.completed || false,
      }));
    }

    if (planId) updateData.planId = new mongoose.Types.ObjectId(planId);
    if (planType) updateData.planType = planType;
    if (notes !== undefined) updateData.notes = notes;

    const startOfDay = new Date(normalizedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOneAndUpdate(
      {
        userId: req.user._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
      updateData,
      { upsert: true, new: true }
    )
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    if (entry && isWithinReminderWindow(entry.date)) {
      await refreshRemindersForDate(req.user._id, entry.date);
    }

    return res.status(200).json({ success: true, data: entry });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: (err as { message?: string }).message,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to save progress entry',
    });
  }
};

export const applyDailyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { planId, startDate, endDate } = req.body as {
      planId: string;
      startDate: string;
      endDate: string;
    };

    if (!planId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Plan ID, start date and end date are required',
      });
    }

    const plan = await Plan.findById(planId)
      .populate('meals.meal')
      .populate('exercises.exercise');
    if (!plan) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Plan not found' });
    }

    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const entries = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const entryDate = new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate()
        )
      );

      const meals = plan.meals.map(
        (m: { time: string; meal: { _id?: unknown } | unknown }) => ({
          time: m.time,
          mealId: (m.meal as { _id?: unknown })?._id || m.meal,
          completed: false,
        })
      );

      const exercises = plan.exercises.map(
        (e: { time: string; exercise: { _id?: unknown } | unknown }) => ({
          time: e.time,
          exerciseId: (e.exercise as { _id?: unknown })?._id || e.exercise,
          completed: false,
        })
      );

      const entry = await ProgressEntry.findOneAndUpdate(
        { userId: req.user._id, date: entryDate },
        {
          userId: req.user._id,
          date: entryDate,
          meals,
          exercises,
          planId: plan._id,
          planType: 'daily',
        },
        { upsert: true, new: true }
      )
        .populate('meals.mealId')
        .populate('exercises.exerciseId');

      entries.push(entry);
      if (entry && isWithinReminderWindow(entry.date)) {
        await refreshRemindersForDate(req.user._id, entry.date);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to apply daily plan',
    });
  }
};

// Apply weekly plan to week
export const applyWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { weeklyPlanId, weekStartDate } = req.body as {
      weeklyPlanId: string;
      weekStartDate: string;
    };

    if (!weeklyPlanId || !weekStartDate) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Weekly plan ID and week start date are required',
      });
    }

    const weeklyPlan = await WeeklyPlan.findById(weeklyPlanId);
    if (!weeklyPlan) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Weekly plan not found' });
    }

    // Parse date - frontend sends the actual start date for the weekly plan
    const inputDateStr = weekStartDate.split('T')[0]; // Extract date part if timestamp
    const startDate = new Date(inputDateStr + 'T00:00:00.000Z');
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid week start date',
      });
    }

    // Map day index (0-6) to day keys, where 0 = Monday, 6 = Sunday
    const days: Array<
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday'
    > = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    const entries = [];

    // Loop through 7 days starting from provided start date
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(
        Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate() + i,
          0,
          0,
          0,
          0
        )
      );

      // Map i (0-6) to day keys: 0=monday, 1=tuesday, ..., 6=sunday
      const dayKey = days[i] as keyof typeof weeklyPlan.days;
      const dayPlanId = weeklyPlan.days[dayKey];

      if (dayPlanId) {
        const dayPlan = await Plan.findById(dayPlanId)
          .populate('meals.meal')
          .populate('exercises.exercise');
        if (dayPlan) {
          const meals = dayPlan.meals.map(
            (m: { time: string; meal: { _id?: unknown } | unknown }) => ({
              time: m.time,
              mealId: (m.meal as { _id?: unknown })?._id || m.meal,
              completed: false,
            })
          );

          const exercises = dayPlan.exercises.map(
            (e: { time: string; exercise: { _id?: unknown } | unknown }) => ({
              time: e.time,
              exerciseId: (e.exercise as { _id?: unknown })?._id || e.exercise,
              completed: false,
            })
          );

          const entry = await ProgressEntry.findOneAndUpdate(
            { userId: req.user._id, date: currentDate },
            {
              userId: req.user._id,
              date: currentDate,
              meals,
              exercises,
              planId: weeklyPlan._id,
              planType: 'weekly',
            },
            { upsert: true, new: true }
          )
            .populate('meals.mealId')
            .populate('exercises.exerciseId');

          entries.push(entry);
          if (entry && isWithinReminderWindow(entry.date)) {
            await refreshRemindersForDate(req.user._id, entry.date);
          }
        }
      }
    }

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to apply weekly plan',
    });
  }
};

// Toggle completion status
export const toggleCompletion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date, type, index } = req.body as {
      date: string;
      type: 'meal' | 'exercise';
      index: number;
    };

    if (!date || type === undefined || index === undefined) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Date, type and index are required',
      });
    }

    // Parse date and normalize to UTC to avoid timezone issues
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Use range query to handle timezone issues
    const entry = await ProgressEntry.findOne({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    // If entry doesn't exist, return error - entry should be created first via apply plan or edit day
    if (!entry) {
      return res.status(404).json({
        error: 'Not found',
        message:
          'Progress entry not found. Please add meals/exercises for this day first.',
      });
    }

    if (type === 'meal') {
      if (!entry.meals || !entry.meals[index]) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Meal at index ${index} not found`,
        });
      }
      entry.meals[index].completed = !entry.meals[index].completed;
    } else {
      if (!entry.exercises || !entry.exercises[index]) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Exercise at index ${index} not found`,
        });
      }
      entry.exercises[index].completed = !entry.exercises[index].completed;
    }

    await entry.save();

    const updated = await ProgressEntry.findById(entry._id)
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    return res.status(200).json({ success: true, data: updated });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Failed to toggle completion';
    return res
      .status(500)
      .json({ error: 'Internal server error', message: errorMessage });
  }
};

// Delete progress entry
export const deleteProgressEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date } = req.params;
    // Parse date and normalize to UTC to avoid timezone issues
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOneAndDelete({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
    if (!entry) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Progress entry not found' });
    }

    if (isWithinReminderWindow(entry.date)) {
      await refreshRemindersForDate(req.user._id, entry.date);
    }

    return res
      .status(200)
      .json({ success: true, message: 'Progress entry deleted successfully' });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete progress entry',
    });
  }
};



import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Plan, ProgressEntry, WeeklyPlan } from '../models';
import { isWithinReminderWindow } from '../utils/dateHelpers';
import { refreshRemindersForDate } from '../utils/reminderScheduler';

export const getProgressEntries = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { startDate, endDate } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    const filter: Record<string, unknown> = { userId: req.user._id };
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);

      filter.date = {
        $gte: start,
        $lte: end,
      };
    }

    const entries = await ProgressEntry.find(filter)
      .populate('meals.mealId')
      .populate('exercises.exerciseId')
      .sort({ date: 1 });

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get progress entries',
    });
  }
};

export const getProgressEntryByDate = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date } = req.params;
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOne({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    if (!entry) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Progress entry not found' });
    }

    return res.status(200).json({ success: true, data: entry });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get progress entry',
    });
  }
};

export const upsertProgressEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date, meals, exercises, planId, planType, notes } = req.body as {
      date: string;
      meals?: Array<{ time: string; mealId: string; completed?: boolean }>;
      exercises?: Array<{
        time: string;
        exerciseId: string;
        completed?: boolean;
      }>;
      planId?: string;
      planType?: 'daily' | 'weekly';
      notes?: string;
    };

    if (!date) {
      return res
        .status(400)
        .json({ error: 'Validation error', message: 'Date is required' });
    }

    const entryDate = new Date(date + 'T00:00:00.000Z');
    const normalizedDate = new Date(
      Date.UTC(
        entryDate.getUTCFullYear(),
        entryDate.getUTCMonth(),
        entryDate.getUTCDate()
      )
    );

    const updateData: Record<string, unknown> = {
      userId: req.user._id,
      date: normalizedDate,
    };

    if (meals !== undefined) {
      updateData.meals = meals.map((m) => ({
        time: m.time,
        mealId: new mongoose.Types.ObjectId(m.mealId),
        completed: m.completed || false,
      }));
    }

    if (exercises !== undefined) {
      updateData.exercises = exercises.map((e) => ({
        time: e.time,
        exerciseId: new mongoose.Types.ObjectId(e.exerciseId),
        completed: e.completed || false,
      }));
    }

    if (planId) updateData.planId = new mongoose.Types.ObjectId(planId);
    if (planType) updateData.planType = planType;
    if (notes !== undefined) updateData.notes = notes;

    const startOfDay = new Date(normalizedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOneAndUpdate(
      {
        userId: req.user._id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      },
      updateData,
      { upsert: true, new: true }
    )
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    if (entry && isWithinReminderWindow(entry.date)) {
      await refreshRemindersForDate(req.user._id, entry.date);
    }

    return res.status(200).json({ success: true, data: entry });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: (err as { message?: string }).message,
      });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to save progress entry',
    });
  }
};

export const applyDailyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { planId, startDate, endDate } = req.body as {
      planId: string;
      startDate: string;
      endDate: string;
    };

    if (!planId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Plan ID, start date and end date are required',
      });
    }

    const plan = await Plan.findById(planId)
      .populate('meals.meal')
      .populate('exercises.exercise');
    if (!plan) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Plan not found' });
    }

    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const entries = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const entryDate = new Date(
        Date.UTC(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth(),
          currentDate.getUTCDate()
        )
      );

      const meals = plan.meals.map(
        (m: { time: string; meal: { _id?: unknown } | unknown }) => ({
          time: m.time,
          mealId: (m.meal as { _id?: unknown })?._id || m.meal,
          completed: false,
        })
      );

      const exercises = plan.exercises.map(
        (e: { time: string; exercise: { _id?: unknown } | unknown }) => ({
          time: e.time,
          exerciseId: (e.exercise as { _id?: unknown })?._id || e.exercise,
          completed: false,
        })
      );

      const entry = await ProgressEntry.findOneAndUpdate(
        { userId: req.user._id, date: entryDate },
        {
          userId: req.user._id,
          date: entryDate,
          meals,
          exercises,
          planId: plan._id,
          planType: 'daily',
        },
        { upsert: true, new: true }
      )
        .populate('meals.mealId')
        .populate('exercises.exerciseId');

      entries.push(entry);
      if (entry && isWithinReminderWindow(entry.date)) {
        await refreshRemindersForDate(req.user._id, entry.date);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to apply daily plan',
    });
  }
};

// Apply weekly plan to week
export const applyWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { weeklyPlanId, weekStartDate } = req.body as {
      weeklyPlanId: string;
      weekStartDate: string;
    };

    if (!weeklyPlanId || !weekStartDate) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Weekly plan ID and week start date are required',
      });
    }

    const weeklyPlan = await WeeklyPlan.findById(weeklyPlanId);
    if (!weeklyPlan) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Weekly plan not found' });
    }

    // Parse date - frontend sends the actual start date for the weekly plan
    const inputDateStr = weekStartDate.split('T')[0]; // Extract date part if timestamp
    const startDate = new Date(inputDateStr + 'T00:00:00.000Z');
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid week start date',
      });
    }

    // Map day index (0-6) to day keys, where 0 = Monday, 6 = Sunday
    const days: Array<
      | 'monday'
      | 'tuesday'
      | 'wednesday'
      | 'thursday'
      | 'friday'
      | 'saturday'
      | 'sunday'
    > = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    const entries = [];

    // Loop through 7 days starting from provided start date
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(
        Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate() + i,
          0,
          0,
          0,
          0
        )
      );

      // Map i (0-6) to day keys: 0=monday, 1=tuesday, ..., 6=sunday
      const dayKey = days[i] as keyof typeof weeklyPlan.days;
      const dayPlanId = weeklyPlan.days[dayKey];

      if (dayPlanId) {
        const dayPlan = await Plan.findById(dayPlanId)
          .populate('meals.meal')
          .populate('exercises.exercise');
        if (dayPlan) {
          const meals = dayPlan.meals.map(
            (m: { time: string; meal: { _id?: unknown } | unknown }) => ({
              time: m.time,
              mealId: (m.meal as { _id?: unknown })?._id || m.meal,
              completed: false,
            })
          );

          const exercises = dayPlan.exercises.map(
            (e: { time: string; exercise: { _id?: unknown } | unknown }) => ({
              time: e.time,
              exerciseId: (e.exercise as { _id?: unknown })?._id || e.exercise,
              completed: false,
            })
          );

          const entry = await ProgressEntry.findOneAndUpdate(
            { userId: req.user._id, date: currentDate },
            {
              userId: req.user._id,
              date: currentDate,
              meals,
              exercises,
              planId: weeklyPlan._id,
              planType: 'weekly',
            },
            { upsert: true, new: true }
          )
            .populate('meals.mealId')
            .populate('exercises.exerciseId');

          entries.push(entry);
          if (entry && isWithinReminderWindow(entry.date)) {
            await refreshRemindersForDate(req.user._id, entry.date);
          }
        }
      }
    }

    return res.status(200).json({ success: true, data: entries });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to apply weekly plan',
    });
  }
};

// Toggle completion status
export const toggleCompletion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date, type, index } = req.body as {
      date: string;
      type: 'meal' | 'exercise';
      index: number;
    };

    if (!date || type === undefined || index === undefined) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Date, type and index are required',
      });
    }

    // Parse date and normalize to UTC to avoid timezone issues
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Use range query to handle timezone issues
    const entry = await ProgressEntry.findOne({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    // If entry doesn't exist, return error - entry should be created first via apply plan or edit day
    if (!entry) {
      return res.status(404).json({
        error: 'Not found',
        message:
          'Progress entry not found. Please add meals/exercises for this day first.',
      });
    }

    if (type === 'meal') {
      if (!entry.meals || !entry.meals[index]) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Meal at index ${index} not found`,
        });
      }
      entry.meals[index].completed = !entry.meals[index].completed;
    } else {
      if (!entry.exercises || !entry.exercises[index]) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Exercise at index ${index} not found`,
        });
      }
      entry.exercises[index].completed = !entry.exercises[index].completed;
    }

    await entry.save();

    const updated = await ProgressEntry.findById(entry._id)
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    return res.status(200).json({ success: true, data: updated });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Failed to toggle completion';
    return res
      .status(500)
      .json({ error: 'Internal server error', message: errorMessage });
  }
};

// Delete progress entry
export const deleteProgressEntry = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { date } = req.params;
    // Parse date and normalize to UTC to avoid timezone issues
    const entryDate = new Date(date + 'T00:00:00.000Z');
    const startOfDay = new Date(entryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const entry = await ProgressEntry.findOneAndDelete({
      userId: req.user._id,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
    if (!entry) {
      return res
        .status(404)
        .json({ error: 'Not found', message: 'Progress entry not found' });
    }

    if (isWithinReminderWindow(entry.date)) {
      await refreshRemindersForDate(req.user._id, entry.date);
    }

    return res
      .status(200)
      .json({ success: true, message: 'Progress entry deleted successfully' });
  } catch {
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete progress entry',
    });
  }
};

