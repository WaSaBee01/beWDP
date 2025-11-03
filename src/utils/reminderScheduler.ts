import { HydratedDocument, Types } from 'mongoose';
import cron from 'node-cron';
import { clearTimeout, setTimeout } from 'node:timers';
import { ProgressEntry, User } from '../models';
import { IProgressEntry } from '../models/ProgressEntry';
import { sendExerciseReminderEmail, sendMealReminderEmail } from './emailService';

type TimeoutHandle = ReturnType<typeof setTimeout>;

type ReminderKey = string;

const scheduledTimeouts = new Map<ReminderKey, TimeoutHandle[]>();
let nightlyJob: cron.ScheduledTask | null = null;

const getMinutes = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const MEAL_OFFSET_MINUTES = () => getMinutes(process.env.MEAL_REMINDER_OFFSET_MINUTES, 30);
const EXERCISE_OFFSET_MINUTES = () => getMinutes(process.env.EXERCISE_REMINDER_OFFSET_MINUTES, 45);
const LOOKAHEAD_DAYS = () => Math.max(1, getMinutes(process.env.REMINDER_LOOKAHEAD_DAYS, 1));
const LOCAL_TIMEZONE_OFFSET_MINUTES = () => getMinutes(process.env.LOCAL_TIMEZONE_OFFSET_MINUTES, 420); // default GMT+7
const REMINDER_TZ = () => process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh';

const getDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getReminderKey = (userId: Types.ObjectId, date: Date) => `${userId.toString()}-${getDateKey(date)}`;

const clearScheduledReminder = (key: ReminderKey) => {
  const timeouts = scheduledTimeouts.get(key);
  if (timeouts && timeouts.length) {
    timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
  }
  scheduledTimeouts.delete(key);
};

const buildEventDate = (entryDate: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const base = new Date(entryDate);
  const eventUtc = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hours || 0, minutes || 0, 0, 0)
  );
  const offsetMs = LOCAL_TIMEZONE_OFFSET_MINUTES() * 60 * 1000;
  return new Date(eventUtc.getTime() - offsetMs);
};

const scheduleReminderTimeout = (
  executeAt: Date,
  handler: () => Promise<void>,
  key: ReminderKey,
  collector: TimeoutHandle[]
) => {
  const delay = executeAt.getTime() - Date.now();
  if (delay <= 0) return;

  const timeoutId = setTimeout(() => {
    handler().catch((error) => {
      console.error('[ReminderScheduler] Failed to send reminder', error);
    });
  }, delay);

  collector.push(timeoutId);
  scheduledTimeouts.set(key, collector);
};

