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

// Create user function
const createUser = async () => {
  try {
    const userData = {
      name: 'Randhir',
      email: 'randhir.grd1122@gmail.com',
      password: 'randhir12345',
      role: 'user' // or 'admin' if you want admin privileges
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

    // Create new user
    const user = new User(userData);
    await user.save();

    console.log('✅ User created successfully!');
    console.log('User details:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    });
    console.log('\n📧 Email:', userData.email);
    console.log('🔑 Password:', userData.password);
    console.log('\nYou can now login with these credentials.');

  } catch (error) {
    console.error('❌ Error creating user:', error.message);
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
  await createUser();
};

run();
