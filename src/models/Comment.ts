import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
  exerciseId: Types.ObjectId; 
  userId: Types.ObjectId; // Reference to User (who commented)
  content: string;
  parentCommentId?: Types.ObjectId; 
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ exerciseId: 1, createdAt: -1 });
commentSchema.index({ parentCommentId: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);