const scheduleEntryReminders = async (entry: HydratedDocument<IProgressEntry>) => {
  const user = await User.findById(entry.userId).lean();
  if (!user?.email) return;

  const now = Date.now();
  const maxScheduleTime = now + LOOKAHEAD_DAYS() * 24 * 60 * 60 * 1000;
  const entryTime = new Date(entry.date).getTime();
  if (entryTime > maxScheduleTime) {
    console.log(
      `[ReminderScheduler] Skip scheduling for user=${entry.userId} date=${entry.date.toISOString()} (outside lookahead)`
    );
    return;
  }

  const key = getReminderKey(entry.userId, entry.date);
  clearScheduledReminder(key);

  const timers: TimeoutHandle[] = [];
  const dateLabel = new Date(entry.date).toLocaleDateString('vi-VN');

  entry.meals.forEach((meal) => {
    if (!meal.time) return;
    const eventDate = buildEventDate(entry.date, meal.time);
    const reminderTime = new Date(eventDate.getTime() - MEAL_OFFSET_MINUTES() * 60 * 1000);
    if (reminderTime.getTime() <= Date.now()) return;

    let mealName = 'bữa ăn';
    if (
      typeof meal.mealId === 'object' &&
      meal.mealId !== null &&
      'name' in meal.mealId &&
      typeof (meal.mealId as { name?: string }).name === 'string'
    ) {
      mealName = (meal.mealId as { name?: string }).name || mealName;
    }

    const localReminderTime = reminderTime.toLocaleString('vi-VN', { timeZone: REMINDER_TZ() });
    console.log(
      `[ReminderScheduler] Scheduled meal reminder for user=${entry.userId} date=${dateLabel} meal=${mealName} at ${reminderTime.toISOString()} (local ${localReminderTime})`
    );

    scheduleReminderTimeout(
      reminderTime,
      async () => {
        await sendMealReminderEmail({
          to: user.email,
          userName: user.name || 'bạn',
          dateLabel,
          time: meal.time,
          mealName,
        });
      },
      key,
      timers
    );
  });

  entry.exercises.forEach((exercise) => {
    if (!exercise.time) return;
    const eventDate = buildEventDate(entry.date, exercise.time);
    const reminderTime = new Date(eventDate.getTime() - EXERCISE_OFFSET_MINUTES() * 60 * 1000);
    if (reminderTime.getTime() <= Date.now()) return;

    let exerciseName = 'bài tập';
    if (
      typeof exercise.exerciseId === 'object' &&
      exercise.exerciseId !== null &&
      'name' in exercise.exerciseId &&
      typeof (exercise.exerciseId as { name?: string }).name === 'string'
    ) {
      exerciseName = (exercise.exerciseId as { name?: string }).name || exerciseName;
    }

    const localReminderTime = reminderTime.toLocaleString('vi-VN', { timeZone: REMINDER_TZ() });
    console.log(
      `[ReminderScheduler] Scheduled exercise reminder for user=${entry.userId} date=${dateLabel} workout=${exerciseName} at ${reminderTime.toISOString()} (local ${localReminderTime})`
    );

    scheduleReminderTimeout(
      reminderTime,
      async () => {
        await sendExerciseReminderEmail({
          to: user.email,
          userName: user.name || 'bạn',
          dateLabel,
          time: exercise.time,
          exerciseName,
        });
      },
      key,
      timers
    );
  });
};

const getDateRange = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
};

export const refreshRemindersForDate = async (userId: Types.ObjectId | string, date: Date) => {
  try {
    const { start, end } = getDateRange(date);
    const entry = await ProgressEntry.findOne({
      userId,
      date: { $gte: start, $lte: end },
    })
      .populate('meals.mealId')
      .populate('exercises.exerciseId');

    if (!entry) {
      clearScheduledReminder(getReminderKey(new Types.ObjectId(userId), date));
      return;
    }

    await scheduleEntryReminders(entry);
    console.log(
      `[ReminderScheduler] Refreshed reminders for user=${entry.userId} date=${getDateKey(entry.date)} (meals=${entry.meals.length}, exercises=${entry.exercises.length})`
    );
  } catch (error) {
    console.error('[ReminderScheduler] Failed to refresh reminders', error);
  }
};

export const initReminderScheduler = async () => {
  if (nightlyJob) {
    nightlyJob.stop();
  }

  await scheduleLookaheadEntries();

  nightlyJob = cron.schedule(
    process.env.NIGHTLY_REMINDER_CRON || '0 21 * * *',
    async () => {
      console.log('[ReminderScheduler] Nightly cron triggered');
      await scheduleLookaheadEntries();
    },
    {
      timezone: process.env.REMINDER_TIMEZONE || 'Asia/Ho_Chi_Minh',
    }
  );

  nightlyJob.start();
  console.log('📧 Reminder scheduler initialized');
};

const scheduleLookaheadEntries = async () => {
  const now = new Date();
  const target = new Date(now);
  target.setUTCDate(target.getUTCDate() + LOOKAHEAD_DAYS());
  const { start, end } = getDateRange(target);

  const entries = await ProgressEntry.find({
    date: { $gte: start, $lte: end },
  })
    .populate('meals.mealId')
    .populate('exercises.exerciseId');

  await Promise.all(entries.map((entry) => scheduleEntryReminders(entry)));
  console.log(
    `[ReminderScheduler] Lookahead scheduled for ${entries.length} entries (targetDate=${getDateKey(target)})`
  );
};




