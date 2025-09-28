import mongoose, { Document, Schema } from 'mongoose';

export interface IFoodEntry extends Document {
  userId: string;
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealId?: string; // If from library
  customMeal?: {
    name: string;
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
  };
  createdAt: Date;
}

const foodEntrySchema = new Schema<IFoodEntry>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    date: {
      type: Date,
      required: true,
    },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    mealId: {
      type: Schema.Types.ObjectId,
      ref: 'Meal',
    },
    customMeal: {
      name: String,
      calories: Number,
      carbs: Number,
      protein: Number,
      fat: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
foodEntrySchema.index({ userId: 1, date: 1, mealType: 1 });

export const FoodEntry = mongoose.model<IFoodEntry>('FoodEntry', foodEntrySchema);

