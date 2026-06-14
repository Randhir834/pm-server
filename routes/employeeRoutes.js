const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats
} = require('../controllers/employeeController');

const router = express.Router();

// Get employee statistics
router.get('/stats/overview', auth, getEmployeeStats);

// Get all employees
router.get('/', auth, getAllEmployees);

// Get employee by ID
router.get('/:id', auth, getEmployeeById);

// Create new employee
router.post('/', auth, [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Valid gender is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('position').trim().notEmpty().withMessage('Position is required'),
  body('joiningDate').optional().isISO8601().withMessage('Valid joining date is required'),
  body('employmentType').optional().isIn(['Full-time', 'Part-time', 'Contract', 'Intern']),
  body('salary').isNumeric().withMessage('Salary must be a number')
], createEmployee);

// Update employee
router.put('/:id', auth, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']),
  body('position').optional().trim().notEmpty().withMessage('Position cannot be empty'),
  body('salary').optional().isNumeric().withMessage('Salary must be a number')
], updateEmployee);

// Delete employee (admin only)
router.delete('/:id', auth, admin, deleteEmployee);

module.exports = router;
