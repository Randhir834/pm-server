const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'CRM'
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Verify user function
const verifyUser = async () => {
  try {
    const email = 'randhir.grd1122@gmail.com';
    
    // Find user by email (with password for verification)
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ User not found with email:', email);
      return;
    }

    console.log('✅ User found in database!');
    console.log('User details:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });

    // Test password verification
    const testPassword = 'randhir12345';
    const isPasswordCorrect = await user.comparePassword(testPassword);
    
    console.log('\n🔐 Password verification test:', isPasswordCorrect ? '✅ PASSED' : '❌ FAILED');
    
    if (isPasswordCorrect) {
      console.log('\n✅ Login credentials are valid!');
      console.log('📧 Email: ' + email);
      console.log('🔑 Password: ' + testPassword);
    }

  } catch (error) {
    console.error('❌ Error verifying user:', error.message);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await verifyUser();
};

run();
