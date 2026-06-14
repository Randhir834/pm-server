const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  createSalary,
  getEmployeeSalaries,
  getSalaryById,
  updateSalary,
  deleteSalary,
  getAllSalaries,
  markSalaryAsPaid
} = require('../controllers/salaryController');

const router = express.Router();

// All salary routes require authentication and admin role

// Get all salary entries with optional filters
router.get('/', auth, admin, getAllSalaries);

// Get salary entries for a specific employee
router.get('/:employeeId', auth, admin, getEmployeeSalaries);

// Get a specific salary entry by ID
router.get('/entry/:id', auth, admin, getSalaryById);

// Create new salary entry
router.post('/', auth, admin, createSalary);

// Update salary entry
router.put('/:id', auth, admin, updateSalary);

// Mark salary as paid
router.patch('/:id/paid', auth, admin, markSalaryAsPaid);

// Delete salary entry
router.delete('/:id', auth, admin, deleteSalary);

module.exports = router;
