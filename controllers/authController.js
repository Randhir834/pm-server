const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Session = require('../models/Session');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, designation } = req.body;

    // Check if user already exists using the new static method
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Validate role if provided
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      designation: designation || '',
      role: role || 'user' // Default to 'user' if no role provided
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);



    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists using the new static method
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Email not found. Please check your email address or create a new account.' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated. Please contact support for assistance.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password. Please try again.' });
    }

    // Update last login
    await user.updateLastLogin();

    // Update first login time of the day
    await user.updateFirstLoginTime();



    // Generate token
    const token = generateToken(user._id);



    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: user.role,
        lastLogin: user.lastLogin,
        firstLoginTime: user.firstLoginTime
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        firstLoginTime: user.firstLoginTime,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    
    res.json({
      count: users.length,
      users
    });
  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user role (admin only)
// @route   PUT /api/auth/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get system statistics (admin only)
// @route   GET /api/auth/stats
// @access  Private/Admin
const getSystemStats = async (req, res) => {
  try {
    // Import models if not already imported
    const Lead = require('../models/Lead');

    const totalUsers = await User.countDocuments({});
    const totalLeads = await Lead.countDocuments({ isActive: true });

    // Get user activity stats (users who logged in within last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({ 
      lastLogin: { $gte: sevenDaysAgo }
    });

    console.log('📊 System stats calculated:', {
      totalUsers,
      totalLeads,
      activeUsers
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalLeads,
        activeUsers
      }
    });
  } catch (error) {
    console.error('❌ Get system stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Check if this is the first user
// @route   GET /api/auth/check-first-user
// @access  Public
const checkFirstUser = async (req, res) => {
  try {
    const userCount = await User.countDocuments({});
    const isFirstUser = userCount === 0;

    res.json({
      success: true,
      isFirstUser
    });
  } catch (error) {
    console.error('❌ Check first user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    console.log(`🗑️  Starting user deletion process for userId: ${userId}`);
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log(`   ✗ Invalid user ID format: ${userId}`);
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.log(`   ✗ User not found with id: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      console.log(`   ✗ Admin attempted to delete their own account`);
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    console.log(`   ➤ Deleting user: ${user.name} (${user.email})`);
    
    // Delete all sessions associated with this user
    try {
      const deletedSessions = await Session.deleteMany({ userId: userId });
      console.log(`   ✓ Deleted ${deletedSessions.deletedCount} sessions`);
    } catch (sessionError) {
      console.error(`   ✗ Error deleting sessions:`, sessionError.message);
      // Continue with deletion even if sessions fail
    }
    
    // Delete all leads created by this user
    try {
      const deletedLeads = await Lead.deleteMany({ createdBy: userId });
      console.log(`   ✓ Deleted ${deletedLeads.deletedCount} leads created by user`);
    } catch (leadError) {
      console.error(`   ✗ Error deleting leads:`, leadError.message);
      // Continue with deletion even if leads fail
    }
    
    // Update leads assigned to this user (set assignedTo to null)
    try {
      const updatedLeads = await Lead.updateMany(
        { assignedTo: userId },
        { $set: { assignedTo: null } }
      );
      console.log(`   ✓ Unassigned ${updatedLeads.modifiedCount} leads from user`);
    } catch (updateError) {
      console.error(`   ✗ Error updating lead assignments:`, updateError.message);
      // Continue with deletion even if update fails
    }
    
    // Finally, delete the user
    await User.findByIdAndDelete(userId);
    console.log(`   ✓ User deleted successfully`);
    
    res.json({
      success: true,
      message: 'User and all associated data permanently deleted',
      details: {
        user: user.name
      }
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error during user deletion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user by ID (admin only)
// @route   GET /api/auth/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile (admin only)
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, designation, department, phone, address } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (designation !== undefined) user.designation = designation;
    if (department !== undefined) user.department = department;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    
    await user.save();
    
    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        designation: user.designation,
        department: user.department,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getAllUsers,
  updateUserRole,
  getSystemStats,
  checkFirstUser,
  deleteUser,
  getUserById,
  updateUser
};