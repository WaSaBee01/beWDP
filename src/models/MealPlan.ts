import mongoose, { Document, Schema } from 'mongoose';

export interface IMealPlan extends Document {
  userId: string;
  weekStartDate: Date;
  meals: {
    day: string; // 'monday', 'tuesday', etc.
    breakfast?: string; // Meal ID
    lunch?: string;
    dinner?: string;
    snack?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const mealPlanSchema = new Schema<IMealPlan>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    weekStartDate: {
      type: Date,
      required: true,
    },
    meals: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          required: true,
        },
        breakfast: {
          type: Schema.Types.ObjectId,
          ref: 'Meal',
        },
        lunch: {
          type: Schema.Types.ObjectId,
          ref: 'Meal',
        },
        dinner: {
          type: Schema.Types.ObjectId,
          ref: 'Meal',
        },
        snack: {
          type: Schema.Types.ObjectId,
          ref: 'Meal',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
mealPlanSchema.index({ userId: 1, weekStartDate: 1 });

export const MealPlan = mongoose.model<IMealPlan>('MealPlan', mealPlanSchema);

