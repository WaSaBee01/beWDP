import mongoose, { Document, Schema } from 'mongoose';

export interface Ingredient {
  name: string;
  weightGram: number;
}

export interface IMeal extends Document {
  name: string;
  description?: string;
  ingredients?: Ingredient[]; // Thành phần dạng mảng
  image?: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  weightGrams: number;
  isCommon: boolean;
  createdBy?: string; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

const mealSchema = new Schema<IMeal>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    ingredients: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      weightGram: {
        type: Number,
        required: true,
        min: 0,
      },
    }],
    image: {
      type: String,
      default: '',
    },
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    carbs: {
      type: Number,
      required: true,
      min: 0,
    },
    protein: {
      type: Number,
      required: true,
      min: 0,
    },
    fat: {
      type: Number,
      required: true,
      min: 0,
    },
    weightGrams: {
      type: Number,
      required: true,
      min: 0,
    },
    isCommon: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Removed goal and isTemplate for phase 2 simplification
    createdBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
mealSchema.index({ name: 'text', description: 'text' }); // Text search

export const Meal = mongoose.model<IMeal>('Meal', mealSchema);

