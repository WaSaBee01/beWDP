import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProgressEntry, UserSurvey } from '../models';

interface WeeklyStats {
  week: string; // ISO week string
  startDate: Date;
  endDate: Date;
  caloriesConsumed: number;
  caloriesBurned: number;
  caloriesTarget: number;
  mealsCompleted: number;
  mealsTotal: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  daysWithData: number;
}

interface MonthlyStats {
  month: string; // YYYY-MM
  startDate: Date;
  endDate: Date;
  caloriesConsumed: number;
  caloriesBurned: number;
  caloriesTarget: number;
  mealsCompleted: number;
  mealsTotal: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  daysWithData: number;
}

// Get statistics for a date range
export const getStatistics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { startDate, endDate, period } = req.query as {
      startDate?: string;
      endDate?: string;
      period?: 'week' | 'month';
    };

    // Get user survey for daily calories target
    const survey = await UserSurvey.findOne({ userId: req.user._id });
    const dailyCaloriesTarget = survey?.dailyCalories || 2000; // Default if no survey

    // Calculate date range
    let start: Date;
    let end: Date;

    if (period === 'week') {
      // Get current week (Monday to Sunday) - Use UTC to avoid timezone issues
      const today = new Date();
      const dayOfWeek = today.getUTCDay(); // Use UTC day (0=Sunday, 1=Monday, ..., 6=Saturday)
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7 for ISO week
      const daysToMonday = isoDay - 1; // Days to go back to Monday (0=Monday, 1=Tuesday, ..., 6=Sunday)

      // Calculate Monday of current week
      start = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - daysToMonday,
          0,
          0,
          0,
          0
        )
      );

      // Calculate Sunday of current week (6 days after Monday)
      end = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + 6,
          23,
          59,
          59,
          999
        )
      );
    } else if (period === 'month') {
      // Get current month
      const today = new Date();
      start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
      );
      end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
      );
      end.setUTCHours(23, 59, 59, 999);
    } else if (startDate && endDate) {
      start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      // Default to current week - Use UTC to avoid timezone issues
      const today = new Date();
      const dayOfWeek = today.getUTCDay(); // Use UTC day (0=Sunday, 1=Monday, ..., 6=Saturday)
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7 for ISO week
      const daysToMonday = isoDay - 1; // Days to go back to Monday (0=Monday, 1=Tuesday, ..., 6=Sunday)

      // Calculate Monday of current week
      start = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - daysToMonday,
          0,
          0,
          0,
          0
        )
      );

      // Calculate Sunday of current week (6 days after Monday)
      end = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + 6,
          23,
          59,
          59,
          999
        )
      );
    }

    // Get progress entries for the date range
    const entries = await ProgressEntry.find({
      userId: req.user._id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    // Calculate statistics
    let caloriesConsumed = 0;
    let caloriesBurned = 0;
    let mealsCompleted = 0;
    let mealsTotal = 0;
    let exercisesCompleted = 0;
    let exercisesTotal = 0;
    const daysWithData = entries.length;

    entries.forEach((entry) => {
      // Calculate calories from meals - ONLY count completed meals
      entry.meals.forEach((meal) => {
        const mealData = meal.mealId as any;
        if (mealData) {
          mealsTotal++;
          // Extract calories safely - handle Mongoose document
          let calories = 0;
          if (typeof mealData === 'object' && mealData !== null) {
            // Try to get calories from Mongoose document
            if (mealData._doc && typeof mealData._doc === 'object') {
              calories =
                typeof mealData._doc.calories === 'number'
                  ? mealData._doc.calories
                  : 0;
            } else if ('calories' in mealData) {
              calories =
                typeof mealData.calories === 'number' ? mealData.calories : 0;
            }
            // If still 0, try to convert to plain object
            if (
              calories === 0 &&
              mealData.toObject &&
              typeof mealData.toObject === 'function'
            ) {
              const plainObj = mealData.toObject();
              calories =
                typeof plainObj.calories === 'number' ? plainObj.calories : 0;
            }
          }

          if (meal.completed) {
            mealsCompleted++;
            // Only add calories if meal is completed and has valid calories
            if (calories > 0) {
              caloriesConsumed += calories;
            }
          }
        }
      });

      // Calculate calories from exercises - ONLY count completed exercises
      entry.exercises.forEach((exercise) => {
        const exerciseData = exercise.exerciseId as any;
        if (exerciseData) {
          exercisesTotal++;
          // Extract calories burned safely - handle Mongoose document
          let caloriesBurnedVal = 0;
          if (typeof exerciseData === 'object' && exerciseData !== null) {
            // Try to get caloriesBurned from Mongoose document
            if (exerciseData._doc && typeof exerciseData._doc === 'object') {
              caloriesBurnedVal =
                typeof exerciseData._doc.caloriesBurned === 'number'
                  ? exerciseData._doc.caloriesBurned
                  : 0;
            } else if ('caloriesBurned' in exerciseData) {
              caloriesBurnedVal =
                typeof exerciseData.caloriesBurned === 'number'
                  ? exerciseData.caloriesBurned
                  : 0;
            }
            // If still 0, try to convert to plain object
            if (
              caloriesBurnedVal === 0 &&
              exerciseData.toObject &&
              typeof exerciseData.toObject === 'function'
            ) {
              const plainObj = exerciseData.toObject();
              caloriesBurnedVal =
                typeof plainObj.caloriesBurned === 'number'
                  ? plainObj.caloriesBurned
                  : 0;
            }
          }

          if (exercise.completed) {
            exercisesCompleted++;
            // Only add calories if exercise is completed and has valid calories
            if (caloriesBurnedVal > 0) {
              caloriesBurned += caloriesBurnedVal;
            }
          }
        }
      });
    });

    // Calculate target calories for the period
    const daysInPeriod =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const caloriesTarget = dailyCaloriesTarget * daysInPeriod;

    // Calculate net calories (consumed - burned)
    const netCalories = caloriesConsumed - caloriesBurned;

    // Calculate daily breakdown for weekly view
    const dailyBreakdown: Array<{
      date: Date;
      dayName: string;
      caloriesConsumed: number;
      caloriesBurned: number;
      netCalories: number;
      mealsCompleted: number;
      mealsTotal: number;
      exercisesCompleted: number;
      exercisesTotal: number;
    }> = [];

    if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate() + i
          )
        );

        // Map day index (0=Monday, 1=Tuesday, ..., 6=Sunday) to day names
        const dayNames = [
          'Thứ 2', // i=0: Monday
          'Thứ 3', // i=1: Tuesday
          'Thứ 4', // i=2: Wednesday
          'Thứ 5', // i=3: Thursday
          'Thứ 6', // i=4: Friday
          'Thứ 7', // i=5: Saturday
          'Chủ nhật', // i=6: Sunday
        ];
        const dayName = dayNames[i];

        const dayEntry = entries.find((e) => {
          // Normalize entry date to UTC midnight for comparison
          // Note: Database stores dates 1 day earlier, so we add 1 day for comparison
          const entryDate = new Date(e.date);
          const entryDateAdjusted = new Date(
            Date.UTC(
              entryDate.getUTCFullYear(),
              entryDate.getUTCMonth(),
              entryDate.getUTCDate() + 1, // Add 1 day to match actual date
              0,
              0,
              0,
              0
            )
          );

          // Compare timestamps
          return entryDateAdjusted.getTime() === currentDate.getTime();
        });

        let dayCaloriesConsumed = 0;
        let dayCaloriesBurned = 0;
        let dayMealsCompleted = 0;
        let dayMealsTotal = 0;
        let dayExercisesCompleted = 0;
        let dayExercisesTotal = 0;

        if (dayEntry) {
          dayEntry.meals.forEach((meal) => {
            const mealData = meal.mealId as any;
            if (mealData) {
              dayMealsTotal++;
              // Extract calories safely - handle Mongoose document
              let calories = 0;
              if (typeof mealData === 'object' && mealData !== null) {
                // Try to get calories from Mongoose document
                if (mealData._doc && typeof mealData._doc === 'object') {
                  calories =
                    typeof mealData._doc.calories === 'number'
                      ? mealData._doc.calories
                      : 0;
                } else if ('calories' in mealData) {
                  calories =
                    typeof mealData.calories === 'number'
                      ? mealData.calories
                      : 0;
                }
                // If still 0, try to convert to plain object
                if (
                  calories === 0 &&
                  mealData.toObject &&
                  typeof mealData.toObject === 'function'
                ) {
                  const plainObj = mealData.toObject();
                  calories =
                    typeof plainObj.calories === 'number'
                      ? plainObj.calories
                      : 0;
                }
              }

              if (meal.completed) {
                dayMealsCompleted++;
                // Only add calories if meal is completed and has valid calories
                if (calories > 0) {
                  dayCaloriesConsumed += calories;
                }
              }
            }
          });

          dayEntry.exercises.forEach((exercise) => {
            const exerciseData = exercise.exerciseId as any;
            if (exerciseData) {
              dayExercisesTotal++;
              // Extract calories burned safely - handle Mongoose document
              let caloriesBurnedVal = 0;
              if (typeof exerciseData === 'object' && exerciseData !== null) {
                // Try to get caloriesBurned from Mongoose document
                if (
                  exerciseData._doc &&
                  typeof exerciseData._doc === 'object'
                ) {
                  caloriesBurnedVal =
                    typeof exerciseData._doc.caloriesBurned === 'number'
                      ? exerciseData._doc.caloriesBurned
                      : 0;
                } else if ('caloriesBurned' in exerciseData) {
                  caloriesBurnedVal =
                    typeof exerciseData.caloriesBurned === 'number'
                      ? exerciseData.caloriesBurned
                      : 0;
                }
                // If still 0, try to convert to plain object
                if (
                  caloriesBurnedVal === 0 &&
                  exerciseData.toObject &&
                  typeof exerciseData.toObject === 'function'
                ) {
                  const plainObj = exerciseData.toObject();
                  caloriesBurnedVal =
                    typeof plainObj.caloriesBurned === 'number'
                      ? plainObj.caloriesBurned
                      : 0;
                }
              }

              if (exercise.completed) {
                dayExercisesCompleted++;
                // Only add calories if exercise is completed and has valid calories
                if (caloriesBurnedVal > 0) {
                  dayCaloriesBurned += caloriesBurnedVal;
                }
              }
            }
          });
        }

        dailyBreakdown.push({
          date: currentDate,
          dayName,
          caloriesConsumed: dayCaloriesConsumed,
          caloriesBurned: dayCaloriesBurned,
          netCalories: dayCaloriesConsumed - dayCaloriesBurned,
          mealsCompleted: dayMealsCompleted,
          mealsTotal: dayMealsTotal,
          exercisesCompleted: dayExercisesCompleted,
          exercisesTotal: dayExercisesTotal,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        period: period || 'week',
        caloriesConsumed,
        caloriesBurned,
        netCalories,
        caloriesTarget,
        caloriesRemaining: caloriesTarget - netCalories,
        mealsCompleted,
        mealsTotal,
        mealsCompletionRate:
          mealsTotal > 0 ? (mealsCompleted / mealsTotal) * 100 : 0,
        exercisesCompleted,
        exercisesTotal,
        exercisesCompletionRate:
          exercisesTotal > 0 ? (exercisesCompleted / exercisesTotal) * 100 : 0,
        daysWithData,
        daysInPeriod,
        goal: survey?.goal || 'healthy_lifestyle',
        dailyCaloriesTarget,
        dailyBreakdown: period === 'week' ? dailyBreakdown : undefined,
      },
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Failed to get statistics';
    return res
      .status(500)
      .json({ error: 'Internal server error', message: errorMessage });
  }
};

