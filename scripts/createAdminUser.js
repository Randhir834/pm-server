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

// Create admin user function
const createAdminUser = async () => {
  try {
    const userData = {
      name: 'Ankit',
      email: 'randhircool44@gmail.com',
      password: 'randhir12345',
      role: 'admin' // Admin privileges
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log('⚠️  User already exists with this email');
      console.log('User details:', {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive,
        createdAt: existingUser.createdAt
      });
      return;
    }

    // Create new admin user
    const user = new User(userData);
    await user.save();

    console.log('✅ Admin user created successfully!');
    console.log('User details:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });
    console.log('\n👤 Name:', userData.name);
    console.log('📧 Email:', userData.email);
    console.log('🔑 Password:', userData.password);
    console.log('👑 Role: ADMIN');
    console.log('\nYou can now login with these admin credentials.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === 11000) {
      console.error('Duplicate key error - user with this email already exists');
    }
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
};

// Run the script
const run = async () => {
  await connectDB();
  await createAdminUser();
};

run();
