import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Plan, WeeklyPlan } from '../models';

const sumTotals = (plans: any[]) => {
  return plans.reduce(
    (acc, p) => ({
      caloriesIn: acc.caloriesIn + (p.totals?.caloriesIn || 0),
      carbs: acc.carbs + (p.totals?.carbs || 0),
      protein: acc.protein + (p.totals?.protein || 0),
      fat: acc.fat + (p.totals?.fat || 0),
      caloriesOut: acc.caloriesOut + (p.totals?.caloriesOut || 0),
    }),
    { caloriesIn: 0, carbs: 0, protein: 0, fat: 0, caloriesOut: 0 }
  );
};

export const getAllWeeklyPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { search } = req.query as { search?: string };
    const filter: any = {
      isCommon: true, 
    };
    
    if (search) filter.$text = { $search: search };
    const wps = await WeeklyPlan.find(filter).populate('createdBy', 'name email').populate({ path: 'days', populate: { path: 'monday tuesday wednesday thursday friday saturday sunday' } });
    return res.status(200).json({ success: true, data: wps });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to get weekly plans' });
  }
};

export const createWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const { name, description, days, goal } = req.body as { name: string; description?: string; days: Record<string, string>; goal?: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle' };
    if (!name) return res.status(400).json({ error: 'Validation error', message: 'Name is required' });
    const planIds = Object.values(days || {}).filter(Boolean);
    const plans = planIds.length ? await Plan.find({ _id: { $in: planIds } }) : [];
    const totals = sumTotals(plans);
    const wp = await WeeklyPlan.create({ name, description, days, goal, totals, isCommon: req.user.role === 'admin', createdBy: req.user._id });
    return res.status(201).json({ success: true, data: wp });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create weekly plan' });
  }
};

export const deleteWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Unauthorized' });
    const { id } = req.params;
    const wp = await WeeklyPlan.findByIdAndDelete(id);
    if (!wp) return res.status(404).json({ error: 'Not found', message: 'Weekly plan not found' });
    return res.status(200).json({ success: true, message: ' deleted successfully' });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete weekly plan' });
  }
};


export const updateWeeklyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Unauthorized' });
    const { id } = req.params;
    const updateData = req.body as any;
    if (updateData.days) {
      const planIds = Object.values(updateData.days || {}).filter(Boolean);
      const plans = planIds.length ? await Plan.find({ _id: { $in: planIds } }) : [];
      updateData.totals = sumTotals(plans);
    }
    const wp = await WeeklyPlan.findByIdAndUpdate(id, updateData, { new: true });
    if (!wp) return res.status(404).json({ error: 'Not found', message: 'Weekly plan not found' });
    return res.status(200).json({ success: true, data: wp });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'update failed' });
  }
};