// Get weekly statistics
export const getWeeklyStatistics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { weekStart } = req.query as { weekStart?: string };

    // Get user survey
    const survey = await UserSurvey.findOne({ userId: req.user._id });
    const dailyCaloriesTarget = survey?.dailyCalories || 2000;

    // Calculate week start (Monday) - Use UTC to avoid timezone issues
    let start: Date;
    if (weekStart) {
      const inputDate = new Date(weekStart + 'T00:00:00.000Z');
      const dayOfWeek = inputDate.getUTCDay(); // Use UTC day
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7
      const daysToMonday = isoDay - 1; // Days to go back to Monday

      // Calculate Monday of the week containing inputDate
      start = new Date(
        Date.UTC(
          inputDate.getUTCFullYear(),
          inputDate.getUTCMonth(),
          inputDate.getUTCDate() - daysToMonday,
          0,
          0,
          0,
          0
        )
      );
    } else {
      const today = new Date();
      const dayOfWeek = today.getUTCDay(); // Use UTC day
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7
      const daysToMonday = isoDay - 1; // Days to go back to Monday

      // Calculate Monday of current week
      start = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - daysToMonday,
          0,
          0,
          0,
          0
        )
      );
    }

    // Calculate Sunday of current week (6 days after Monday)
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 6,
        23,
        59,
        59,
        999
      )
    );

    // Get entries
    const entries = await ProgressEntry.find({
      userId: req.user._id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    // Calculate daily breakdown
    const dailyBreakdown: Array<{
      date: Date;
      dayName: string;
      caloriesConsumed: number;
      caloriesBurned: number;
      netCalories: number;
      mealsCompleted: number;
      mealsTotal: number;
      exercisesCompleted: number;
      exercisesTotal: number;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate() + i
        )
      );

      // Map day index (0=Monday, 1=Tuesday, ..., 6=Sunday) to day names
      const dayNames = [
        'Thứ 2', // i=0: Monday
        'Thứ 3', // i=1: Tuesday
        'Thứ 4', // i=2: Wednesday
        'Thứ 5', // i=3: Thursday
        'Thứ 6', // i=4: Friday
        'Thứ 7', // i=5: Saturday
        'Chủ nhật', // i=6: Sunday
      ];
      const dayName = dayNames[i];

      const dayEntry = entries.find((e) => {
        // Normalize entry date to UTC midnight for comparison
        // Note: Database stores dates 1 day earlier, so we add 1 day for comparison
        const entryDate = new Date(e.date);
        const entryDateAdjusted = new Date(
          Date.UTC(
            entryDate.getUTCFullYear(),
            entryDate.getUTCMonth(),
            entryDate.getUTCDate() + 1, // Add 1 day to match actual date
            0,
            0,
            0,
            0
          )
        );

        // Compare timestamps
        return entryDateAdjusted.getTime() === currentDate.getTime();
      });

      let dayCaloriesConsumed = 0;
      let dayCaloriesBurned = 0;
      let dayMealsCompleted = 0;
      let dayMealsTotal = 0;
      let dayExercisesCompleted = 0;
      let dayExercisesTotal = 0;

      if (dayEntry) {
        dayEntry.meals.forEach((meal, mealIdx) => {
          const mealData = meal.mealId as any;

          if (mealData) {
            dayMealsTotal++;
            // Extract calories safely - handle Mongoose document
            let calories = 0;
            if (typeof mealData === 'object' && mealData !== null) {
              // Try to get calories from Mongoose document
              if (mealData._doc && typeof mealData._doc === 'object') {
                calories =
                  typeof mealData._doc.calories === 'number'
                    ? mealData._doc.calories
                    : 0;
              } else if ('calories' in mealData) {
                calories =
                  typeof mealData.calories === 'number' ? mealData.calories : 0;
              }
              // If still 0, try to convert to plain object
              if (
                calories === 0 &&
                mealData.toObject &&
                typeof mealData.toObject === 'function'
              ) {
                const plainObj = mealData.toObject();
                calories =
                  typeof plainObj.calories === 'number' ? plainObj.calories : 0;
              }
            }

            if (meal.completed) {
              dayMealsCompleted++;
              // Only add calories if meal is completed and has valid calories
              if (calories > 0) {
                dayCaloriesConsumed += calories;
              }
            }
          }
        });

        dayEntry.exercises.forEach((exercise, exIdx) => {
          const exerciseData = exercise.exerciseId as any;

          if (exerciseData) {
            dayExercisesTotal++;
            // Extract calories burned safely - handle Mongoose document
            let caloriesBurnedVal = 0;
            if (typeof exerciseData === 'object' && exerciseData !== null) {
              // Try to get caloriesBurned from Mongoose document
              if (exerciseData._doc && typeof exerciseData._doc === 'object') {
                caloriesBurnedVal =
                  typeof exerciseData._doc.caloriesBurned === 'number'
                    ? exerciseData._doc.caloriesBurned
                    : 0;
              } else if ('caloriesBurned' in exerciseData) {
                caloriesBurnedVal =
                  typeof exerciseData.caloriesBurned === 'number'
                    ? exerciseData.caloriesBurned
                    : 0;
              }
              // If still 0, try to convert to plain object
              if (
                caloriesBurnedVal === 0 &&
                exerciseData.toObject &&
                typeof exerciseData.toObject === 'function'
              ) {
                const plainObj = exerciseData.toObject();
                caloriesBurnedVal =
                  typeof plainObj.caloriesBurned === 'number'
                    ? plainObj.caloriesBurned
                    : 0;
              }
            }

            if (exercise.completed) {
              dayExercisesCompleted++;
              // Only add calories if exercise is completed and has valid calories
              if (caloriesBurnedVal > 0) {
                dayCaloriesBurned += caloriesBurnedVal;
              }
            }
          }
        });
      }

      dailyBreakdown.push({
        date: currentDate,
        dayName,
        caloriesConsumed: dayCaloriesConsumed,
        caloriesBurned: dayCaloriesBurned,
        netCalories: dayCaloriesConsumed - dayCaloriesBurned,
        mealsCompleted: dayMealsCompleted,
        mealsTotal: dayMealsTotal,
        exercisesCompleted: dayExercisesCompleted,
        exercisesTotal: dayExercisesTotal,
      });
    }

    // Calculate totals
    const totalCaloriesConsumed = dailyBreakdown.reduce(
      (sum, day) => sum + day.caloriesConsumed,
      0
    );
    const totalCaloriesBurned = dailyBreakdown.reduce(
      (sum, day) => sum + day.caloriesBurned,
      0
    );
    const totalNetCalories = totalCaloriesConsumed - totalCaloriesBurned;
    const weeklyCaloriesTarget = dailyCaloriesTarget * 7;

    return res.status(200).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        dailyCaloriesTarget,
        weeklyCaloriesTarget,
        caloriesConsumed: totalCaloriesConsumed,
        caloriesBurned: totalCaloriesBurned,
        netCalories: totalNetCalories,
        caloriesRemaining: weeklyCaloriesTarget - totalNetCalories,
        dailyBreakdown,
        goal: survey?.goal || 'healthy_lifestyle',
      },
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : 'Failed to get weekly statistics';
    return res
      .status(500)
      .json({ error: 'Internal server error', message: errorMessage });
  }
};

