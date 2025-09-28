const getReminderLookaheadDays = () => {
  const value = Number(process.env.REMINDER_LOOKAHEAD_DAYS);
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.floor(value);
};

export const isWithinReminderWindow = (date: Date) => {
  const lookaheadDays = getReminderLookaheadDays();
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const endDate = new Date(startOfToday);
  endDate.setUTCDate(endDate.getUTCDate() + lookaheadDays);
  return date >= startOfToday && date <= endDate;
};


