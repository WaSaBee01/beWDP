import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    const users = await User.find({ role: 'user' }).select('_id name email role isActive createdAt');
    return res.status(200).json({ success: true, data: users });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to get users' });
  }
};

export const setActive = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized', message: 'Unauthorized' });
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };
    const user = await User.findOneAndUpdate({ _id: id, role: 'user' }, { isActive }, { new: true }).select('_id name email role isActive');
    if (!user) return res.status(404).json({ error: 'Not found', message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update user' });
  }
};


