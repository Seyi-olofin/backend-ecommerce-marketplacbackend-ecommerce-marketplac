const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecommerce-marketplace';

    if (!mongoURI) {
      throw new Error('❌ No MongoDB URI found. Please set MONGODB_URI in your .env file.');
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
    process.exit(1); // stop the app completely if DB fails to connect
  }
};

module.exports = connectDB;
