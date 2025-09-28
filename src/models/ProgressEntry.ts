import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProgressMeal {
  time: string; // e.g. '07:30'
  mealId: Types.ObjectId;
  completed: boolean;
}

export interface IProgressExercise {
  time: string; // e.g. '18:00'
  exerciseId: Types.ObjectId;
  completed: boolean;
}

export interface IProgressEntry extends Document {
  userId: Types.ObjectId;
  date: Date; // Ngày trong calendar
  meals: IProgressMeal[];
  exercises: IProgressExercise[];
  planId?: Types.ObjectId; // Nếu apply từ plan
  planType?: 'daily' | 'weekly'; // Loại plan được apply
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const progressEntrySchema = new Schema<IProgressEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    meals: [
      {
        time: { type: String, required: true },
        mealId: { type: Schema.Types.ObjectId, ref: 'Meal', required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    exercises: [
      {
        time: { type: String, required: true },
        exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
    },
    planType: {
      type: String,
      enum: ['daily', 'weekly'],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
progressEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

export const ProgressEntry = mongoose.model<IProgressEntry>('ProgressEntry', progressEntrySchema);

