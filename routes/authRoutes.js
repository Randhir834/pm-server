const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  register,
  login,
  getCurrentUser,
  getAllUsers,
  updateUserRole,
  getSystemStats,
  checkFirstUser,
  deleteUser
} = require('../controllers/authController');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-for-development';

// Email configuration
let transporter = null;

// Only configure email if credentials are provided and not default values
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
    process.env.EMAIL_USER !== 'your-email@gmail.com' &&
    process.env.EMAIL_PASS !== 'your-app-specific-password' &&
    process.env.EMAIL_PASS !== 'your-app-password') {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  
  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
    } else {
      console.log('✅ Email server is ready to send messages');
    }
  });
} else {
  console.warn('⚠️ Email credentials not configured. Password reset functionality will not work.');
  console.warn('   Please set EMAIL_USER and EMAIL_PASS in your .env file');
}

// Register route
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin"')
], register);

// Login route
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], login);

// Forgot password route
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, clientUrl: requestClientUrl } = req.body;

    // Check if email is configured
    if (!transporter) {
      console.error('❌ Email service not initialized. Check EMAIL_USER and EMAIL_PASS in .env file');
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact administrator.' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Create reset URL - use environment variable, request client URL, or fallback
    const resetUrl = `${requestClientUrl || process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>You requested a password reset for your account. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>Best regards,<br>Your CRM Team</p>
        </div>
      `
    };

    // Send email
    try {
      await transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (mailError) {
      console.error('❌ Nodemailer sendMail failed:', {
        code: mailError?.code,
        responseCode: mailError?.responseCode,
        message: mailError?.message
      });

      const responseCode = mailError?.responseCode;
      const code = mailError?.code;
      if (responseCode === 535 || code === 'EAUTH') {
        return res.status(500).json({
          message: 'Email login failed. Please verify EMAIL_USER and EMAIL_PASS (Gmail App Password) in the backend .env and restart the server.'
        });
      }

      return res.status(500).json({
        message: 'Unable to send reset email right now. Please try again later.'
      });
    }

    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ message: 'Server error while sending reset email' });
  }
});

// Reset password route
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by reset token
    const user = await User.findByResetToken(hashedToken);
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.clearPasswordResetToken();
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
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
        role: user.role,
        lastLogin: user.lastLogin,
        lastLogout: user.lastLogout
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route (client-side token removal)
router.post('/logout', auth, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// Check if first user (public)
router.get('/check-first-user', checkFirstUser);

// Admin routes
// Get all users (admin only)
router.get('/users', auth, admin, getAllUsers);

// Get users for filtering (authenticated users)
router.get('/users/list', auth, async (req, res) => {
  try {
    const users = await User.find({}, 'name _id').sort({ name: 1 });
    res.json({ users });
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', auth, admin, [
  body('role').isIn(['user', 'admin']).withMessage('Role must be either "user" or "admin"')
], updateUserRole);

// Delete user (admin only)
router.delete('/users/:id', auth, admin, deleteUser);

// Get system statistics (admin only)
router.get('/stats', auth, admin, getSystemStats);

module.exports = router;