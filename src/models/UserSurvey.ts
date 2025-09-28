import mongoose, { Document, Schema } from 'mongoose';

export interface IUserSurvey extends Document {
  userId: mongoose.Types.ObjectId;
  goal: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle';
  weight: number; // in kg
  height: number; // in cm
  weightLbs?: number; // optional original unit
  heightInches?: number; // optional original unit
  bmi: number;
  workoutDays: number; // days per week
  workoutDuration: number; // minutes per session
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  gender?: 'male' | 'female';
  age?: number;
  allergies?: string[];
  dailyCalories?: number; // BMR result
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSurveySchema = new Schema<IUserSurvey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    goal: {
      type: String,
      enum: ['weight_loss', 'muscle_gain', 'healthy_lifestyle'],
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 300,
    },
    height: {
      type: Number,
      required: true,
      min: 100,
      max: 250,
    },
    weightLbs: { type: Number },
    heightInches: { type: Number },
    bmi: {
      type: Number,
      required: true,
    },
    workoutDays: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    workoutDuration: {
      type: Number,
      required: true,
      min: 15,
      max: 300,
    },
    fitnessLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
    },
    age: { type: Number },
    allergies: { type: [String], default: [] },
    dailyCalories: { type: Number },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSurveySchema.index({ userId: 1 });

export const UserSurvey = mongoose.model<IUserSurvey>(
  'UserSurvey',
  userSurveySchema
);
