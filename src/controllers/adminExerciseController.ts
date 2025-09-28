import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exercise } from '../models';

interface CreateExerciseRequest {
  name: string;
  description?: string;
  durationMinutes: number;
  caloriesBurned: number;
  videoUrl?: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
}

export const getAllExercises = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { search } = req.query as { search?: string };
    const filter: Record<string, unknown> = {
      isCommon: true, // Admin chỉ xem các exercise do admin tạo (isCommon = true)
    };
    if (search) filter.$text = { $search: search };

    const exercises = await Exercise.find(filter).populate('createdBy', 'name email');
    return res.status(200).json({ success: true, data: exercises });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to get exercises' });
  }
};

export const createExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }

    const { name, description, durationMinutes, caloriesBurned, videoUrl, difficulty = 'basic' }: CreateExerciseRequest = req.body;

    if (!name || durationMinutes === undefined || caloriesBurned === undefined) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name, durationMinutes và caloriesBurned là bắt buộc',
      });
    }
    if (durationMinutes < 0 || caloriesBurned < 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Values cannot be negative' });
    }

    const exercise = await Exercise.create({
      name,
      description,
      durationMinutes,
      caloriesBurned,
      videoUrl,
      difficulty,
      isCommon: true,
      createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: exercise });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', message: (err as { message?: string }).message });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to create exercise' });
  }
};

export const updateExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }
    const { id } = req.params;
    const updateData = req.body as Partial<CreateExerciseRequest>;

    if (updateData.durationMinutes !== undefined && updateData.durationMinutes < 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Duration cannot be negative' });
    }
    if (updateData.caloriesBurned !== undefined && updateData.caloriesBurned < 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Calories burned cannot be negative' });
    }

    const exercise = await Exercise.findByIdAndUpdate(id, updateData, { new: true });
    if (!exercise) return res.status(404).json({ error: 'Not found', message: 'Exercise not found' });
    return res.status(200).json({ success: true, data: exercise });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation error', message: (err as { message?: string }).message });
    }
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to update exercise' });
  }
};

export const deleteExercise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
    }
    const { id } = req.params;
    const exercise = await Exercise.findByIdAndDelete(id);
    if (!exercise) return res.status(404).json({ error: 'Not found', message: 'Exercise not found' });
    return res.status(200).json({ success: true, message: 'Exercise deleted successfully' });
  } catch {
    return res.status(500).json({ error: 'Internal server error', message: 'Failed to delete exercise' });
  }
};


