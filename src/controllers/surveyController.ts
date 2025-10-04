import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User, UserSurvey } from '../models';

interface CreateSurveyRequest {
  goal: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle';
  weight?: number; // kg
  height?: number; // cm
  weightLbs?: number; // lbs
  heightInches?: number; // inches
  workoutDays: number;
  workoutDuration: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  gender?: 'male' | 'female';
  age?: number;
  allergies?: string[];
}

// Calculate BMI
const calculateBMI = (weight: number, height: number): number => {
  const heightInMeters = height / 100;
  return Number((weight / (heightInMeters * heightInMeters)).toFixed(1));
};

// Calculate BMR (Mifflin-St Jeor) — expects metric inputs
const calculateBMR = (gender: 'male' | 'female', weightKg: number, heightCm: number, age: number): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'male' ? base + 5 : base - 161;
  return Math.round(bmr);
};

export const createSurvey = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { goal, weight, height, weightLbs, heightInches, workoutDays, workoutDuration, fitnessLevel, gender, age, allergies } =
      req.body as CreateSurveyRequest;

    // Validate required fields
    if (!goal || (!weight && !weightLbs) || (!height && !heightInches) || !workoutDays || !workoutDuration || !fitnessLevel) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'All fields are required',
      });
    }

    // Derive metric units
    const weightKg = weight !== undefined ? weight : Number(((weightLbs as number) * 0.453592).toFixed(2));
    const heightCm = height !== undefined ? height : Number(((heightInches as number) * 2.54).toFixed(2));

    // Validate ranges in metric
    if (weightKg < 20 || weightKg > 300) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Weight must be between 20 and 300 kg',
      });
    }

    if (heightCm < 100 || heightCm > 250) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Height must be between 100 and 250 cm',
      });
    }

    // Calculate BMI
    const bmi = calculateBMI(weightKg, heightCm);

    // Calculate BMR if possible
    let dailyCalories: number | undefined;
    if (gender && age) {
      dailyCalories = calculateBMR(gender, weightKg, heightCm, age);
    }

    // Check if survey already exists
    const existingSurvey = await UserSurvey.findOne({ userId: req.user._id });

    let survey;
    if (existingSurvey) {
      // Update existing survey
      survey = await UserSurvey.findOneAndUpdate(
        { userId: req.user._id },
        {
          goal,
          weight: weightKg,
          height: heightCm,
          weightLbs,
          heightInches,
          bmi,
          workoutDays,
          workoutDuration,
          fitnessLevel,
          gender,
          age,
          allergies: allergies || [],
          dailyCalories,
          completedAt: new Date(),
        },
        { new: true }
      );
    } else {
      // Create new survey
      survey = await UserSurvey.create({
        userId: req.user._id,
        goal,
        weight: weightKg,
        height: heightCm,
        weightLbs,
        heightInches,
        bmi,
        workoutDays,
        workoutDuration,
        fitnessLevel,
        gender,
        age,
        allergies: allergies || [],
        dailyCalories,
      });
    }

    // Update user's isFirstLogin to false
    await User.findByIdAndUpdate(req.user._id, { isFirstLogin: false });

    res.status(200).json({
      success: true,
      data: survey,
    });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create survey',
    });
  }
};

export const getSurvey = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const survey = await UserSurvey.findOne({ userId: req.user._id });

    if (!survey) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Survey not found',
      });
    }

    res.status(200).json({
      success: true,
      data: survey,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get survey',
    });
  }
};

export const updateSurvey = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { goal, weight, height, weightLbs, heightInches, workoutDays, workoutDuration, fitnessLevel, gender, age, allergies } = req.body as any;

    // Calculate BMI if weight or height changed
    // Derive metric if provided in imperial
    const weightKg = weight !== undefined ? weight : (weightLbs !== undefined ? Number((weightLbs * 0.453592).toFixed(2)) : undefined);
    const heightCm = height !== undefined ? height : (heightInches !== undefined ? Number((heightInches * 2.54).toFixed(2)) : undefined);

    const bmi = (weightKg !== undefined && heightCm !== undefined) ? calculateBMI(weightKg, heightCm) : undefined;

    const updateData: any = {};
    if (goal) updateData.goal = goal;
    if (weightKg !== undefined) updateData.weight = weightKg;
    if (heightCm !== undefined) updateData.height = heightCm;
    if (weightLbs !== undefined) updateData.weightLbs = weightLbs;
    if (heightInches !== undefined) updateData.heightInches = heightInches;
    if (bmi !== undefined) updateData.bmi = bmi;
    if (workoutDays !== undefined) updateData.workoutDays = workoutDays;
    if (workoutDuration !== undefined) updateData.workoutDuration = workoutDuration;
    if (fitnessLevel) updateData.fitnessLevel = fitnessLevel;
    if (gender) updateData.gender = gender;
    if (age !== undefined) updateData.age = age;
    if (allergies) updateData.allergies = allergies;

    if (gender && age && weightKg !== undefined && heightCm !== undefined) {
      updateData.dailyCalories = calculateBMR(gender, weightKg, heightCm, age);
    }

    const survey = await UserSurvey.findOneAndUpdate(
      { userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!survey) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Survey not found',
      });
    }

    res.status(200).json({
      success: true,
      data: survey,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update survey',
    });
  }
};