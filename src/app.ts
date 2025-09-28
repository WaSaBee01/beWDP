import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import { errorHandler } from './middleware/errorHandler';
import adminExerciseRoutes from './routes/adminExerciseRoutes';
import adminMealRoutes from './routes/adminMealRoutes';
import adminOverviewRoutes from './routes/adminOverviewRoutes';
import adminPlanRoutes from './routes/adminPlanRoutes';
import adminUserRoutes from './routes/adminUserRoutes';
import adminWeeklyPlanRoutes from './routes/adminWeeklyPlanRoutes';
import authRoutes from './routes/authRoutes';
import foodDiaryRoutes from './routes/foodDiaryRoutes';
import mealPlanRoutes from './routes/mealPlanRoutes';
import mealRoutes from './routes/mealRoutes';
import paymentRoutes from './routes/paymentRoutes';
import progressRoutes from './routes/progressRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import surveyRoutes from './routes/surveyRoutes';
import userLibraryRoutes from './routes/userLibraryRoutes';

// Load environment variables FIRST
// Try to load from backend/.env first, fallback to root .env
const envPath = dotenv.config({ path: '.env' });
if (envPath.error) {
  console.warn('⚠️  Could not load .env file from backend directory, trying root directory...');
  dotenv.config({ path: '../.env' });
}

// Log Cloudinary config status (without exposing secrets)
console.log('🔧 Environment variables loaded:');
console.log(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing'}`);
console.log(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'}`);

// Initialize passport strategies AFTER dotenv
import './config/passport';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize passport
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'GymNet API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/food-diary', foodDiaryRoutes);
app.use('/api/admin/meals', adminMealRoutes);
app.use('/api/admin/exercises', adminExerciseRoutes);
app.use('/api/admin/plans', adminPlanRoutes);
app.use('/api/admin/weekly-plans', adminWeeklyPlanRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/overview', adminOverviewRoutes);
app.use('/api/user', userLibraryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/statistics', statisticsRoutes);

// 404 for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: 'This endpoint is not yet implemented',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

export default app;