// Get monthly statistics
export const getMonthlyStatistics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { month } = req.query as { month?: string }; // Format: YYYY-MM

    // Get user survey
    const survey = await UserSurvey.findOne({ userId: req.user._id });
    const dailyCaloriesTarget = survey?.dailyCalories || 2000;

    // Calculate month start and end
    let start: Date;
    let end: Date;

    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      start = new Date(Date.UTC(year, monthNum - 1, 1));
      end = new Date(Date.UTC(year, monthNum, 0));
      end.setUTCHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
      end.setUTCHours(23, 59, 59, 999);
    }

    // Get entries
    const entries = await ProgressEntry.find({
      userId: req.user._id,
      date: {
        $gte: start,
        $lte: end,
      },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    // Calculate weekly breakdown for the month
    const weeklyBreakdown: WeeklyStats[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      // Find Monday of this week
      const dayOfWeek = currentDate.getUTCDay();
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const daysToMonday = isoDay - 1;

      const weekStart = new Date(Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() - daysToMonday
      ));

      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Clamp to month boundaries
      if (weekStart < start) weekStart.setTime(start.getTime());
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      // Get entries for this week
      const weekEntries = entries.filter((e) => {
        const entryDate = new Date(e.date);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });

      let weekCaloriesConsumed = 0;
      let weekCaloriesBurned = 0;
      let weekMealsCompleted = 0;
      let weekMealsTotal = 0;
      let weekExercisesCompleted = 0;
      let weekExercisesTotal = 0;

      weekEntries.forEach((entry) => {
        entry.meals.forEach((meal) => {
          const mealData = meal.mealId as any;
          if (mealData) {
            const calories = typeof mealData === 'object' ? mealData.calories : 0;
            weekMealsTotal++;
            if (meal.completed) {
              weekMealsCompleted++;
              // Only add calories if meal is completed
              if (calories) {
                weekCaloriesConsumed += calories;
              }
            }
          }
        });

        entry.exercises.forEach((exercise) => {
          const exerciseData = exercise.exerciseId as any;
          if (exerciseData) {
            const caloriesBurnedVal = typeof exerciseData === 'object' ? exerciseData.caloriesBurned : 0;
            weekExercisesTotal++;
            if (exercise.completed) {
              weekExercisesCompleted++;
              // Only add calories if exercise is completed
              if (caloriesBurnedVal) {
                weekCaloriesBurned += caloriesBurnedVal;
              }
            }
          }
        });
      });

      const daysInWeek = Math.ceil((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const weekCaloriesTarget = dailyCaloriesTarget * daysInWeek;

      weeklyBreakdown.push({
        week: `Week ${weeklyBreakdown.length + 1}`,
        startDate: weekStart,
        endDate: weekEnd,
        caloriesConsumed: weekCaloriesConsumed,
        caloriesBurned: weekCaloriesBurned,
        caloriesTarget: weekCaloriesTarget,
        mealsCompleted: weekMealsCompleted,
        mealsTotal: weekMealsTotal,
        exercisesCompleted: weekExercisesCompleted,
        exercisesTotal: weekExercisesTotal,
        daysWithData: weekEntries.length,
      });

      // Move to next week
      currentDate.setUTCDate(currentDate.getUTCDate() + 7);
    }

    // Calculate totals
    const totalCaloriesConsumed = weeklyBreakdown.reduce((sum, week) => sum + week.caloriesConsumed, 0);
    const totalCaloriesBurned = weeklyBreakdown.reduce((sum, week) => sum + week.caloriesBurned, 0);
    const daysInMonth = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const monthlyCaloriesTarget = dailyCaloriesTarget * daysInMonth;

    return res.status(200).json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        month: month || `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        dailyCaloriesTarget,
        monthlyCaloriesTarget,
        caloriesConsumed: totalCaloriesConsumed,
        caloriesBurned: totalCaloriesBurned,
        netCalories: totalCaloriesConsumed - totalCaloriesBurned,
        caloriesRemaining: monthlyCaloriesTarget - (totalCaloriesConsumed - totalCaloriesBurned),
        weeklyBreakdown,
        goal: survey?.goal || 'healthy_lifestyle',
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to get monthly statistics';
    return res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
};

