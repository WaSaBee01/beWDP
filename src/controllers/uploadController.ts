import { v2 as cloudinary } from 'cloudinary';
import { Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/auth';

// Lazy initialization - configure Cloudinary only when needed
let cloudinaryConfigured = false;

const configureCloudinary = (): void => {
  // Skip if already configured
  if (cloudinaryConfigured) {
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('❌ Cloudinary credentials missing in environment variables');
    console.error('Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
    console.error('Current values:', {
      cloudName: cloudName ? '***' : 'undefined',
      apiKey: apiKey ? '***' : 'undefined',
      apiSecret: apiSecret ? '***' : 'undefined',
    });
    throw new Error('Cloudinary configuration is missing. Please check your .env file.');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  cloudinaryConfigured = true;
  console.log('✅ Cloudinary configured successfully');
};

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh'));
    }
  },
});

export const uploadImage = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Không có file ảnh được tải lên',
      });
    }

    // Ensure Cloudinary is configured (lazy initialization)
    try {
      configureCloudinary();
    } catch (configError) {
      const errorMessage = configError instanceof Error ? configError.message : 'Unknown error';
      console.error('❌ Cloudinary configuration error:', errorMessage);
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Cloudinary chưa được cấu hình. Vui lòng kiểm tra file .env và đảm bảo đã có CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
      });
    }

    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: 'gymnet/meals',
      resource_type: 'image',
      transformation: [
        {
          width: 800,
          height: 600,
          crop: 'limit',
          quality: 'auto',
          format: 'auto',
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
    });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Không thể tải ảnh lên Cloudinary';
    return res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
};

