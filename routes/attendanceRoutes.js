const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getAllAttendance,
  getAttendanceByEmployee,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
  bulkCreateAttendance
} = require('../controllers/attendanceController');

const router = express.Router();

// Get attendance statistics
router.get('/stats/overview', auth, getAttendanceStats);

// Get all attendance records
router.get('/', auth, getAllAttendance);

// Get attendance by employee
router.get('/employee/:employeeId', auth, getAttendanceByEmployee);

// Create attendance record (Check-in)
router.post('/', auth, [
  body('employee').notEmpty().withMessage('Employee is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('checkIn').optional().isISO8601().withMessage('Valid check-in time required'),
  body('status').optional().isIn(['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekend'])
], createAttendance);

// Bulk create attendance (admin only)
router.post('/bulk', auth, admin, bulkCreateAttendance);

// Update attendance record (Check-out)
router.put('/:id', auth, [
  body('checkOut').optional().isISO8601().withMessage('Valid check-out time required'),
  body('status').optional().isIn(['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekend'])
], updateAttendance);

// Delete attendance record (admin only)
router.delete('/:id', auth, admin, deleteAttendance);

module.exports = router;
