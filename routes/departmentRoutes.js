const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');

const router = express.Router();

// Get all departments
router.get('/', auth, getAllDepartments);

// Get department by ID
router.get('/:id', auth, getDepartmentById);

// Create new department (admin only)
router.post('/', auth, admin, [
  body('name').trim().notEmpty().withMessage('Department name is required'),
  body('code').trim().notEmpty().withMessage('Department code is required'),
  body('description').optional().trim(),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().trim()
], createDepartment);

// Update department (admin only)
router.put('/:id', auth, admin, [
  body('name').optional().trim().notEmpty().withMessage('Department name cannot be empty'),
  body('code').optional().trim().notEmpty().withMessage('Department code cannot be empty'),
  body('description').optional().trim(),
  body('budget').optional().isNumeric().withMessage('Budget must be a number'),
  body('location').optional().trim()
], updateDepartment);

// Delete department (admin only)
router.delete('/:id', auth, admin, deleteDepartment);

module.exports = router;
