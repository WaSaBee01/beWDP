import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Comment } from '../models/Comment';
import { Exercise } from '../models/Exercise';

export const getExerciseComments = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { exerciseId } = req.params;

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Bài tập không tồn tại',
      });
    }

    const comments = await Comment.find({ exerciseId })
      .populate('userId', 'name email avatar')
      .sort({ createdAt: 1 });

    const topLevelComments = comments.filter((c) => !c.parentCommentId);
    const replies = comments.filter((c) => c.parentCommentId);

    const commentsWithReplies = topLevelComments.map((comment) => {
      const commentReplies = replies
        .filter((reply) => String(reply.parentCommentId) === String(comment._id))
        .map((reply) => ({
          _id: reply._id,
          content: reply.content,
          userId: reply.userId,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
        }));

      return {
        _id: comment._id,
        content: comment.content,
        userId: comment.userId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        replies: commentReplies,
      };
    });

    return res.status(200).json({
      success: true,
      data: commentsWithReplies,
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tải comments',
    });
  }
};

export const createExerciseComment = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { exerciseId } = req.params;
    const { content, parentCommentId } = req.body;

    // Validate input
    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Nội dung comment không được để trống',
      });
    }

    // Verify exercise exists
    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Bài tập không tồn tại',
      });
    }

    if (parentCommentId) {
      const parentComment = await Comment.findOne({
        _id: parentCommentId,
        exerciseId,
      });
      if (!parentComment) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Comment cha không tồn tại',
        });
      }
    }

    // Create comment
    const comment = new Comment({
      exerciseId,
      userId: req.user._id,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
    });

    await comment.save();

    await comment.populate('userId', 'name email avatar');

    const commentData = comment.toObject();
    
    if (parentCommentId) {
      return res.status(201).json({
        success: true,
        data: {
          _id: commentData._id,
          content: commentData.content,
          userId: commentData.userId,
          createdAt: commentData.createdAt,
          updatedAt: commentData.updatedAt,
        },
        message: 'Đã thêm phản hồi thành công',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        _id: commentData._id,
        content: commentData.content,
        userId: commentData.userId,
        createdAt: commentData.createdAt,
        updatedAt: commentData.updatedAt,
        replies: [],
      },
      message: 'Đã thêm comment thành công',
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể tạo comment',
    });
  }
};

// Delete a comment
export const deleteExerciseComment = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { exerciseId, commentId } = req.params;

    // Find comment
    const comment = await Comment.findOne({
      _id: commentId,
      exerciseId,
    });

    if (!comment) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Comment không tồn tại',
      });
    }

    const isOwner = String(comment.userId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Bạn không có quyền xóa comment này',
      });
    }

    if (!comment.parentCommentId) {
      await Comment.deleteMany({ parentCommentId: commentId });
    }

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    return res.status(200).json({
      success: true,
      message: 'Đã xóa comment thành công',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Không thể xóa comment',
    });
  }
};

