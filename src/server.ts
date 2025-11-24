import app from './app';
import { connectDB } from './utils/database';
import { initReminderScheduler } from './utils/reminderScheduler';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    await initReminderScheduler();

    
    app.listen(PORT, () => {
      console.log(` Server is running on port ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/health`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error(' Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
