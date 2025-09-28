import mongoose, { Document, Schema } from 'mongoose';

export interface IExercise extends Document {
  name: string;
  description?: string;
  durationMinutes: number; // thời gian tập (phút)
  caloriesBurned: number; // calo tiêu thụ
  videoUrl?: string; // link youtube
  difficulty: 'basic' | 'intermediate' | 'advanced';
  isCommon: boolean; // true nếu do admin tạo, dùng chung
  createdBy?: string; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

const exerciseSchema = new Schema<IExercise>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    caloriesBurned: { type: Number, required: true, min: 0 },
    videoUrl: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['basic', 'intermediate', 'advanced'],
      default: 'basic',
    },
    isCommon: { type: Boolean, default: false },
    createdBy: { type: String, ref: 'User' },
  },
  { timestamps: true }
);

exerciseSchema.index({ name: 'text', description: 'text' });

export const Exercise = mongoose.model<IExercise>('Exercise', exerciseSchema);


