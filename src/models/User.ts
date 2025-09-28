import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  password?: string;
  avatar?: string;
  googleId?: string;
  role: 'user' | 'admin';
  subscriptionStatus: 'free' | 'premium'; // Keep for backward compatibility
  subscriptionExpiresAt?: Date; // Keep for backward compatibility
  isVip: boolean;
  vipExpiresAt?: Date;
  isFirstLogin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      select: false, // Don't return password in queries by default
    },
    avatar: {
      type: String,
      default: '',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    subscriptionStatus: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    subscriptionExpiresAt: {
      type: Date,
    },
    isVip: {
      type: Boolean,
      default: false,
      index: true,
    },
    vipExpiresAt: {
      type: Date,
      index: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
