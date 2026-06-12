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

// Verify admin user function
const verifyAdminUser = async () => {
  try {
    const email = 'randhircool44@gmail.com';
    
    // Find user by email (with password for verification)
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ User not found with email:', email);
      return;
    }

    console.log('✅ Admin user found in database!');
    console.log('User details:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });

    // Verify admin role
    if (user.role === 'admin') {
      console.log('\n👑 Admin privileges: ✅ CONFIRMED');
    } else {
      console.log('\n⚠️  Warning: User does not have admin role!');
    }

    // Test password verification
    const testPassword = 'randhir12345';
    const isPasswordCorrect = await user.comparePassword(testPassword);
    
    console.log('🔐 Password verification test:', isPasswordCorrect ? '✅ PASSED' : '❌ FAILED');
    
    if (isPasswordCorrect) {
      console.log('\n✅ Admin login credentials are valid!');
      console.log('👤 Name: Ankit');
      console.log('📧 Email: ' + email);
      console.log('🔑 Password: ' + testPassword);
      console.log('👑 Role: ADMIN');
    }

  } catch (error) {
    console.error('❌ Error verifying admin user:', error.message);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await verifyAdminUser();
};

run();
