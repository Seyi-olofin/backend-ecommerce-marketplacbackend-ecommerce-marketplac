const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce-marketplace';

    if (!mongoURI) {
      console.warn('⚠️ No MongoDB URI found. Running without database connection.');
      return;
    }

    // Validate MongoDB URI format
    if (!mongoURI.startsWith('mongodb://') && !mongoURI.startsWith('mongodb+srv://')) {
      console.warn('⚠️ Invalid MongoDB URI format. Expected to start with "mongodb://" or "mongodb+srv://". Running without database connection.');
      return;
    }

    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 60000,
      family: 4,
      retryWrites: true,
      writeConcern: { w: 'majority' },
    });

    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.warn('⚠️ Continuing without database connection. Some features may not work.');
    // Don't exit the process - let the app run without DB
    return; // Just return, don't throw
  }
};

module.exports = connectDB;
