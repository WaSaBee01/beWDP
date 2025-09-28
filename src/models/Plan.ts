import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPlanItemMeal {
  time: string; // e.g. '07:30'
  meal: Types.ObjectId;
}

export interface IPlanItemExercise {
  time: string; // e.g. '18:00'
  exercise: Types.ObjectId;
}

export interface IPlan extends Document {
  name: string;
  description?: string;
  goal?: 'weight_loss' | 'muscle_gain' | 'healthy_lifestyle';
  isCommon: boolean;
  createdBy: Types.ObjectId; // userId
  meals: IPlanItemMeal[];
  exercises: IPlanItemExercise[];
  totals: {
    caloriesIn: number;
    carbs: number;
    protein: number;
    fat: number;
    caloriesOut: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    goal: { type: String, enum: ['weight_loss', 'muscle_gain', 'healthy_lifestyle'], default: 'healthy_lifestyle' },
    isCommon: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    meals: [
      {
        time: { type: String, required: true },
        meal: { type: Schema.Types.ObjectId, ref: 'Meal', required: true },
      },
    ],
    exercises: [
      {
        time: { type: String, required: true },
        exercise: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
      },
    ],
    totals: {
      caloriesIn: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      caloriesOut: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

planSchema.index({ name: 'text', description: 'text' });

export const Plan = mongoose.model<IPlan>('Plan', planSchema);


